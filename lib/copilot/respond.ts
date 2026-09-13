import type { CopilotActionProposal } from "./actions";
import type { CopilotContext } from "./context";

export type CopilotHistoryMessage = { role: "user" | "assistant"; text: string };
type CopilotReply = { answer: string; sources: Array<{ label: string; href: string }>; proposals: CopilotActionProposal[]; mode: "ai" | "deterministic"; };
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
function uniqueSources(items: Array<{ label: string; href: string }>) { return [...new Map(items.map((item) => [item.href, item])).values()].slice(0, 6); }

function proposalForRisk(risk: CopilotContext["topRisks"][number]): CopilotActionProposal | null {
  if (risk.recommendation) return { issueId: risk.id, type: "CREATE_TRANSFER_PLAN", label: `Prepare ${risk.recommendation.quantity}-unit transfer`, summary: `${risk.recommendation.sourceLocation ?? "Safe source"} → ${risk.recommendation.destinationLocation ?? risk.location ?? "destination"}`, estimatedValueProtected: risk.recommendation.revenueProtected, href: risk.href };
  if (risk.recommendationType === "EXPEDITE_PO") return { issueId: risk.id, type: "EXPEDITE_PO", label: `Prepare expedite request${risk.poNumber ? ` for ${risk.poNumber}` : ""}`, summary: `${risk.sku ?? risk.product ?? "SKU"} · ${money.format(risk.revenueAtRisk)} at risk`, estimatedValueProtected: risk.revenueAtRisk, href: risk.href };
  if (risk.recommendationType === "CREATE_RETURN_RECOVERY_TASK") return { issueId: risk.id, type: "CREATE_RETURN_RECOVERY_TASK", label: `Prepare ${risk.returnKind === "RTO" ? "RTO" : "return"} recovery task`, summary: `${risk.externalReturnId ?? risk.title} · ${money.format(risk.revenueAtRisk)} exposed`, estimatedValueProtected: risk.revenueAtRisk, href: risk.href };
  if (risk.recommendationType === "CREATE_ORDER_RECOVERY_TASK") return { issueId: risk.id, type: "CREATE_ORDER_RECOVERY_TASK", label: String(risk.type) === "RTO_RISK" ? "Prepare RTO prevention task" : "Prepare fulfillment recovery task", summary: `${risk.title} · ${money.format(risk.revenueAtRisk)} at risk`, estimatedValueProtected: risk.revenueAtRisk, href: risk.href };
  if (risk.type === "STOCKOUT_RISK") return { issueId: risk.id, type: "CREATE_REPLENISHMENT_PLAN", label: `Prepare replenishment for ${risk.sku ?? risk.product ?? "SKU"}`, summary: `${risk.shortageUnits ?? 0} shortage units · ${money.format(risk.revenueAtRisk)} at risk`, estimatedValueProtected: risk.revenueAtRisk, href: risk.href };
  return null;
}
function proposalsForQuestion(question: string, context: CopilotContext) {
  const q = question.toLowerCase(); let candidates = context.topRisks;
  if (q.includes("return") || q.includes("refund") || q.includes("reverse logistics") || (q.includes("rto") && !q.includes("cod") && !q.includes("delivery attempt"))) candidates = candidates.filter((risk) => risk.recommendationType === "CREATE_RETURN_RECOVERY_TASK");
  else if (q.includes("order") || q.includes("cod") || q.includes("fulfillment") || q.includes("fulfilment") || q.includes("delivery attempt")) candidates = candidates.filter((risk) => risk.recommendationType === "CREATE_ORDER_RECOVERY_TASK");
  else if (q.includes("po") || q.includes("purchase order") || q.includes("arriv") || q.includes("supplier") || q.includes("expedite")) candidates = candidates.filter((risk) => String(risk.type).startsWith("PO_") || risk.recommendationType === "EXPEDITE_PO");
  else if (q.includes("transfer") || q.includes("rebalanc")) candidates = candidates.filter((risk) => Boolean(risk.recommendation));
  else if (q.includes("replenish")) candidates = candidates.filter((risk) => risk.type === "STOCKOUT_RISK" && !risk.recommendation);
  return candidates.map(proposalForRisk).filter((proposal): proposal is CopilotActionProposal => Boolean(proposal)).slice(0, 3);
}

