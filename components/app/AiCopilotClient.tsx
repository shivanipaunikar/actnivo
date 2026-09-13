"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { CopilotActionProposal } from "@/lib/copilot/actions";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Array<{ label: string; href: string }>;
  proposals?: CopilotActionProposal[];
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

const preparationPhrases = ["prepare it", "prepare that", "do it", "fix it", "prepare the action", "prepare this"];

export function AiCopilotClient({ aiConfigured }: { aiConfigured: boolean }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function prepare(proposal: CopilotActionProposal) {
    if (preparing) return;
    setError(null);
    setPreparing(`${proposal.issueId}:${proposal.type}`);
    try {
      const response = await fetch("/api/copilot/actions/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: proposal.issueId, type: proposal.type }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Actnivo could not prepare that action.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `${payload.message} Nothing external has been executed. Review the proposed action and approve it when ready.`,
        sources: [{ label: "Review proposed action", href: payload.href }],
        mode: "deterministic",
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Actnivo could not prepare that action.");
    } finally {
      setPreparing(null);
    }
  }

  async function ask(text: string) {
    const value = text.trim();
    if (!value || loading || preparing) return;
    setError(null);
    setQuestion("");

    const lastProposal = [...messages].reverse().find((message) => message.role === "assistant" && message.proposals?.length)?.proposals?.[0];
    if (lastProposal && preparationPhrases.some((phrase) => value.toLowerCase() === phrase || value.toLowerCase().startsWith(`${phrase} `))) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: value }]);
      await prepare(lastProposal);
      return;
    }

    const history = messages.slice(-8).map((message) => ({ role: message.role, text: message.text }));
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: value }]);
    setLoading(true);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: value, history }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Copilot could not answer that question.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant", text: payload.answer,
        sources: payload.sources ?? [], proposals: payload.proposals ?? [], mode: payload.mode,
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
            {!!message.proposals?.length && <div className="copilot-proposals">{message.proposals.map((proposal) => {
              const key = `${proposal.issueId}:${proposal.type}`;
              return <div key={key} className="copilot-proposal"><div><strong>{proposal.label}</strong><span>{proposal.summary}</span></div><button type="button" onClick={() => void prepare(proposal)} disabled={Boolean(preparing)}>{preparing === key ? "Preparing…" : "Prepare for approval"}</button></div>;
            })}</div>}
            {!!message.sources?.length && <div className="copilot-sources">{message.sources.map((source) => <Link key={source.href} href={source.href}>{source.label} →</Link>)}</div>}
          </div>
        </article>)}
        {loading && <article className="copilot-message assistant"><div className="copilot-avatar">✦</div><div className="copilot-bubble"><small>ACTNIVO</small><p>Reading your operating data…</p></div></article>}
      </div>}

      {error && <p className="product-alert error">{error}</p>}
      <form className="copilot-composer" onSubmit={submit}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about stockouts, POs, transfers, quick commerce, actions or revenue risk…" maxLength={1200} rows={3} disabled={loading || Boolean(preparing)} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (question.trim()) void ask(question);
          }
        }} />
        <div><span>Enter to send · Shift + Enter for a new line</span><button className="saas-primary" type="submit" disabled={loading || Boolean(preparing) || !question.trim()}>{loading ? "Thinking…" : preparing ? "Preparing…" : "Ask Actnivo"}</button></div>
      </form>
    </section>

    <aside className="copilot-guardrails product-card compact">
      <small>HOW COPILOT WORKS</small>
      <h3>AI explains. Actnivo calculates.</h3>
      <p>Critical numbers come from deterministic commerce engines, not the language model.</p>
      <div><strong>Grounded</strong><span>Organization-scoped operating data only</span></div>
      <div><strong>Approval required</strong><span>Copilot prepares actions; an operator approves before execution</span></div>
      <div><strong>No fake execution</strong><span>Supplier and marketplace actions are never claimed without a real connector</span></div>
      <div><strong>Missing data stays missing</strong><span>Disconnected availability is never guessed</span></div>
      <Link href="/app/ops">Open Ops Inbox →</Link>
    </aside>
  </div>;
}
