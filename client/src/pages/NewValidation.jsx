import { useState, useRef, useEffect } from "react";
import ChatInputBar from "../components/ChatInputBar.jsx";
import ReportCard from "../components/ReportCard.jsx";
import ReportModal from "../components/ReportModal.jsx";
import { getPlan, runValidation, explainReport } from "../api/client.js";

// const SUGGESTIONS = [
//   "Validate this Figma frame against our design system: https://www.figma.com/design/...",
//   "/design-system https://www.figma.com/design/... — only run the design-system check",
//   "/accessibility https://staging.myapp.com/requests/new — only run accessibility",
// ];

const URL_RE = /https?:\/\/[^\s]+/g;

const SLASH_COMMANDS = {
  "/design-system": "design-system",
  "/design": "design-system",
  "/ds": "design-system",
  "/accessibility": "accessibility",
  "/a11y": "accessibility",
  "/access": "accessibility",
  // "/workflow": "workflow",
  // "/wf": "workflow",
  // "/flow": "workflow",
  "/all": null,
};

const CHECK_LABELS = {
  "design-system": "Design system",
  accessibility: "Accessibility",
  // workflow: "Workflow",
};

function parseCommand(text) {
  const match = text.trim().match(/^(\/\S+)\s*(.*)$/s);
  if (!match) return { command: null, rest: text };

  const token = match[1].toLowerCase();
  if (!(token in SLASH_COMMANDS)) return { command: null, rest: text };

  return { command: SLASH_COMMANDS[token], rest: match[2] };
}

function parseInput(text) {
  const urls = text.match(URL_RE) || [];
  const figmaUrl = urls.find((u) => u.includes("figma.com")) || null;
  const liveUrl = urls.find((u) => !u.includes("figma.com")) || null;
  return { figmaUrl, liveUrl };
}

export default function NewValidation() {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [openReport, setOpenReport] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function pushMessage(msg) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), ...msg }]);
  }

  async function handleSend(text) {
    pushMessage({ role: "user", text });

    const { command, rest } = parseCommand(text);
    const { figmaUrl, liveUrl } = parseInput(rest);

    if (!figmaUrl && !liveUrl) {
      // No URL in this message — if there's already a report in this
      // conversation, treat it as a follow-up question about that report
      // instead of a failed validation request.
      const lastReport = [...messages].reverse().find((m) => m.role === "report")?.report;

      if (lastReport) {
        setBusy(true);
        try {
          const { answer } = await explainReport({ question: text, report: lastReport });
          pushMessage({ role: "assistant", text: answer });
        } catch (err) {
          pushMessage({ role: "error", text: err.message });
        } finally {
          setBusy(false);
        }
        return;
      }

      pushMessage({
        role: "assistant",
        text: "I didn't find a Figma or live page URL in that message — paste a link (optionally after /design-system, /accessibility or /workflow) and I'll validate it.",
      });
      return;
    }

    setBusy(true);
    try {
      const plan = await getPlan({ figmaUrl, liveUrl });
      pushMessage({ role: "plan", plan });

      let checksToRun = plan.applicableChecks;

      if (command) {
        const requested = plan.checks.find((c) => c.id === command);
        if (!requested || !requested.applicable) {
          pushMessage({
            role: "assistant",
            text: `Can't run ${CHECK_LABELS[command]} for this input — ${
              requested ? requested.reason : "unknown check"
            }`,
          });
          setBusy(false);
          return;
        }
        checksToRun = [command];
      }

      pushMessage({
        role: "assistant",
        text: `Running ${checksToRun.length} check${checksToRun.length === 1 ? "" : "s"}: ${checksToRun
          .map((id) => CHECK_LABELS[id])
          .join(", ")}...`,
      });

      const report = await runValidation({ figmaUrl, liveUrl, checks: checksToRun });
      pushMessage({ role: "report", report });
    } catch (err) {
      pushMessage({ role: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-page">
      {isEmpty ? (
        <div className="welcome">
          <div className="welcome-logo">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z" />
            </svg>
          </div>
          <h1>Welcome to UX Validator</h1>
          <p className="welcome-sub">Your AI reviewer for design, accessibility and workflow</p>

          {/* <div className="suggestions">
            <div className="suggestions-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2.05V17h6v-.25c0-.85.4-1.55 1-2.05A7 7 0 0012 2z" />
              </svg>
              <strong>Suggestions</strong>
            </div>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="suggestion-row" onClick={() => handleSend(s)}>
                {s}
              </button>
            ))}
          </div> */}

          <ChatInputBar onSend={handleSend} loading={busy} />
        </div>
      ) : (
        <>
          <div className="chat-feed">
            {messages.map((m) => (
              <MessageBlock key={m.id} message={m} onOpenReport={setOpenReport} />
            ))}
            {busy && <div className="thinking">Working...</div>}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-dock">
            <ChatInputBar onSend={handleSend} loading={busy} placeholder="Ask UX Validator, or /design-system, /accessibility, /workflow" />
          </div>
        </>
      )}

      <ReportModal report={openReport} onClose={() => setOpenReport(null)} />
    </div>
  );
}

function MessageBlock({ message, onOpenReport }) {
  if (message.role === "user") {
    return <div className="bubble user">{message.text}</div>;
  }
  if (message.role === "assistant") {
    return <div className="bubble assistant">{message.text}</div>;
  }
  if (message.role === "error") {
    return <div className="bubble error">{message.text}</div>;
  }
  if (message.role === "plan") {
    return (
      <div className="bubble assistant plan-bubble">
        <strong>Plan</strong>
        <ul className="plan-list">
          {message.plan.checks.map((c) => (
            <li key={c.id} className={c.applicable ? "applicable" : "skipped"}>
              <span className="dot" />
              <div>
                <strong>{c.label}</strong>
                <div className="muted small">{c.reason}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (message.role === "report") {
    return (
      <div className="bubble assistant">
        <ReportCard report={message.report} />
        <button className="open-report-link" onClick={() => onOpenReport(message.report)}>
          Open full report →
        </button>
      </div>
    );
  }
  return null;
}