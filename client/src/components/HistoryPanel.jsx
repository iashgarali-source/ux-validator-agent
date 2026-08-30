import { useEffect, useState } from "react";
import { listReports, getReport } from "../api/client.js";
import { useReportModal } from "../context/ReportModalContext.jsx";
import Icon from "./Icon.jsx";

export default function HistoryPanel({ isOpen, onClose }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { openReport } = useReportModal();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    listReports()
      .then(setRuns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  async function handleSelect(id) {
    try {
      const report = await getReport(id);
      openReport(report);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="history-backdrop" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h3>History</h3>
          <button className="history-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="history-body">
          {loading && <p className="muted small">Loading...</p>}
          {error && <p className="error small">{error}</p>}
          {!loading && !error && runs.length === 0 && (
            <p className="muted small">No runs yet — validations you run will show up here.</p>
          )}

          {runs.map((run) => (
            <button key={run.id} className="history-item" onClick={() => handleSelect(run.id)}>
              <div className="history-item-top">
                <span className={`history-confidence history-confidence--${run.confidence}`} />
                <span className="history-item-time">{new Date(run.createdAt).toLocaleString()}</span>
              </div>
              <div className="history-item-input">
                {run.input?.figmaUrl && <span className="history-tag">Figma</span>}
                {run.input?.liveUrl && <span className="history-tag">Live</span>}
                <span className="history-item-url">
                  {run.input?.liveUrl || run.input?.figmaUrl || "—"}
                </span>
              </div>
              <div className="history-item-counts">
                <span className="hc-high">{run.summary?.high ?? 0} high</span>
                <span className="hc-med">{run.summary?.med ?? 0} med</span>
                <span className="hc-low">{run.summary?.low ?? 0} low</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}