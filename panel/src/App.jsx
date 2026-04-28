import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import ChatPage from "./pages/ChatPage";
import PlanPage from "./pages/PlanPage";
import MemoryPage from "./pages/MemoryPage";
import ExecutionPage from "./pages/ExecutionPage";
import BrowserPage from "./pages/BrowserPage";
import HealthPage from "./pages/HealthPage";
import ContractPage from "./pages/ContractPage";
import LoopPage from "./pages/LoopPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/memory" element={<MemoryPage />} />
        <Route path="/execution" element={<ExecutionPage />} />
        <Route path="/contract" element={<ContractPage />} />
        <Route path="/loop" element={<LoopPage />} />
        <Route path="/browser" element={<BrowserPage />} />
        <Route path="/health" element={<HealthPage />} />
      </Route>
    </Routes>
  );
}
