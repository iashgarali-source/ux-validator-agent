import { createContext, useContext, useState } from "react";

const ReportModalContext = createContext(null);

export function ReportModalProvider({ children }) {
  const [openReportData, setOpenReportData] = useState(null);

  return (
    <ReportModalContext.Provider
      value={{
        openReportData,
        openReport: (report) => setOpenReportData(report),
        closeReport: () => setOpenReportData(null),
      }}
    >
      {children}
    </ReportModalContext.Provider>
  );
}

export function useReportModal() {
  const ctx = useContext(ReportModalContext);
  if (!ctx) throw new Error("useReportModal must be used inside ReportModalProvider");
  return ctx;
}