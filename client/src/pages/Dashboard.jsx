import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listReports } from "../api/client.js";

export default function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    listReports().then(setRuns).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <h2>Dashboard</h2>
      <p className="muted">Trends and history across every run.</p>
      {error && <p className="error">{error}</p>}
      {runs.length === 0 && !error && <p className="muted">No runs yet — start a new validation.</p>}

      <table className="report-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Input</th>
            <th>High</th>
            <th>Med</th>
            <th>Low</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td><Link to={`/reports/${r.id}`}>{new Date(r.createdAt).toLocaleString()}</Link></td>
              <td className="muted small">{r.input.liveUrl || r.input.figmaUrl}</td>
              <td>{r.summary.high}</td>
              <td>{r.summary.med}</td>
              <td>{r.summary.low}</td>
              <td>{r.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
