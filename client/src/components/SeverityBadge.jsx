const LABELS = {
  high: "HIGH",
  med: "MED",
  low: "LOW",
};

export default function SeverityBadge({ severity }) {
  const key = LABELS[severity] ? severity : "med";
  return <span className={`severity-badge ${key}`}>{LABELS[key]}</span>;
}