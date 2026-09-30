"""Dependency graph management and cascading-impact analysis.

Edge semantics: ``source -> target`` means *target depends on source*.
Impact therefore propagates **downstream** along edges. A service hosted on
an asset (``service.infrastructure_id``) is treated as an implicit CRITICAL
edge ``asset -> service`` unless an explicit edge already exists.

Propagation is a best-first search maximising the product of edge weights
(LOW 0.25, MEDIUM 0.5, HIGH 0.75, CRITICAL 1.0). Nodes whose cumulative
weight drops below ``MIN_PROPAGATION_WEIGHT`` or that are deeper than
``MAX_PROPAGATION_DEPTH`` are not considered affected. Ties are broken by
name so results are fully deterministic.
"""

from __future__ import annotations

import heapq
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.errors import ConflictError, DomainValidationError, NotFoundError
from apps.api.schemas.common import Page
from apps.api.schemas.dependency import (
    DependencyCreate,
    DependencyGraphResponse,
    DependencyResponse,
    GraphEdge,
    GraphNode,
    ImpactNode,
    InfrastructureDependenciesResponse,
    NodeRef,
)
from apps.api.services.audit_service import AuditService
from packages.common.constants import (
    HOSTED_SERVICE_WEIGHT,
    MAX_PROPAGATION_DEPTH,
    MIN_PROPAGATION_WEIGHT,
)
from packages.common.enums import (
    AuditAction,
    DependencyStrength,
    DependencyType,
    EntityKind,
    ImpactRelationship,
)
from packages.common.utils import level_weight
from packages.database.models import Dependency, Infrastructure, PublicService, User
from packages.database.repositories import DependencyRepository, InfrastructureRepository, ServiceRepository

NodeKey = tuple[EntityKind, uuid.UUID]


@dataclass(frozen=True, slots=True)
class GraphEdgeData:
    edge_id: str
    source: NodeKey
    target: NodeKey
    dependency_type: str
    strength: str
    implicit: bool

    @property
    def weight(self) -> float:
        return HOSTED_SERVICE_WEIGHT if self.implicit else level_weight(self.strength)


@dataclass
class DependencyGraph:
    infrastructure: dict[uuid.UUID, Infrastructure]
    services: dict[uuid.UUID, PublicService]
    outgoing: dict[NodeKey, list[GraphEdgeData]] = field(default_factory=dict)
    incoming: dict[NodeKey, list[GraphEdgeData]] = field(default_factory=dict)

    def node(self, key: NodeKey) -> Infrastructure | PublicService | None:
        kind, node_id = key
        return self.infrastructure.get(node_id) if kind == EntityKind.INFRASTRUCTURE else self.services.get(node_id)

    def add_edge(self, edge: GraphEdgeData) -> None:
        self.outgoing.setdefault(edge.source, []).append(edge)
        self.incoming.setdefault(edge.target, []).append(edge)

    def edges(self) -> list[GraphEdgeData]:
        return [e for edges in self.outgoing.values() for e in edges]


@dataclass(frozen=True, slots=True)
class ImpactOrigin:
    key: NodeKey
    weight: float = 1.0
    relationship: ImpactRelationship = ImpactRelationship.ORIGIN
    distance_m: float | None = None


def node_type(node: Infrastructure | PublicService) -> str:
    return str(node.infrastructure_type if isinstance(node, Infrastructure) else node.service_type)


def node_kind(node: Infrastructure | PublicService) -> EntityKind:
    return EntityKind.INFRASTRUCTURE if isinstance(node, Infrastructure) else EntityKind.SERVICE


def _dep_key(dep: Dependency) -> tuple[NodeKey, NodeKey]:
    src: NodeKey = (
        (EntityKind.INFRASTRUCTURE, dep.source_infrastructure_id)
        if dep.source_infrastructure_id
        else (EntityKind.SERVICE, dep.source_service_id)  # type: ignore[assignment]
    )
    tgt: NodeKey = (
        (EntityKind.INFRASTRUCTURE, dep.target_infrastructure_id)
        if dep.target_infrastructure_id
        else (EntityKind.SERVICE, dep.target_service_id)  # type: ignore[assignment]
    )
    return src, tgt


