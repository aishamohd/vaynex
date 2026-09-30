"use client";

import { Html, Line, OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { DependencyGraph, GraphEdge } from "@/types";
import {
  computeLayout,
  CRIT_SIZE,
  nodeState,
  STATE_COLOR,
  type HighlightInput,
  type NodeVisualState,
  type PlacedNode,
} from "./layout";

export interface ResilienceNetworkProps {
  graph: DependencyGraph;
  highlight?: HighlightInput | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  autoRotate?: boolean;
  showAllLabels?: boolean;
}

/** VAYNEX RESILIENCE NETWORK — lightweight R3F scene. Client-only (loaded via next/dynamic). */
export default function ResilienceNetwork({
  graph,
  highlight = null,
  selectedId = null,
  onSelect,
  autoRotate = true,
  showAllLabels = false,
}: ResilienceNetworkProps) {
  const layout = useMemo(() => computeLayout(graph), [graph]);
  const [hovered, setHovered] = useState<string | null>(null);
  const camDist = layout.extent * 1.7 + 4;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [camDist * 0.65, camDist * 0.62, camDist * 0.8], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => onSelect?.(null)}
      style={{ background: "transparent" }}
    >
      <color attach="background" args={["#03060A"]} />
      <fog attach="fog" args={["#03060A", camDist * 0.9, camDist * 2.6]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 12, 0]} intensity={40} color="#22D3EE" distance={40} />
      <pointLight position={[10, 6, -8]} intensity={18} color="#3B82F6" distance={40} />

      <Ground radius={layout.extent + 3} />
      <Sparkles count={60} scale={[layout.extent * 2.6, 6, layout.extent * 2.6]} size={1.6} speed={0.2} opacity={0.35} color="#22D3EE" />

      {layout.edges.map((e) => (
        <Edge key={e.id} edge={e} layout={layout.byId} highlight={highlight} />
      ))}

      {layout.nodes.map((p) => (
        <Node
          key={p.node.id}
          placed={p}
          state={nodeState(p.node, highlight)}
          selected={selectedId === p.node.id}
          hovered={hovered === p.node.id}
          showLabel={
            showAllLabels ||
            p.node.kind === "INFRASTRUCTURE" ||
            hovered === p.node.id ||
            selectedId === p.node.id ||
            nodeState(p.node, highlight) !== "normal"
          }
          onHover={setHovered}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        minDistance={camDist * 0.45}
        maxDistance={camDist * 1.6}
        maxPolarAngle={Math.PI * 0.46}
        target={[0, 0.8, 0]}
      />
    </Canvas>
  );
}

function Ground({ radius }: { radius: number }) {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(radius * 2.4, 36, "#12303A", "#0B1A22");
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.55;
    return g;
  }, [radius]);
  return (
    <group>
      <primitive object={grid} position={[0, -0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <ringGeometry args={[radius - 0.04, radius, 96]} />
        <meshBasicMaterial color="#22D3EE" transparent opacity={0.25} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <ringGeometry args={[radius * 0.5 - 0.02, radius * 0.5, 96]} />
        <meshBasicMaterial color="#22D3EE" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function Node({
  placed,
  state,
  selected,
  hovered,
  showLabel,
  onHover,
  onSelect,
}: {
  placed: PlacedNode;
  state: NodeVisualState;
  selected: boolean;
  hovered: boolean;
  showLabel: boolean;
  onHover: (id: string | null) => void;
  onSelect?: (id: string | null) => void;
}) {
  const { node, pos, hostId } = placed;
  const mesh = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const color = STATE_COLOR[state];
  const size = CRIT_SIZE[node.criticality] ?? 0.27;
  const isInfra = node.kind === "INFRASTRUCTURE";
  const alarm = state === "origin" || state === "affected" || state === "failed";
  const phase = useMemo(() => (pos[0] * 13.1 + pos[2] * 7.3) % (Math.PI * 2), [pos]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (mesh.current) {
      mesh.current.rotation.y = t * (isInfra ? 0.4 : 0.8) + phase;
      const pulse = alarm ? 1 + Math.sin(t * 5 + phase) * 0.12 : 1;
      const s = (selected || hovered ? 1.25 : 1) * pulse;
      mesh.current.scale.setScalar(s);
    }
    if (ring.current) {
      const k = ((t * 0.9 + phase) % 1.6) / 1.6;
      ring.current.scale.setScalar(1 + k * 3.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6;
    }
  });

  return (
    <group position={pos}>
      {/* host stalk from service down to its infrastructure */}
      {hostId && (
        <mesh position={[0, -pos[1] / 2, 0]}>
          <cylinderGeometry args={[0.01, 0.01, pos[1], 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} />
        </mesh>
      )}
      {isInfra && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <ringGeometry args={[size * 1.5, size * 1.7, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      {alarm && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.1, size * 1.25, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <mesh
        ref={mesh}
        position={[0, isInfra ? size : 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(node.id);
        }}
      >
        {isInfra ? <octahedronGeometry args={[size, 0]} /> : <icosahedronGeometry args={[size * 0.75, 0]} />}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={alarm ? 1.6 : selected ? 1.2 : 0.55}
          roughness={0.35}
          metalness={0.2}
          wireframe={!isInfra && state === "normal"}
        />
      </mesh>
      {showLabel && (
        <Html position={[0, (isInfra ? size * 2 : size) + 0.35, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div
            style={{ pointerEvents: "none" }}
            className="whitespace-nowrap border bg-[#03060Acc] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
          >
            <span style={{ color }}>{isInfra ? "▲" : "●"}</span>{" "}
            <span className={alarm ? "text-ink" : "text-ink/75"}>{node.name}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Edge({
  edge,
  layout,
  highlight,
}: {
  edge: GraphEdge;
  layout: Map<string, PlacedNode>;
  highlight: HighlightInput | null;
}) {
  const a = layout.get(edge.source)!;
  const b = layout.get(edge.target)!;
  const sa = nodeState(a.node, highlight);
  const sb = nodeState(b.node, highlight);
  const hot = sa !== "normal" && sa !== "degraded" && sb !== "normal";
  const warm = !hot && (sa !== "normal" || sb !== "normal");

  const points = useMemo(() => {
    const start = new THREE.Vector3(...a.pos);
    const end = new THREE.Vector3(...b.pos);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += edge.implicit ? 0.2 : 0.6 + start.distanceTo(end) * 0.12;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(24);
  }, [a.pos, b.pos, edge.implicit]);

  const color = hot ? "#FF4D5E" : warm ? "#F5A524" : edge.implicit ? "#1E4A5A" : "#22D3EE";
  const opacity = hot ? 0.95 : warm ? 0.6 : edge.implicit ? 0.35 : 0.32;
  const width = hot ? 2.2 : edge.strength === "CRITICAL" ? 1.4 : 1;

  return (
    <group>
      <Line points={points} color={color} lineWidth={width} transparent opacity={opacity} />
      {!edge.implicit && <FlowParticle points={points} color={color} speed={hot ? 0.9 : 0.25} />}
      {hot && <FlowParticle points={points} color={color} speed={0.9} offset={0.5} />}
    </group>
  );
}

function FlowParticle({
  points,
  color,
  speed,
  offset = 0,
}: {
  points: THREE.Vector3[];
  color: string;
  speed: number;
  offset?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const seed = useMemo(() => (points[0].x * 3.7 + points[0].z * 1.3) % 1, [points]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (((clock.elapsedTime * speed + seed + offset) % 1) + 1) % 1;
    curve.getPointAt(t, ref.current.position);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
