import { useState, useEffect } from "react";
import SeverityBadge from "./SeverityBadge.jsx";
import ScoreChart from "./ScoreChart.jsx";

const DIMENSION_LABELS = {
  "design-system": "Design system",
  accessibility: "Accessibility",
  workflow: "Workflow",
};

const SEVERITY_FILTERS = ["all", "high", "med", "low"];

export default function ReportCard({ report, showCheckpoints = false }) {
  const dimensionKeys = Object.keys(report?.dimensionScreenshots || {});
  const [activeOverviewTab, setActiveOverviewTab] = useState(dimensionKeys[0] || null);
  const [severityFilter, setSeverityFilter] = useState(null);
  const [highlightedCheckpoint, setHighlightedCheckpoint] = useState(null);
  const [highlightedHotspot, setHighlightedHotspot] = useState(null);

  useEffect(() => {
    setActiveOverviewTab(dimensionKeys[0] || null);
    setSeverityFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id]);

  if (!report) return null;

  const filteredIssues =
    severityFilter && severityFilter !== "all"
      ? report.issues.filter((i) => i.severity === severityFilter)
      : report.issues;

  // Image -> table: clicking a numbered marker on the overview image jumps
  // to and briefly highlights the matching row in the Issues table below.
  function jumpToIssue(checkpoint) {
    const isVisible = report.issues.some(
      (i) => i.checkpoint === checkpoint && (severityFilter ? i.severity === severityFilter : true)
    );
    if (!isVisible) setSeverityFilter(null);

    setHighlightedCheckpoint(checkpoint);
    const section = document.getElementById("issues-section");
    if (section && !section.open) section.open = true;
    requestAnimationFrame(() => {
      document.getElementById(`issue-row-${checkpoint}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    setTimeout(() => setHighlightedCheckpoint(null), 2000);
  }

  // Table -> image: clicking the #N badge on an ISSUE row scrolls back up
  // to and briefly highlights that marker on the overview image. Switches
  // the dimension tab first if the row belongs to a different dimension
  // than the one currently showing.
  function jumpToImage(checkpoint, category) {
    if (category && category !== activeOverviewTab) {
      setActiveOverviewTab(category);
    }
    setHighlightedHotspot(checkpoint);
    requestAnimationFrame(() => {
      document.getElementById("overview-image-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    setTimeout(() => setHighlightedHotspot(null), 2000);
  }

  return (
    <div className="card">
      <div className="report-header">
        <h3>UX health report</h3>
        <span className={`confidence-pill ${report.confidence}`}>
          Confidence: {report.confidence.toUpperCase()}
        </span>
      </div>

      <div className="summary-row">
        <div><strong>{report.summary.high}</strong><span className="muted small"> high</span></div>
        <div><strong>{report.summary.med}</strong><span className="muted small"> med</span></div>
        <div><strong>{report.summary.low}</strong><span className="muted small"> low</span></div>
        <div><strong>{report.summary.escalated}</strong><span className="muted small"> escalated</span></div>
      </div>

      <ScoreChart dimensionScores={report.dimensionScores} />

      {dimensionKeys.length > 0 && (
        <>
          <h4>Visual overview</h4>
          <p className="muted small">
            Every failure for that dimension, boxed and labeled on one picture of the screen.
            Click a numbered marker to jump to that issue below, or click a #number in the
            Issues table to jump back here.
          </p>

          {dimensionKeys.length > 1 && (
            <div className="tabs">
              {dimensionKeys.map((dim) => (
                <button
                  key={dim}
                  className={`tab ${activeOverviewTab === dim ? "active" : ""}`}
                  onClick={() => setActiveOverviewTab(dim)}
                >
                  {DIMENSION_LABELS[dim] || dim}
                </button>
              ))}
            </div>
          )}

          <div className="overview-item" id="overview-image-anchor">
            {dimensionKeys.length === 1 && (
              <div className="muted small overview-label">
                {DIMENSION_LABELS[dimensionKeys[0]] || dimensionKeys[0]}
              </div>
            )}
            <div className="overview-image-wrap">
              <img
                src={`data:image/png;base64,${report.dimensionScreenshots[activeOverviewTab || dimensionKeys[0]]}`}
                alt={`${DIMENSION_LABELS[activeOverviewTab] || activeOverviewTab} — annotated overview`}
                className="overview-screenshot"
              />
              {(report.dimensionScreenshotHotspots?.[activeOverviewTab || dimensionKeys[0]] || []).map((h) => (
                <button
                  key={h.checkpoint}
                  id={`hotspot-${h.checkpoint}`}
                  className={`overview-hotspot ${h.checkpoint === highlightedHotspot ? "overview-hotspot--highlighted" : ""}`}
                  title={`Jump to issue #${h.rank}`}
                  style={{
                    left: `calc(${h.xPct}% - 14px)`,
                    top: `calc(${h.yPct}% - 34px)`,
                    width: `calc(${h.widthPct}% + 28px)`,
                    height: `calc(${h.heightPct}% + 44px)`,
                  }}
                  onClick={() => jumpToIssue(h.checkpoint)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {report.validatorErrors?.length > 0 && (
        <div className="validator-errors">
          <h4>Checks that could not run</h4>
          {report.validatorErrors.map((e, idx) => (
            <div key={idx} className="validator-error-row">
              <strong>{e.validator}:</strong> {e.error}
            </div>
          ))}
        </div>
      )}

      <details className="issues-section" id="issues-section">
        <summary>
          <span>Issues</span>
          {report.issues.length > 0 && (
            <span className="issues-section-count">{report.issues.length}</span>
          )}
        </summary>

        <div className="issues-section-body">
          {report.issues.length > 0 && (
            <div className="severity-filter-row">
              {SEVERITY_FILTERS.map((key) => {
                const count = key === "all" ? report.issues.length : report.summary[key] || 0;
                const isActive = (severityFilter || "all") === key;
                return (
                  <button
                    key={key}
                    className={`severity-filter-pill ${key} ${isActive ? "active" : ""}`}
                    onClick={() => setSeverityFilter(key === "all" ? null : key)}
                  >
                    {key === "all" ? "All" : key.toUpperCase()} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {report.issues.length === 0 && report.validatorErrors?.length === 0 && (
            <p className="muted">No issues found in the applicable checks.</p>
          )}
          {report.issues.length === 0 && report.validatorErrors?.length > 0 && (
            <p className="muted">No issues to show — the applicable check(s) didn't run. See above.</p>
          )}
          {report.issues.length > 0 && filteredIssues.length === 0 && (
            <p className="muted">No {severityFilter} issues.</p>
          )}

          {filteredIssues.length > 0 && (
            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Category</th>
                    <th>Issue</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssues.map((i, idx) => (
                    <tr
                      key={idx}
                      id={`issue-row-${i.checkpoint}`}
                      className={i.checkpoint === highlightedCheckpoint ? "issue-row-highlighted" : ""}
                    >
                      <td>
                        {i.overviewRank != null && (
                          <button
                            className={`overview-rank-badge overview-rank-badge--clickable ${i.severity}`}
                            title="Jump to this marker on the overview image above"
                            onClick={() => jumpToImage(i.checkpoint, i.category)}
                          >
                            #{i.overviewRank}
                          </button>
                        )}
                        <SeverityBadge severity={i.severity} />
                      </td>
                      <td>{i.category}</td>
                      <td>
                        {i.issue}
                        {i.nodePath && <div className="muted small">📍 {i.nodePath}</div>}
                        {i.figmaLink && (
                          <div className="small">
                            <a href={i.figmaLink} target="_blank" rel="noopener noreferrer">
                              View in Figma →
                            </a>
                          </div>
                        )}
                        {i.elementScreenshotBase64 && (
                          <div className="element-thumbnail-wrap">
                            <img
                              src={`data:image/png;base64,${i.elementScreenshotBase64}`}
                              alt={`Element: ${i.nodePath || "flagged element"}`}
                              className="element-thumbnail"
                            />
                          </div>
                        )}
                      </td>
                      <td className="muted small">{i.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>

      {report.escalations.length > 0 && (
        <>
          <h4>Escalated for designer review</h4>
          <ul>
            {report.escalations.map((e, idx) => (
              <li key={idx}>
                <strong>{e.category}:</strong> {e.escalationQuestion}
              </li>
            ))}
          </ul>
        </>
      )}

      {showCheckpoints && Object.keys(report.checkpointsByCategory || {}).length > 0 && (
        <>
          <h4>What was actually checked</h4>
          <p className="muted small">
            Every checkpoint the agent considered for this screen — including the ones that
            passed, not just the failures above. Only failing rows show an element image.
          </p>
          {Object.entries(report.checkpointsByCategory).map(([category, checkpoints]) => {
            const passCount = checkpoints.filter((c) => c.status === "pass").length;
            return (
              <details key={category} className="checkpoint-group">
                <summary>
                  {category} — {checkpoints.length} checkpoint{checkpoints.length === 1 ? "" : "s"} checked
                  ({passCount} passed)
                </summary>
                <div className="checkpoint-table-wrapper">
                  <table className="checkpoint-table">
                    <thead>
                      <tr>
                        <th>Checkpoint</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkpoints.map((c, idx) => (
                        <tr key={idx} className={`checkpoint-table-row checkpoint-table-row--${c.status}`}>
                          <td className="small">{c.checkpoint}</td>
                          <td className="muted small">
                            {c.figmaLink ? (
                              <a href={c.figmaLink} target="_blank" rel="noopener noreferrer">
                                {c.nodePath || "View →"}
                              </a>
                            ) : (
                              c.nodePath || "—"
                            )}
                          </td>
                          <td>
                            {c.status === "pass" ? (
                              <span className="checkpoint-status checkpoint-status--pass">✓ Pass</span>
                            ) : (
                              <span className="checkpoint-status checkpoint-status--fail">
                                {c.overviewRank != null && (
                                  <span
                                    className={`overview-rank-badge ${c.severity}`}
                                    title="Matches the numbered marker on this dimension's overview image above"
                                  >
                                    #{c.overviewRank}
                                  </span>
                                )}
                                ✕ Fail
                                {c.elementScreenshotBase64 && (
                                  <img
                                    src={`data:image/png;base64,${c.elementScreenshotBase64}`}
                                    alt={`Element: ${c.nodePath || "flagged element"}`}
                                    className="checkpoint-table-thumb"
                                  />
                                )}
                              </span>
                            )}
                          </td>
                          <td className="muted small">
                            {c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </>
      )}

      {!showCheckpoints && Object.keys(report.checkpointsByCategory || {}).length > 0 && (
        <p className="muted small checkpoints-hint">
          Open the full report to see every checkpoint that was checked, pass and fail.
        </p>
      )}
    </div>
  );
}