export function deterministicReply(question: string, context: CopilotContext): CopilotReply {
  const q = question.toLowerCase(); const top = context.topRisks.slice(0, 3); const proposals = proposalsForQuestion(question, context);
  if (q.includes("return") || q.includes("refund") || q.includes("reverse logistics") || (q.includes("rto") && !q.includes("cod") && !q.includes("delivery attempt"))) {
    let candidates: any[] = context.returnExceptions;
    if (q.includes("refund")) candidates = candidates.filter((row: any) => row.type === "REFUND_DELAYED");
    if (q.includes("rto")) candidates = candidates.filter((row: any) => row.kind === "RTO");
    if (!candidates.length) return { answer: `I do not see matching active return/RTO exceptions. Cash tied up is ${money.format(context.summary.returnCashTiedUp)} and recorded reverse-logistics cost is ${money.format(context.summary.reverseLogisticsCost)}.`, sources: [{ label: "Returns & RTO", href: "/app/returns-rto" }], proposals: [], mode: "deterministic" };
    const lines = candidates.slice(0, 6).map((row: any, index: number) => `${index + 1}. ${row.externalReturnId} · ${row.kind} · ${row.type.replaceAll("_", " ")} · ${money.format(row.revenueAtRisk)} exposed.`);
    return { answer: `These reverse-logistics cases need attention:\n\n${lines.join("\n")}\n\nCash tied up: ${money.format(context.summary.returnCashTiedUp)} · Reverse-logistics cost: ${money.format(context.summary.reverseLogisticsCost)}.`, sources: uniqueSources(candidates.slice(0, 6).map((row: any) => ({ label: row.externalReturnId, href: row.href }))), proposals, mode: "deterministic" };
  }
  if (q.includes("order") || q.includes("cod") || q.includes("fulfillment") || q.includes("fulfilment") || q.includes("delivery attempt")) {
    if (!context.orderExceptions.length) return { answer: "I do not see any active order exceptions in the connected order data right now.", sources: [{ label: "Orders", href: "/app/orders" }], proposals: [], mode: "deterministic" };
    const candidates = q.includes("cod") ? context.orderExceptions.filter((order: any) => order.type === "RTO_RISK") : context.orderExceptions;
    const lines = candidates.slice(0, 6).map((order: any, index: number) => `${index + 1}. ${order.externalOrderId} · ${order.type.replaceAll("_", " ")} · ${money.format(order.revenueAtRisk)} at risk${order.paymentMethod === "COD" ? ` · ${order.deliveryAttempts} delivery attempts` : ""}.`);
    return { answer: `These orders need attention:\n\n${lines.join("\n")}`, sources: uniqueSources(candidates.slice(0, 6).map((order: any) => ({ label: order.externalOrderId, href: order.href }))), proposals, mode: "deterministic" };
  }
  if (q.includes("po") || q.includes("purchase order") || q.includes("arrive") || q.includes("supplier")) {
    if (!context.purchaseOrderRisks.length) return { answer: "I do not see any purchase-order arrival risks in the connected data right now.", sources: [{ label: "Purchase Orders", href: "/app/purchase-orders" }], proposals: [], mode: "deterministic" };
    const lines = context.purchaseOrderRisks.slice(0, 5).map((risk, index) => `${index + 1}. ${risk.poNumber} · ${risk.sku}: arrives ${risk.gapDays} days after projected stockout, with ${money.format(risk.revenueAtRisk)} at risk.`);
    return { answer: `These incoming POs need attention:\n\n${lines.join("\n")}`, sources: uniqueSources(context.purchaseOrderRisks.map((risk) => ({ label: risk.poNumber, href: risk.href }))), proposals, mode: "deterministic" };
  }
  if (q.includes("blinkit") || q.includes("zepto") || q.includes("instamart") || q.includes("quick commerce")) {
    const channels = context.quickCommerce.channelHealth.map((channel) => `${channel.channel.replaceAll("_", " ")}: ${channel.health}${channel.connected ? ` · ${money.format(channel.revenueAtRisk)} at risk` : " · not connected"}`);
    return { answer: `Quick-commerce health:\n\n${channels.join("\n")}\n\nAvailability data is only included when connected.`, sources: [{ label: "Quick Commerce", href: "/app/quick-commerce" }], proposals, mode: "deterministic" };
  }
  if (q.includes("action") || q.includes("approval") || q.includes("approve")) {
    if (!context.pendingActions.length) return { answer: "There are no active actions waiting in the action lifecycle right now.", sources: [{ label: "Actions", href: "/app/actions" }], proposals, mode: "deterministic" };
    const actions = context.pendingActions.slice(0, 6).map((action) => `${String(action.type).replaceAll("_", " ")} · ${action.status.replaceAll("_", " ")} · ${action.executionMode}`);
    return { answer: `Current active actions:\n\n${actions.join("\n")}`, sources: [{ label: "Actions", href: "/app/actions" }], proposals, mode: "deterministic" };
  }
  if (q.includes("inventory") || q.includes("stock") || q.includes("rebalanc") || q.includes("transfer")) {
    const low = context.inventoryPosition.filter((item) => item.status === "Low stock").slice(0, 5);
    if (!low.length) return { answer: "I do not see any low-stock SKUs in the current normalized inventory view.", sources: [{ label: "Inventory", href: "/app/inventory" }], proposals, mode: "deterministic" };
    const rows = low.map((item) => `${item.sku} · ${item.product}: ${item.available} available.`);
    return { answer: `Lowest inventory coverage right now:\n\n${rows.join("\n")}`, sources: uniqueSources(low.map((item) => ({ label: item.sku, href: item.href }))), proposals, mode: "deterministic" };
  }
  if (!top.length) return { answer: `Your workspace has ${context.summary.inventorySkus} inventory SKUs, ${context.summary.openPurchaseOrders} open purchase orders, ${context.summary.openOrders} open orders, ${context.summary.activeReturnsRto} active return/RTO cases, and no active operational issues detected.`, sources: [{ label: "Dashboard", href: "/app/dashboard" }], proposals: [], mode: "deterministic" };
  const riskLines = top.map((risk, index) => `${index + 1}. ${risk.externalReturnId ?? risk.sku ?? risk.product ?? risk.title}: ${money.format(risk.revenueAtRisk)} at risk. ${risk.summary}`);
  return { answer: `You have ${context.summary.activeIssues} active operational issues with ${money.format(context.summary.revenueAtRisk)} currently at risk.\n\nHighest priorities:\n${riskLines.join("\n")}`, sources: uniqueSources(top.map((risk) => ({ label: risk.externalReturnId ?? risk.sku ?? risk.title, href: risk.href }))), proposals, mode: "deterministic" };
}