def build_graph(
    infrastructure: list[Infrastructure], services: list[PublicService], dependencies: list[Dependency]
) -> DependencyGraph:
    graph = DependencyGraph(infrastructure={i.id: i for i in infrastructure}, services={s.id: s for s in services})
    explicit_pairs: set[tuple[NodeKey, NodeKey]] = set()
    for dep in dependencies:
        src, tgt = _dep_key(dep)
        if graph.node(src) is None or graph.node(tgt) is None:
            continue
        explicit_pairs.add((src, tgt))
        graph.add_edge(
            GraphEdgeData(
                edge_id=str(dep.id),
                source=src,
                target=tgt,
                dependency_type=str(dep.dependency_type),
                strength=str(dep.strength),
                implicit=False,
            )
        )
    for svc in sorted(services, key=lambda s: str(s.id)):
        if svc.infrastructure_id and svc.infrastructure_id in graph.infrastructure:
            src = (EntityKind.INFRASTRUCTURE, svc.infrastructure_id)
            tgt = (EntityKind.SERVICE, svc.id)
            if (src, tgt) in explicit_pairs:
                continue
            graph.add_edge(
                GraphEdgeData(
                    edge_id=f"hosted:{svc.infrastructure_id}:{svc.id}",
                    source=src,
                    target=tgt,
                    dependency_type=DependencyType.SERVICE_DELIVERY.value,
                    strength=DependencyStrength.CRITICAL.value,
                    implicit=True,
                )
            )
    return graph


def propagate_impact(
    graph: DependencyGraph,
    origins: list[ImpactOrigin],
    *,
    min_weight: float = MIN_PROPAGATION_WEIGHT,
    max_depth: int = MAX_PROPAGATION_DEPTH,
) -> list[dict[str, Any]]:
    """Return affected nodes (origins first) as JSON-ready dicts."""
    best: dict[NodeKey, dict[str, Any]] = {}
    heap: list[tuple[float, int, str, NodeKey]] = []

    for origin in origins:
        node = graph.node(origin.key)
        if node is None:
            continue
        existing = best.get(origin.key)
        if existing and existing["impact_weight"] >= origin.weight:
            continue
        best[origin.key] = {
            "key": origin.key,
            "weight": origin.weight,
            "depth": 0,
            "relationship": origin.relationship.value,
            "edge": None,
            "path": [node.name],
            "distance_m": origin.distance_m,
            "impact_weight": origin.weight,
        }
        heapq.heappush(heap, (-origin.weight, 0, node.name, origin.key))

    visited: set[NodeKey] = set()
    while heap:
        neg_w, depth, _name, key = heapq.heappop(heap)
        if key in visited:
            continue
        visited.add(key)
        current = best[key]
        if depth >= max_depth:
            continue
        for edge in sorted(graph.outgoing.get(key, []), key=lambda e: e.edge_id):
            target = graph.node(edge.target)
            if target is None:
                continue
            weight = -neg_w * edge.weight
            if weight < min_weight - 1e-9:
                continue
            prev = best.get(edge.target)
            if prev is not None and (
                prev["weight"] > weight or (prev["weight"] == weight and prev["depth"] <= depth + 1)
            ):
                continue
            if edge.target in visited:
                continue
            best[edge.target] = {
                "key": edge.target,
                "weight": weight,
                "depth": depth + 1,
                "relationship": (
                    ImpactRelationship.HOSTED_SERVICE.value if edge.implicit else ImpactRelationship.DEPENDENCY.value
                ),
                "edge": edge,
                "path": [*current["path"], target.name],
                "distance_m": None,
                "impact_weight": weight,
            }
            heapq.heappush(heap, (-weight, depth + 1, target.name, edge.target))

    results: list[dict[str, Any]] = []
    for key, info in best.items():
        node = graph.node(key)
        assert node is not None
        edge: GraphEdgeData | None = info["edge"]
        results.append(
            {
                "id": str(node.id),
                "kind": node_kind(node).value,
                "name": node.name,
                "type": node_type(node),
                "criticality": str(node.criticality),
                "status": str(node.status),
                "previous_status": str(node.status),
                "relationship": info["relationship"],
                "depth": info["depth"],
                "impact_weight": round(info["weight"], 4),
                "dependency_type": edge.dependency_type if edge else None,
                "dependency_strength": edge.strength if edge else None,
                "path": info["path"],
                "distance_m": round(info["distance_m"], 1) if info["distance_m"] is not None else None,
            }
        )
    rel_rank = {"ORIGIN": 0, "DIRECT_EXPOSURE": 1, "DEPENDENCY": 2, "HOSTED_SERVICE": 2}
    results.sort(key=lambda r: (rel_rank.get(r["relationship"], 3), -r["impact_weight"], r["depth"], r["name"]))
    return results


