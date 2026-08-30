import { useState } from "react";
import Icon from "./Icon.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import logo from "./o9.png";

export default function Sidebar() {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <aside className="sidebar">
      <img src={logo} alt="Logo" className="sidebar-logo" />
      <button className="sidebar-icon" aria-label="Menu">
        <Icon name="bars" size={20} />
      </button>
      <div className="sidebar-spacer" />
      <button
        className="sidebar-icon"
        aria-label="History"
        onClick={() => setHistoryOpen(true)}
      >
        <Icon name="history" size={20} />
      </button>

      <HistoryPanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </aside>
  );
}