function extractResponseText(payload: any) { if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim(); const parts = Array.isArray(payload?.output) ? payload.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []) : []; return parts.map((part: any) => part?.text).filter((text: unknown): text is string => typeof text === "string").join("\n").trim(); }
export async function answerWithCopilot(question: string, context: CopilotContext, history: CopilotHistoryMessage[] = []): Promise<CopilotReply> {
  const fallback = deterministicReply(question, context); const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return fallback;
  const recentHistory = history.slice(-8).map((message) => `${message.role.toUpperCase()}: ${message.text}`).join("\n");
  try { const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6-luna", instructions: "You are Actnivo AI Copilot. Use only supplied Actnivo data. Never invent inventory, orders, returns/RTO state, refunds, revenue, dates, actions, customer contact, carrier actions or outcomes. Deterministic systems own calculations and classifications. Explain them but do not override them. Never claim an external action happened unless verified. Be concise and operational.", input: `${recentHistory ? `RECENT CONVERSATION:\n${recentHistory}\n\n` : ""}User question: ${question}\n\nACTNIVO DATA (JSON):\n${JSON.stringify(context)}`, max_output_tokens: 1000 }) }); if (!response.ok) return fallback; const answer = extractResponseText(await response.json()); return answer ? { ...fallback, answer, mode: "ai" } : fallback; } catch { return fallback; }
}
