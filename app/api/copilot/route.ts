import { NextResponse } from "next/server";
import { getAppContext, getAuthenticatedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildCopilotContext } from "@/lib/copilot/context";
import { answerWithCopilot } from "@/lib/copilot/respond";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const context = await getAppContext(user);
  if (!context?.organization.onboardingCompletedAt) return NextResponse.json({ error: "Workspace onboarding is required." }, { status: 403 });

  let payload: { question?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Ask Actnivo a question." }, { status: 400 });
  if (question.length > 1200) return NextResponse.json({ error: "Keep questions under 1,200 characters." }, { status: 400 });

  try {
    const supabase = await createClient();
    const data = await buildCopilotContext(supabase, context.organization.id);
    const reply = await answerWithCopilot(question, data);
    return NextResponse.json({ ...reply, generatedAt: data.generatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Copilot could not read the workspace right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
