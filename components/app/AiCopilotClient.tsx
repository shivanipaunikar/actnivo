"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Array<{ label: string; href: string }>;
  mode?: "ai" | "deterministic";
};

const prompts = [
  "What should I focus on today?",
  "Show my highest revenue risks",
  "Which POs will arrive too late?",
  "Where should inventory be rebalanced?",
  "How is Blinkit performing?",
  "Show actions waiting for attention",
];

export function AiCopilotClient({ aiConfigured }: { aiConfigured: boolean }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    const value = text.trim();
    if (!value || loading) return;
    setError(null);
    setQuestion("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: value }]);
    setLoading(true);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Copilot could not answer that question.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant", text: payload.answer,
        sources: payload.sources ?? [], mode: payload.mode,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Copilot could not answer that question.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return <div className="copilot-shell">
    <section className="copilot-main product-card">
      <header className="copilot-head">
        <div><small>ACTNIVO INTELLIGENCE</small><h2>Ask Actnivo</h2><p>Grounded in your inventory, forecasts, quick commerce, purchase orders, issues, actions and verified value.</p></div>
        <span className={aiConfigured ? "copilot-mode live" : "copilot-mode"}>{aiConfigured ? "AI + deterministic tools" : "Deterministic mode"}</span>
      </header>

      {!messages.length ? <div className="copilot-empty">
        <div className="copilot-orb">✦</div>
        <h3>What is happening in your commerce operation?</h3>
        <p>Actnivo uses your normalized operating data for the numbers. AI explains the result; it does not invent the calculations.</p>
        <div className="copilot-prompts">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => void ask(prompt)}>{prompt}<span>→</span></button>)}</div>
      </div> : <div className="copilot-thread" aria-live="polite">
        {messages.map((message) => <article key={message.id} className={`copilot-message ${message.role}`}>
          <div className="copilot-avatar">{message.role === "assistant" ? "✦" : "You"}</div>
          <div className="copilot-bubble">
            {message.role === "assistant" && <small>{message.mode === "ai" ? "AI COPILOT · GROUNDED" : "ACTNIVO · DETERMINISTIC"}</small>}
            <p>{message.text}</p>
            {!!message.sources?.length && <div className="copilot-sources">{message.sources.map((source) => <Link key={source.href} href={source.href}>{source.label} →</Link>)}</div>}
          </div>
        </article>)}
        {loading && <article className="copilot-message assistant"><div className="copilot-avatar">✦</div><div className="copilot-bubble"><small>ACTNIVO</small><p>Reading your operating data…</p></div></article>}
      </div>}

      {error && <p className="product-alert error">{error}</p>}
      <form className="copilot-composer" onSubmit={submit}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about stockouts, POs, transfers, quick commerce, actions or revenue risk…" maxLength={1200} rows={3} disabled={loading} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (question.trim()) void ask(question);
          }
        }} />
        <div><span>Enter to send · Shift + Enter for a new line</span><button className="saas-primary" type="submit" disabled={loading || !question.trim()}>{loading ? "Thinking…" : "Ask Actnivo"}</button></div>
      </form>
    </section>

    <aside className="copilot-guardrails product-card compact">
      <small>HOW COPILOT WORKS</small>
      <h3>AI explains. Actnivo calculates.</h3>
      <p>Critical numbers come from deterministic commerce engines, not the language model.</p>
      <div><strong>Grounded</strong><span>Organization-scoped operating data only</span></div>
      <div><strong>No fake execution</strong><span>External actions still use approval and verification</span></div>
      <div><strong>Missing data stays missing</strong><span>Disconnected availability is never guessed</span></div>
      <Link href="/app/ops">Open Ops Inbox →</Link>
    </aside>
  </div>;
}
