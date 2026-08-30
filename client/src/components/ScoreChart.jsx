const LABELS = {
  "design-system": "Design system",
  accessibility: "Accessibility",
  workflow: "Workflow",
};

export default function ScoreChart({ dimensionScores }) {
  const entries = Object.entries(dimensionScores || {});
  if (entries.length === 0) return null;

  return (
    <div className="card">
      <h3>Dimension scores</h3>
      <p className="muted small">
        Score = satisfied checkpoints ÷ applicable checkpoints for that dimension, on this
        screen — not a fixed category weight.
      </p>
      {entries.map(([key, s]) => {
        const score = s?.score;
        return (
          <div key={key} className="score-row">
            <div className="score-label">
              <span>{LABELS[key] || key}</span>
              <span>{score === null || score === undefined ? "n/a" : `${score}%`}</span>
            </div>
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{ width: `${score ?? 0}%` }}
              />
            </div>
            <div className="muted small">
              {s?.satisfiedCheckpoints ?? 0} / {s?.applicableCheckpoints ?? 0} checkpoints satisfied
            </div>
          </div>
        );
      })}
    </div>
  );
}
