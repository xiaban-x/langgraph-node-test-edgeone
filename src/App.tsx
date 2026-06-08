import { useState, useMemo } from "react";

const styles = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: "#f7f8fa",
    minHeight: "100vh",
    padding: 24,
  } as const,
  card: {
    maxWidth: 720,
    margin: "0 auto",
    background: "white",
    border: "1px solid #e1e4e8",
    borderRadius: 8,
    padding: 24,
  } as const,
  row: { display: "flex", gap: 8, marginBottom: 12 } as const,
  input: {
    flex: 1,
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #d1d9e0",
    borderRadius: 6,
  } as const,
  btn: (disabled: boolean) =>
    ({
      padding: "10px 18px",
      fontSize: 14,
      background: "#4f46e5",
      color: "white",
      border: "none",
      borderRadius: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    }) as const,
  pre: {
    background: "#0f172a",
    color: "#cbd5e1",
    borderRadius: 6,
    padding: 16,
    fontSize: 12,
    minHeight: 240,
    maxHeight: 600,
    overflow: "auto",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  } as const,
};

export default function App() {
  const [input, setInput] = useState("Say hello world");
  const [log, setLog] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const conversationId = useMemo(() => crypto.randomUUID(), []);

  async function send() {
    if (loading) return;
    setLoading(true);
    setLog("");
    const startedAt = Date.now();
    let raw = "";

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "makers-conversation-id": conversationId,
        },
        body: JSON.stringify({ message: input }),
      });

      if (!res.ok) {
        const text = await res.text();
        setLog(`HTTP ${res.status} (${Date.now() - startedAt}ms)\n\n${text.slice(0, 4000)}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setLog("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        raw += chunk;
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            setLog((prev) => prev + JSON.stringify(evt) + "\n");
          } catch {}
        }
      }

      setLog(
        (prev) =>
          `[${Date.now() - startedAt}ms]\n` + prev + `\n--- raw ---\n${raw.slice(0, 2000)}`
      );
    } catch (e: any) {
      setLog(`Network error: ${e?.message || String(e)}\n\n${raw}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>🧪 LangGraph Minimal Test</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
          Single-node LangGraph + ChatOpenAI on Vite. Mirrors{" "}
          <code>langgraph-quiz-starter</code> structure.
        </p>

        <div style={styles.row}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={loading}
            style={styles.input}
          />
          <button onClick={send} disabled={loading} style={styles.btn(loading)}>
            {loading ? "Calling..." : "POST /chat"}
          </button>
        </div>

        <pre style={styles.pre}>{log || 'Click "POST /chat" to run.'}</pre>
      </div>
    </main>
  );
}
