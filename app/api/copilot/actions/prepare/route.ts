import { NextResponse } from "next/server";
import { getAppContext, getAuthenticatedUser } from "@/lib/auth/session";
import { assertCanManageInventory } from "@/lib/auth/roles";
import { prepareCopilotAction, type CopilotProposalType } from "@/lib/copilot/actions";
import { createClient } from "@/lib/supabase/server";

const allowed = new Set<CopilotProposalType>(["CREATE_TRANSFER_PLAN", "CREATE_REPLENISHMENT_PLAN", "EXPEDITE_PO", "CREATE_ORDER_RECOVERY_TASK", "CREATE_RETURN_RECOVERY_TASK"]);

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const context = await getAppContext(user);
  if (!context?.organization.onboardingCompletedAt) return NextResponse.json({ error: "Workspace onboarding is required." }, { status: 403 });
  try {
    assertCanManageInventory(context.role);
    const payload = await request.json() as { issueId?: unknown; type?: unknown };
    const issueId = typeof payload.issueId === "string" ? payload.issueId.trim() : "";
    const type = typeof payload.type === "string" ? payload.type as CopilotProposalType : null;
    if (!issueId || !type || !allowed.has(type)) return NextResponse.json({ error: "Choose a valid grounded Actnivo action." }, { status: 400 });
    const supabase = await createClient();
    const result = await prepareCopilotAction(supabase, context.organization.id, context.user.id, issueId, type);
    return NextResponse.json({ ...result, href: `/app/actions/${result.actionId}`, message: result.created ? "Proposed action prepared for approval." : "This proposed action already exists." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Actnivo could not prepare that action.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
