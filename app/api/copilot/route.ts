import { NextResponse } from "next/server";
import { getAppContext, getAuthenticatedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildCopilotContext } from "@/lib/copilot/context";
import { answerWithCopilot, type CopilotHistoryMessage } from "@/lib/copilot/respond";

function sanitizeHistory(value: unknown): CopilotHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const role = row.role === "user" || row.role === "assistant" ? row.role : null;
    const text = typeof row.text === "string" ? row.text.trim().slice(0, 2000) : "";
    return role && text ? [{ role, text }] : [];
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const context = await getAppContext(user);
  if (!context?.organization.onboardingCompletedAt) return NextResponse.json({ error: "Workspace onboarding is required." }, { status: 403 });

  let payload: { question?: unknown; history?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Ask Actnivo a question." }, { status: 400 });
  if (question.length > 1200) return NextResponse.json({ error: "Keep questions under 1,200 characters." }, { status: 400 });
  const history = sanitizeHistory(payload.history);

  try {
    const supabase = await createClient();
    const data = await buildCopilotContext(supabase, context.organization.id);
    const reply = await answerWithCopilot(question, data, history);
    return NextResponse.json({ ...reply, generatedAt: data.generatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Copilot could not read the workspace right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
