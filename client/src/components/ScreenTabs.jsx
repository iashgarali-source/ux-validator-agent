export default function ScreenTabs({ runs, activeId, onSelect }) {
  if (!runs || runs.length === 0) return null;

  return (
    <div className="tabs">
      {runs.map((r) => (
        <button
          key={r.id}
          className={`tab ${r.id === activeId ? "active" : ""}`}
          onClick={() => onSelect(r.id)}
        >
          {new Date(r.createdAt).toLocaleTimeString()} · {r.summary.totalIssues} issues
        </button>
      ))}
    </div>
  );
}
