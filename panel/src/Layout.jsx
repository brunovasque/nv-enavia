import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const BROWSER_PATH = "/browser";

export default function Layout() {
  const { pathname } = useLocation();
  const isBrowser = pathname === BROWSER_PATH;

  return (
    <div style={styles.shell}>
      <Sidebar collapsed={isBrowser} />

      <div style={styles.main}>
        <TopBar />

        <div
          style={{
            ...styles.content,
            ...(isBrowser ? styles.contentBrowser : {}),
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: "var(--bg-base)",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "24px",
    background: "var(--bg-content)",
  },
  contentBrowser: {
    padding: 0,
    overflow: "hidden",
  },
};
