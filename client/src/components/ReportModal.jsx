import { useEffect } from "react";
import Icon from "./Icon.jsx";
import ReportCard from "./ReportCard.jsx";

export default function ReportModal({ report, onClose }) {
  useEffect(() => {
    if (!report) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [report, onClose]);

  if (!report) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Full report</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal-body">
          <ReportCard report={report} showCheckpoints />
        </div>
      </div>
    </div>
  );
}