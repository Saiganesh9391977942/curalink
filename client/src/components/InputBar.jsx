import { useEffect, useRef, useState } from "react";
import { Send, Square } from "lucide-react";

export default function InputBar({ onSend, onCancel, isFirst, isLoading }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "50px";
  };

  const handleAction = () => {
    if (isLoading) { onCancel?.(); return; }
    handleSend();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-bar">
      <div className="input-wrapper">
        <div className="input-field-wrap">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isFirst ? "Ask about a condition or symptom…" : "Ask a follow-up question…"}
            rows={1}
            disabled={isLoading}
          />
        </div>
        <button
          className="send-btn"
          onClick={handleAction}
          disabled={!isLoading && !value.trim()}
          title={isLoading ? "Stop response" : "Send"}
          type="button"
        >
          {isLoading
            ? <Square size={17} fill="currentColor" />
            : <Send size={17} />
          }
        </button>
      </div>
      <p className="input-hint">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
