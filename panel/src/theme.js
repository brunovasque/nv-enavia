/* ============================================================================
   ENAVIA — Design Tokens & Theme
   Identidade visual: azul claro/brilhante (#00B4D8) + dark elegante
   ============================================================================ */

export const theme = {
  colors: {
    /* Primary — Enavia Blue */
    primary: "#00B4D8",
    primaryLight: "#48CAE4",
    primaryDark: "#0096B7",
    primaryGlow: "rgba(0, 180, 216, 0.15)",
    primaryBorder: "rgba(0, 180, 216, 0.3)",

    /* Backgrounds — Dark Elegant */
    bgBase: "#0B1120",
    bgSidebar: "#0F172A",
    bgSurface: "#1E293B",
    bgSurfaceHover: "#263548",
    bgTopbar: "#0F172A",
    bgContent: "#111827",

    /* Text */
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",

    /* Borders */
    border: "#1E293B",
    borderLight: "#334155",

    /* Status */
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#00B4D8",
  },

  fonts: {
    body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  },

  radii: {
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
  },

  shadows: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
    md: "0 4px 12px rgba(0, 0, 0, 0.4)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.5)",
    glow: "0 0 20px rgba(0, 180, 216, 0.15)",
  },

  spacing: {
    sidebarWidth: "240px",
    topbarHeight: "56px",
  },
};
