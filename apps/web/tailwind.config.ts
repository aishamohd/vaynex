import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#03060A",
        panel: "#081018",
        elevated: "#0D1720",
        line: "#1B2A38",
        "line-strong": "#27394A",
        ink: "#EAF2F7",
        muted: "#81919E",
        dim: "#56656F",
        cyan: { DEFAULT: "#22D3EE", soft: "#0E3A45" },
        blue: { DEFAULT: "#3B82F6", soft: "#10243F" },
        amber: { DEFAULT: "#F5A524", soft: "#3A2A0C" },
        red: { DEFAULT: "#FF4D5E", soft: "#3D1117" },
        green: { DEFAULT: "#2BD99F", soft: "#0C3326" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.35), 0 0 24px -6px rgba(34,211,238,0.45)",
        "glow-red": "0 0 0 1px rgba(255,77,94,0.45), 0 0 28px -6px rgba(255,77,94,0.55)",
        "glow-amber": "0 0 0 1px rgba(245,165,36,0.4), 0 0 24px -6px rgba(245,165,36,0.5)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.3" } },
      },
      animation: {
        "pulse-ring": "pulseRing 1.6s cubic-bezier(0.2,0.6,0.4,1) infinite",
        scan: "scan 3s linear infinite",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
