import Icon from "./Icon.jsx";

export default function Topbar({ crumb = "Chat" }) {
  return (
    <div className="topbar topbar--brand">
      <div className="topbar-left">
        <button className="icon-btn icon-btn--on-brand" aria-label="Back">
          <Icon name="chevron-left" size={20} />
        </button>
        <span className="crumb crumb--on-brand">
          <strong>UX Validator</strong>
        </span>
      </div>
      <div className="topbar-right">
        <button className="icon-btn icon-btn--on-brand" aria-label="Notes">
          <Icon name="notes" size={20} />
        </button>
        <button className="icon-btn icon-btn--on-brand" aria-label="Refresh">
          <Icon name="refresh" size={20} />
        </button>
        <div className="avatar">U</div>
      </div>
    </div>
  );
}