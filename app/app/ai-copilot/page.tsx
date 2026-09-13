import { AiCopilotClient } from "@/components/app/AiCopilotClient";
import { requireAppContext } from "@/lib/auth/session";

export default async function AiCopilotPage() {
  const context = await requireAppContext();
  return <div className="product-page copilot-page">
    <header className="product-page-header">
      <div><p>AUTOMATION / INTELLIGENCE</p><h1>AI Copilot</h1><span>Ask operational questions across {context.organization.name}. Answers are grounded in Actnivo's deterministic commerce data.</span></div>
    </header>
    <AiCopilotClient aiConfigured={Boolean(process.env.OPENAI_API_KEY)} />
  </div>;
}