def split_by_kind(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    infra = [i for i in items if i["kind"] == EntityKind.INFRASTRUCTURE.value]
    services = [i for i in items if i["kind"] == EntityKind.SERVICE.value]
    return infra, services


class DependencyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = DependencyRepository(session)
        self.infra_repo = InfrastructureRepository(session)
        self.service_repo = ServiceRepository(session)
        self.audit = AuditService(session)

    # -- graph ----------------------------------------------------------------
    async def load_graph(self) -> DependencyGraph:
        return build_graph(await self.infra_repo.all(), await self.service_repo.all(), await self.repo.all())

    async def analyze_impact(self, origins: list[ImpactOrigin]) -> list[dict[str, Any]]:
        graph = await self.load_graph()
        return propagate_impact(graph, origins)

    async def graph(self) -> DependencyGraphResponse:
        g = await self.load_graph()
        nodes = [
            GraphNode(
                id=i.id,
                kind=EntityKind.INFRASTRUCTURE,
                name=i.name,
                type=str(i.infrastructure_type),
                status=str(i.status),
                criticality=str(i.criticality),
                organization_id=i.organization_id,
                latitude=i.latitude,
                longitude=i.longitude,
            )
            for i in sorted(g.infrastructure.values(), key=lambda x: x.name)
        ] + [
            GraphNode(
                id=s.id,
                kind=EntityKind.SERVICE,
                name=s.name,
                type=str(s.service_type),
                status=str(s.status),
                criticality=str(s.criticality),
                organization_id=s.organization_id,
            )
            for s in sorted(g.services.values(), key=lambda x: x.name)
        ]
        edges = [
            GraphEdge(
                id=e.edge_id,
                source=e.source[1],
                target=e.target[1],
                dependency_type=e.dependency_type,
                strength=e.strength,
                implicit=e.implicit,
            )
            for e in sorted(g.edges(), key=lambda e: e.edge_id)
        ]
        return DependencyGraphResponse(nodes=nodes, edges=edges)

    # -- CRUD -----------------------------------------------------------------
    async def create(self, data: DependencyCreate, user: User) -> DependencyResponse:
        for attr, repo, label in (
            ("source_infrastructure_id", self.infra_repo, "Source infrastructure"),
            ("target_infrastructure_id", self.infra_repo, "Target infrastructure"),
            ("source_service_id", self.service_repo, "Source service"),
            ("target_service_id", self.service_repo, "Target service"),
        ):
            value = getattr(data, attr)
            if value is not None and await repo.get(value) is None:
                raise DomainValidationError(f"{label} {value} does not exist", code="INVALID_REFERENCE")
        if await self.repo.find_duplicate(
            source_infrastructure_id=data.source_infrastructure_id,
            source_service_id=data.source_service_id,
            target_infrastructure_id=data.target_infrastructure_id,
            target_service_id=data.target_service_id,
            dependency_type=data.dependency_type,
        ):
            raise ConflictError("This dependency already exists")
        dep = await self.repo.create(**data.model_dump())
        self.audit.record(
            AuditAction.DEPENDENCY_CREATED,
            "dependency",
            dep.id,
            user_id=user.id,
            details={"dependency_type": str(dep.dependency_type), "strength": str(dep.strength)},
        )
        await self.session.commit()
        return (await self._to_responses([dep]))[0]

    async def get(self, dep_id: uuid.UUID) -> DependencyResponse:
        dep = await self.repo.get(dep_id)
        if dep is None:
            raise NotFoundError("Dependency not found")
        return (await self._to_responses([dep]))[0]

    async def list(
        self,
        *,
        infrastructure_id: uuid.UUID | None,
        service_id: uuid.UUID | None,
        dependency_type: DependencyType | None,
        strength: DependencyStrength | None,
        limit: int,
        offset: int,
    ) -> Page[DependencyResponse]:
        items, total = await self.repo.list(
            infrastructure_id=infrastructure_id,
            service_id=service_id,
            dependency_type=dependency_type,
            strength=strength,
            limit=limit,
            offset=offset,
        )
        return Page[DependencyResponse](items=await self._to_responses(items), total=total, limit=limit, offset=offset)

    async def for_infrastructure(self, infra_id: uuid.UUID) -> InfrastructureDependenciesResponse:
        infra = await self.infra_repo.get(infra_id)
        if infra is None:
            raise NotFoundError("Infrastructure not found")
        graph = await self.load_graph()
        key: NodeKey = (EntityKind.INFRASTRUCTURE, infra_id)
        all_deps = await self.repo.all()
        upstream = [d for d in all_deps if d.target_infrastructure_id == infra_id]
        downstream = [d for d in all_deps if d.source_infrastructure_id == infra_id]
        hosted = sorted((s for s in graph.services.values() if s.infrastructure_id == infra_id), key=lambda s: s.name)
        impact = [i for i in propagate_impact(graph, [ImpactOrigin(key=key)]) if i["relationship"] != "ORIGIN"]
        infra_items, svc_items = split_by_kind(impact)
        return InfrastructureDependenciesResponse(
            infrastructure_id=infra_id,
            upstream=await self._to_responses(upstream, graph),
            downstream=await self._to_responses(downstream, graph),
            hosted_services=[self._ref(s) for s in hosted],
            affected_infrastructure=[ImpactNode.model_validate(i) for i in infra_items],
            affected_services=[ImpactNode.model_validate(i) for i in svc_items],
        )

    # -- helpers --------------------------------------------------------------
    @staticmethod
    def _ref(node: Infrastructure | PublicService) -> NodeRef:
        return NodeRef(
            id=node.id,
            kind=node_kind(node),
            name=node.name,
            type=node_type(node),
            status=str(node.status),
            criticality=str(node.criticality),
        )

    async def _to_responses(
        self, deps: list[Dependency], graph: DependencyGraph | None = None
    ) -> list[DependencyResponse]:
        if graph is None:
            infra_ids = {i for d in deps for i in (d.source_infrastructure_id, d.target_infrastructure_id) if i}
            svc_ids = {i for d in deps for i in (d.source_service_id, d.target_service_id) if i}
            infra = {i.id: i for i in await self.infra_repo.get_many(list(infra_ids))}
            svcs = {s.id: s for s in await self.service_repo.get_many(list(svc_ids))}
        else:
            infra, svcs = graph.infrastructure, graph.services

        def ref(infra_id: uuid.UUID | None, svc_id: uuid.UUID | None) -> NodeRef | None:
            node = infra.get(infra_id) if infra_id else svcs.get(svc_id) if svc_id else None
            return self._ref(node) if node else None

        return [
            DependencyResponse(
                id=d.id,
                source_infrastructure_id=d.source_infrastructure_id,
                source_service_id=d.source_service_id,
                target_infrastructure_id=d.target_infrastructure_id,
                target_service_id=d.target_service_id,
                dependency_type=d.dependency_type,
                strength=d.strength,
                description=d.description,
                source=ref(d.source_infrastructure_id, d.source_service_id),
                target=ref(d.target_infrastructure_id, d.target_service_id),
                created_at=d.created_at,
            )
            for d in deps
        ]
