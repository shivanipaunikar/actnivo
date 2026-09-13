"use server";

import { revalidatePath } from "next/cache";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = new Set(["admin","ops_manager","inventory_manager","finance","viewer"]);

export async function createTeamInvitation(formData: FormData) {
  const { organization, user, role } = await requireAppContext();
  if (!['owner','admin'].includes(role)) throw new Error("Only owners and admins can invite teammates.");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const inviteRole = String(formData.get("role") ?? "viewer");
  if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
  if (!allowedRoles.has(inviteRole)) throw new Error("Choose a valid role.");
  const supabase = await createClient();
  const result = await (supabase as any).from("team_invitations").insert({ organization_id: organization.id, email, role: inviteRole, invited_by: user.id });
  if (result.error) {
    if (String(result.error.message).toLowerCase().includes("duplicate")) throw new Error("A pending invitation already exists for this email.");
    throw new Error(result.error.message);
  }
  revalidatePath("/app/team");
}

export async function updateMemberRole(formData: FormData) {
  const { organization, role, user } = await requireAppContext();
  if (!['owner','admin'].includes(role)) throw new Error("Only owners and admins can change roles.");
  const memberId = String(formData.get("member_id") ?? "");
  const nextRole = String(formData.get("role") ?? "");
  if (!memberId || !allowedRoles.has(nextRole)) throw new Error("Invalid member or role.");
  const supabase = await createClient();
  const db = supabase as any;
  const current = await db.from("organization_members").select("user_id,role").eq("organization_id", organization.id).eq("id", memberId).single();
  if (current.error) throw new Error(current.error.message);
  if (current.data.role === "owner") throw new Error("The owner role cannot be changed here.");
  if (current.data.user_id === user.id && role === "admin" && nextRole !== "admin") throw new Error("You cannot remove your own admin access.");
  const result = await db.from("organization_members").update({ role: nextRole }).eq("organization_id", organization.id).eq("id", memberId);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/app/team");
}

export async function revokeInvitation(formData: FormData) {
  const { organization, role } = await requireAppContext();
  if (!['owner','admin'].includes(role)) throw new Error("Only owners and admins can revoke invitations.");
  const invitationId = String(formData.get("invitation_id") ?? "");
  const supabase = await createClient();
  const result = await (supabase as any).from("team_invitations").update({ status: "revoked" }).eq("organization_id", organization.id).eq("id", invitationId).eq("status", "pending");
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/app/team");
}
