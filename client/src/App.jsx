import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import ReportModal from "./components/ReportModal.jsx";
import NewValidation from "./pages/NewValidation.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { ReportModalProvider, useReportModal } from "./context/ReportModalContext.jsx";

const CRUMBS = {
  "/": "Chat",
  "/dashboard": "Dashboard",
};

function AppShell() {
  const location = useLocation();
  const crumb = CRUMBS[location.pathname] || "Report";
  const { openReportData, closeReport } = useReportModal();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar crumb={crumb} />
        <main>
          <Routes>
            <Route path="/" element={<NewValidation />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports/:id" element={<ReportDetail />} />
          </Routes>
        </main>
      </div>

      {/* Rendered once, here — both the chat page's "Open full report"
          links and the sidebar History panel share this same modal via
          context, so opening a history item never navigates away. */}
      <ReportModal report={openReportData} onClose={closeReport} />
    </div>
  );
}

export default function App() {
  return (
    <ReportModalProvider>
      <AppShell />
    </ReportModalProvider>
  );
}