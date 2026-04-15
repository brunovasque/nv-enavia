import { NavLink, useLocation } from "react-router-dom";
import { useNotificationStore } from "./notifications/notificationStore";

const NAV_ITEMS = [
  { path: "/chat",      label: "Chat",      icon: "💬" },
  { path: "/plan",      label: "Plano",     icon: "📋" },
  { path: "/memory",    label: "Memória",   icon: "🧠" },
  { path: "/execution", label: "Execução",  icon: "⚡" },
  { path: "/contract",  label: "Contrato",  icon: "📜" },
  { path: "/health",    label: "Saúde",     icon: "◆", badge: "P22" },
  { path: "/browser",   label: "Browser",   icon: "🌐" },
];

export default function Sidebar({ collapsed }) {
  const { pathname } = useLocation();
  const { unreadCount } = useNotificationStore();

  return (
    <aside
      style={{
        ...styles.sidebar,
        ...(collapsed ? styles.sidebarCollapsed : {}),
      }}
    >
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoIcon}>◆</span>
        {!collapsed && <span style={styles.logoText}>ENAVIA</span>}
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map(({ path, label, icon, badge }) => {
          const isActive = pathname === path;
          const isBrowserItem = path === "/browser";

          return (
            <NavLink
              key={path}
              to={path}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                ...(isBrowserItem && !collapsed ? styles.navItemBrowser : {}),
                ...(isBrowserItem && isActive ? styles.navItemBrowserActive : {}),
              }}
              title={label}
            >
              <span style={styles.navIcon}>{icon}</span>
              {!collapsed && (
                <span style={styles.navLabel}>{label}</span>
              )}
              {badge && !collapsed && (
                <span style={styles.browserBadge}>{badge}</span>
              )}
              {isBrowserItem && !collapsed && (
                <span style={styles.browserBadge}>CORE</span>
              )}
              {/* P25-PR5: unread notification badge — real events only */}
              {isBrowserItem && unreadCount > 0 && (
                <span
                  style={styles.notifBadge}
                  data-testid="browser-notif-badge"
                  title={`${unreadCount} notificação(ões) do Browser Arm`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={styles.footer}>
          <span style={styles.footerText}>Enavia v0.1</span>
        </div>
      )}
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "var(--sidebar-width)",
    minWidth: "var(--sidebar-width)",
    height: "100vh",
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.2s ease, min-width 0.2s ease",
    overflow: "hidden",
  },
  sidebarCollapsed: {
    width: "60px",
    minWidth: "60px",
  },
  logo: {
    height: "var(--topbar-height)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 16px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  logoIcon: {
    color: "var(--color-primary)",
    fontSize: "20px",
    fontWeight: 700,
  },
  logoText: {
    color: "var(--text-primary)",
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "2px",
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "12px 8px",
    overflowY: "auto",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "var(--radius-md)",
    color: "var(--text-secondary)",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 500,
    transition: "all 0.15s ease",
    cursor: "pointer",
    border: "1px solid transparent",
  },
  navItemActive: {
    background: "var(--color-primary-glow)",
    color: "var(--color-primary)",
    borderColor: "var(--color-primary-border)",
  },
  navItemBrowser: {
    marginTop: "8px",
    paddingTop: "12px",
    borderTop: "1px solid var(--border)",
  },
  navItemBrowserActive: {
    background: "linear-gradient(135deg, rgba(0,180,216,0.15), rgba(0,180,216,0.08))",
    boxShadow: "0 0 16px rgba(0,180,216,0.1)",
  },
  navIcon: {
    fontSize: "18px",
    width: "24px",
    textAlign: "center",
    flexShrink: 0,
  },
  navLabel: {
    whiteSpace: "nowrap",
  },
  browserBadge: {
    marginLeft: "auto",
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "var(--color-primary)",
    background: "rgba(0,180,216,0.12)",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid var(--color-primary-border)",
  },
  notifBadge: {
    marginLeft: "4px",
    fontSize: "9px",
    fontWeight: 700,
    color: "#fff",
    background: "#EF4444",
    padding: "2px 5px",
    borderRadius: "10px",
    minWidth: "16px",
    textAlign: "center",
    lineHeight: 1.4,
    flexShrink: 0,
  },
  footer: {
    padding: "12px 16px",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  footerText: {
    fontSize: "11px",
    color: "var(--text-muted)",
  },
};
