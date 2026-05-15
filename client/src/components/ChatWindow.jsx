import { createElement, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Beaker,
  BookOpen,
  Brain,
  ClipboardList,
  HeartPulse,
  Lightbulb,
  X,
} from "lucide-react";

function safeStr(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

const sections = [
  { key: "condition_overview",    label: "Condition Overview", icon: HeartPulse, cls: "icon-overview" },
  { key: "research_insights",     label: "Research Insights",  icon: BookOpen,   cls: "icon-research" },
  { key: "clinical_trials_summary", label: "Clinical Trials", icon: Beaker,     cls: "icon-trials" },
  { key: "recommendations",       label: "Recommendations",    icon: Lightbulb,  cls: "icon-recommendations" },
  { key: "disclaimer",            label: "Medical Disclaimer", icon: AlertTriangle, cls: "icon-warning" },
];

function StructuredResponse({ data }) {
  if (typeof data !== "object" || data === null) {
    return (
      <div className="response-card">
        <div className="response-section">
          <p className="section-body">{safeStr(data)}</p>
        </div>
      </div>
    );
  }

  const knownKeys = new Set(sections.map((s) => s.key).concat(["_model"]));
  const extraKeys = Object.keys(data).filter((k) => !knownKeys.has(k) && data[k]);

  return (
    <div className="response-card">
      {sections.map(({ key, label, icon, cls }, index) => {
        const value = safeStr(data[key]);
        if (!value) return null;
        return (
          <section
            className="response-section"
            key={key}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="section-header">
              <div className={`section-icon ${cls}`}>
                {createElement(icon, { size: 15 })}
              </div>
              <span className="section-title">{label}</span>
            </div>
            <p className="section-body">{value}</p>
          </section>
        );
      })}

      {extraKeys.map((key) => (
        <section className="response-section" key={key}>
          <div className="section-header">
            <div className="section-icon icon-overview">
              <ClipboardList size={15} />
            </div>
            <span className="section-title">{key.replace(/_/g, " ")}</span>
          </div>
          <p className="section-body">{safeStr(data[key])}</p>
        </section>
      ))}

      {data._model && (
        <div className="model-chip">Powered by {data._model}</div>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="response-card loading-card">
      <div className="response-section">
        <div className="section-header">
          <div className="section-icon icon-overview pulse">
            <Brain size={15} />
          </div>
          <span className="section-title">Analysing…</span>
        </div>
        <div className="skeleton-lines">
          {[88, 96, 72, 84].map((w) => (
            <span key={w} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorMessage({ message, onClear }) {
  return (
    <div className="message assistant">
      <div className="error-toast">
        <AlertTriangle size={16} />
        <span>{safeStr(message)}</span>
        <button onClick={onClear} type="button" aria-label="Dismiss error">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

const suggestions = [
  "What are early signs of diabetes?",
  "How is hypertension managed?",
  "Migraine relief options",
  "Iron deficiency symptoms",
  "Asthma treatment overview",
  "COVID-19 care guidance",
];

function EmptyState({ onChip }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <HeartPulse size={38} />
      </div>
      <h1 className="empty-title">CuraLink</h1>
      <p className="empty-sub">
        Ask a medical research question and get a structured AI-powered summary with practical next steps.
      </p>
      <div className="suggestion-chips">
        {suggestions.map((s) => (
          <button key={s} className="chip" onClick={() => onChip?.(s)} type="button">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow({
  messages = [],
  isLoading = false,
  error = null,
  onClearError,
  onChipSelect,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  const isEmpty = messages.length === 0 && !isLoading && !error;

  return (
    <main className="chat-window">
      {isEmpty ? (
        <EmptyState onChip={onChipSelect} />
      ) : (
        <>
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              {msg.role === "user" ? (
                <div className="bubble">{safeStr(msg.content)}</div>
              ) : (
                <StructuredResponse data={msg.content} />
              )}
            </div>
          ))}

          {isLoading && (
            <div className="message assistant">
              <LoadingCard />
            </div>
          )}

          {error && <ErrorMessage message={error} onClear={onClearError} />}
        </>
      )}
      <div ref={bottomRef} />
    </main>
  );
}
