import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createTeamInvitation, revokeInvitation, updateMemberRole } from "./actions";

const roleLabels: Record<string,string> = { owner:"Owner", admin:"Admin", ops_manager:"Ops manager", inventory_manager:"Inventory manager", finance:"Finance", viewer:"Viewer" };

export default async function TeamPage() {
  const { organization, role } = await requireAppContext();
  const supabase = await createClient();
  const db = supabase as any;

  const [membersResult, invitesResult] = await Promise.all([
    db.from("organization_members").select("id,user_id,role,created_at").eq("organization_id", organization.id).order("created_at", { ascending: true }),
    db.from("team_invitations").select("*").eq("organization_id", organization.id).eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (invitesResult.error) throw new Error(invitesResult.error.message);

  const members = membersResult.data ?? [];
  const userIds = [...new Set(members.map((member:any) => member.user_id).filter(Boolean))];
  let profileByUserId = new Map<string, any>();
  if (userIds.length) {
    const profilesResult = await db.from("profiles").select("id,full_name,email").in("id", userIds);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    profileByUserId = new Map((profilesResult.data ?? []).map((profile:any) => [profile.id, profile]));
  }

  const invites = invitesResult.data ?? [];
  const canManage = ["owner","admin"].includes(role);
  return <div className="product-page"><header className="product-page-header"><div><p>PLATFORM</p><h1>Team</h1><span>Workspace access, roles, and pending invitations for {organization.name}.</span></div></header>
    <section className="saas-metrics"><article><small>MEMBERS</small><strong>{members.length}</strong><p>Active workspace users</p></article><article><small>PENDING INVITES</small><strong>{invites.length}</strong><p>Recorded invitations</p></article><article><small>YOUR ROLE</small><strong>{roleLabels[role] ?? role}</strong><p>Current organization access</p></article></section>
    {canManage && <section className="product-card" style={{marginTop:18}}><header><div><small>INVITE</small><h2>Add a teammate</h2></div></header><form action={createTeamInvitation} style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:12,padding:"20px 24px 26px"}}><input name="email" type="email" required placeholder="name@company.com"/><select name="role" defaultValue="viewer"><option value="admin">Admin</option><option value="ops_manager">Ops manager</option><option value="inventory_manager">Inventory manager</option><option value="finance">Finance</option><option value="viewer">Viewer</option></select><button className="saas-primary" type="submit">Create invitation</button><p style={{gridColumn:"1/-1",margin:0,opacity:.68}}>This records a pending invitation. Email delivery is not enabled yet; Actnivo will not claim an email was sent until a real email provider is connected.</p></form></section>}
    <section className="product-card" style={{marginTop:18}}><header><div><small>ACCESS</small><h2>Members</h2></div></header><div className="simple-table"><div className="simple-table-head"><span>Member</span><span>Role</span><span>Joined</span><span>Access</span><span></span></div>{members.map((member:any)=>{const p=profileByUserId.get(member.user_id); return <div key={member.id}><span><strong>{p?.full_name || p?.email || "Member"}</strong><small>{p?.email}</small></span><span>{roleLabels[member.role] ?? member.role}</span><span>{new Date(member.created_at).toLocaleDateString("en-IN")}</span><span>{member.role === "owner" ? "Full" : "Role based"}</span><span>{canManage && member.role !== "owner" ? <form action={updateMemberRole} style={{display:"flex",gap:8}}><input type="hidden" name="member_id" value={member.id}/><select name="role" defaultValue={member.role}><option value="admin">Admin</option><option value="ops_manager">Ops manager</option><option value="inventory_manager">Inventory manager</option><option value="finance">Finance</option><option value="viewer">Viewer</option></select><button type="submit">Save</button></form> : null}</span></div>})}</div></section>
    <section className="product-card" style={{marginTop:18}}><header><div><small>PENDING</small><h2>Invitations</h2></div></header>{invites.length ? <div className="simple-table"><div className="simple-table-head"><span>Email</span><span>Role</span><span>Created</span><span>Status</span><span></span></div>{invites.map((invite:any)=><div key={invite.id}><span><strong>{invite.email}</strong></span><span>{roleLabels[invite.role] ?? invite.role}</span><span>{new Date(invite.created_at).toLocaleDateString("en-IN")}</span><span>Pending</span><span>{canManage?<form action={revokeInvitation}><input type="hidden" name="invitation_id" value={invite.id}/><button type="submit">Revoke</button></form>:null}</span></div>)}</div>:<div className="product-empty"><h3>No pending invitations.</h3><p>Create one when you are ready to add another operator.</p></div>}</section>
  </div>;
}
