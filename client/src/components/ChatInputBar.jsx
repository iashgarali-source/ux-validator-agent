import { useState } from "react";
import Icon from "./Icon.jsx";

export default function ChatInputBar({ onSend, loading, placeholder = "Ask UX Validator" }) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim() || loading) return;
    onSend(value.trim());
    setValue("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-bar">
        <textarea
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="chat-textarea"
        />

        <div className="chat-input-row">
          <div className="chat-input-actions-left">
            <button type="button" aria-label="Attach" className="icon-btn">
              <Icon name="paperclip" size={20} />
            </button>

            <button type="button" aria-label="Voice" className="icon-btn">
              <Icon name="microphone" size={20} />
            </button>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || loading}
            aria-label="Send"
            className="send-btn"
          >
            <Icon name="arrow-up" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}