import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ShieldCheck } from "lucide-react";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import "./index.css";

let nextId = 0;
const uid = () => `msg-${Date.now()}-${++nextId}`;

function App() {
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState("checking");
  const abortRef = useRef(null);

  const sessionId = useMemo(() => {
    const existing = localStorage.getItem("curalink-session-id");
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem("curalink-session-id", created);
    return created;
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => setHealth(res.ok ? "online" : "offline"))
      .catch(() => setHealth("offline"));

    return () => abortRef.current?.abort();
  }, []);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (userText) => {
      if (isLoading) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg = { id: uid(), role: "user", content: userText };
      setError(null);
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disease: userText,
            query: userText,
            publications: [],
            trials: [],
            chat_history: chatHistory,
            sessionId,
          }),
          signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || "The server could not answer.");
        }

        const assistantMsg = { id: uid(), role: "assistant", content: payload };
        setMessages((prev) => [...prev, assistantMsg]);
        setChatHistory((prev) => [
          ...prev,
          { role: "user", content: userText },
          { role: "assistant", content: JSON.stringify(payload) },
        ]);
      } catch (err) {
        if (err.name === "AbortError") return;
        setMessages((prev) => prev.filter((msg) => msg.id !== userMsg.id));
        setError(err.message || "Something went wrong.");
      } finally {
        setIsLoading(false);
      }
    },
    [chatHistory, isLoading, sessionId]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon" aria-hidden="true">
            <Activity size={18} />
          </div>
          <div>
            <span className="brand-name">CuraLink</span>
            <span className="brand-subtitle">medical research assistant</span>
          </div>
        </div>
        <div className={`header-status ${health}`}>
          <span className="status-dot" />
          <ShieldCheck size={14} />
          {health === "online" ? "Ready" : health === "offline" ? "Check services" : "Checking"}
        </div>
      </header>

      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        error={error}
        onClearError={() => setError(null)}
        onChipSelect={sendMessage}
      />

      <InputBar
        onSend={sendMessage}
        onCancel={cancelRequest}
        isFirst={messages.length === 0}
        isLoading={isLoading}
      />
    </div>
  );
}

export default App;
