import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import ReportCard from "../components/ReportCard.jsx";
import { getReport } from "../api/client.js";

export default function ReportDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [report, setReport] = useState(location.state?.report || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (report) return;
    getReport(id)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [id, report]);

  return (
    <div className="page">
      <Link to="/">← New validation</Link>
      <h2>Report {id}</h2>
      {error && <p className="error">{error}</p>}
      {!report && !error && <p className="muted">Loading report...</p>}
      <ReportCard report={report} />
    </div>
  );
}
