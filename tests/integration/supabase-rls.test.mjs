import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const testUrl = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const isolated = process.env.SUPABASE_TEST_ISOLATED === "true";
const configured = Boolean(testUrl && publishableKey && serviceRoleKey && isolated);

if (!configured) {
  test("two-user database and storage RLS integration", { skip: "Set SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY, and SUPABASE_TEST_ISOLATED=true for an isolated migrated test project." }, () => {});
} else {
  const runId = crypto.randomUUID().slice(0, 8);
  const password = `Actnivo-test-${crypto.randomUUID()}!`;
  const admin = createClient(testUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = {
    userA: "", userB: "", viewer: "", orgA: crypto.randomUUID(), orgB: crypto.randomUUID(),
    skuA: crypto.randomUUID(), skuB: crypto.randomUUID(), locationA: crypto.randomUUID(), locationB: crypto.randomUUID(),
  };
  let clientA;
  let clientB;
  let viewerClient;

  const userClient = () => createClient(testUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = async (email) => {
    const client = userClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    assert.equal(error, null);
    return client;
  };

  before(async () => {
    const emails = [`rls-a-${runId}@test.actnivo.com`, `rls-b-${runId}@test.actnivo.com`, `rls-viewer-${runId}@test.actnivo.com`];
    const created = [];
    for (const email of emails) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(error, null);
      created.push(data.user.id);
    }
    [ids.userA, ids.userB, ids.viewer] = created;
    const { error: orgError } = await admin.from("organizations").insert([
      { id: ids.orgA, created_by: ids.userA, name: `RLS Org A ${runId}`, slug: `rls-org-a-${runId}`, country: "India", timezone: "Asia/Kolkata", onboarding_completed_at: new Date().toISOString() },
      { id: ids.orgB, created_by: ids.userB, name: `RLS Org B ${runId}`, slug: `rls-org-b-${runId}`, country: "India", timezone: "Asia/Kolkata", onboarding_completed_at: new Date().toISOString() },
    ]);
    assert.equal(orgError, null);
    const { error: memberError } = await admin.from("organization_members").insert([
      { organization_id: ids.orgA, user_id: ids.userA, role: "owner" },
      { organization_id: ids.orgA, user_id: ids.viewer, role: "viewer" },
      { organization_id: ids.orgB, user_id: ids.userB, role: "owner" },
    ]);
    assert.equal(memberError, null);
    const { error: locationError } = await admin.from("locations").insert([
      { id: ids.locationA, organization_id: ids.orgA, name: "Mumbai", type: "warehouse", country: "India" },
      { id: ids.locationB, organization_id: ids.orgB, name: "Bangalore", type: "warehouse", country: "India" },
    ]);
    assert.equal(locationError, null);
    const { error: skuError } = await admin.from("skus").insert([
      { id: ids.skuA, organization_id: ids.orgA, master_sku: "A-VC-30", product_name: "Org A Vitamin C", mrp: 699, selling_price: 599 },
      { id: ids.skuB, organization_id: ids.orgB, master_sku: "B-VC-30", product_name: "Org B Vitamin C", mrp: 699, selling_price: 599 },
    ]);
    assert.equal(skuError, null);
    const { error: snapshotError } = await admin.from("inventory_snapshots").insert([
      { organization_id: ids.orgA, sku_id: ids.skuA, location_id: ids.locationA, available_quantity: 120, snapshot_at: "2026-09-12T00:00:00Z" },
      { organization_id: ids.orgB, sku_id: ids.skuB, location_id: ids.locationB, available_quantity: 43, snapshot_at: "2026-09-12T00:00:00Z" },
    ]);
    assert.equal(snapshotError, null);
    const uploadB = await admin.storage.from("commerce-imports").upload(`${ids.orgB}/tests/${runId}/private.csv`, "sku,qty\nB-VC-30,43", { contentType: "text/csv" });
    assert.equal(uploadB.error, null);
    clientA = await signIn(emails[0]);
    clientB = await signIn(emails[1]);
    viewerClient = await signIn(emails[2]);
  });

  after(async () => {
    await admin.storage.from("commerce-imports").remove([
      `${ids.orgA}/tests/${runId}/private.csv`,
      `${ids.orgB}/tests/${runId}/private.csv`,
    ]);
    await admin.from("organizations").delete().in("id", [ids.orgA, ids.orgB]);
    for (const userId of [ids.userA, ids.userB, ids.viewer]) if (userId) await admin.auth.admin.deleteUser(userId);
  });

  async function assertTenantIsolation(client, own, other) {
    const ownOrg = await client.from("organizations").select("id").eq("id", own.org).maybeSingle();
    assert.equal(ownOrg.error, null);
    assert.equal(ownOrg.data?.id, own.org);
    const otherOrg = await client.from("organizations").select("id").eq("id", other.org).maybeSingle();
    assert.equal(otherOrg.error, null);
    assert.equal(otherOrg.data, null);

    const ownSku = await client.from("skus").select("id").eq("id", own.sku).maybeSingle();
    assert.equal(ownSku.data?.id, own.sku);
    const otherSku = await client.from("skus").select("id").eq("id", other.sku).maybeSingle();
    assert.equal(otherSku.data, null);
    const ownInventory = await client.from("inventory_snapshots").select("sku_id").eq("sku_id", own.sku);
    assert.equal(ownInventory.data?.length, 1);
    const otherInventory = await client.from("inventory_snapshots").select("sku_id").eq("sku_id", other.sku);
    assert.equal(otherInventory.data?.length, 0);

    const crossInsert = await client.from("skus").insert({ organization_id: other.org, master_sku: `CROSS-${runId}`, product_name: "Forbidden", mrp: 1, selling_price: 1 });
    assert.ok(crossInsert.error, "cross-organization insertion must be rejected by RLS");
    const crossUpdate = await client.from("skus").update({ product_name: "Forbidden update" }).eq("id", other.sku).select("id");
    assert.equal(crossUpdate.error, null);
    assert.deepEqual(crossUpdate.data, []);
  }

  test("User A and User B can only read and mutate their own tenant", async () => {
    await assertTenantIsolation(clientA, { org: ids.orgA, sku: ids.skuA }, { org: ids.orgB, sku: ids.skuB });
    await assertTenantIsolation(clientB, { org: ids.orgB, sku: ids.skuB }, { org: ids.orgA, sku: ids.skuA });
  });

  test("commerce-import storage paths are isolated in both directions", async () => {
    const pathA = `${ids.orgA}/tests/${runId}/private.csv`;
    const uploadA = await clientA.storage.from("commerce-imports").upload(pathA, "sku,qty\nA-VC-30,120", { contentType: "text/csv" });
    assert.equal(uploadA.error, null);
    assert.equal((await clientA.storage.from("commerce-imports").download(pathA)).error, null);
    assert.ok((await clientA.storage.from("commerce-imports").download(`${ids.orgB}/tests/${runId}/private.csv`)).error);
    assert.equal((await clientB.storage.from("commerce-imports").download(`${ids.orgB}/tests/${runId}/private.csv`)).error, null);
    assert.ok((await clientB.storage.from("commerce-imports").download(pathA)).error);
  });

  test("viewer can read its organization but cannot manage inventory or uploads", async () => {
    assert.equal((await viewerClient.from("skus").select("id").eq("id", ids.skuA)).data?.length, 1);
    assert.ok((await viewerClient.from("skus").insert({ organization_id: ids.orgA, master_sku: `VIEWER-${runId}`, product_name: "Forbidden", mrp: 1, selling_price: 1 })).error);
    assert.ok((await viewerClient.from("inventory_snapshots").insert({ organization_id: ids.orgA, sku_id: ids.skuA, location_id: ids.locationA, available_quantity: 1, snapshot_at: new Date().toISOString() })).error);
    assert.ok((await viewerClient.storage.from("commerce-imports").upload(`${ids.orgA}/tests/${runId}/viewer.csv`, "forbidden", { contentType: "text/csv" })).error);
  });

  test("operating-loop records remain tenant isolated and action transitions are enforced", async () => {
    const issueId = crypto.randomUUID();
    const ownIssue = await clientA.from("issues").insert({ id: issueId, organization_id: ids.orgA, type: "STOCKOUT_RISK", severity: "high", status: "open", sku_id: ids.skuA, location_id: ids.locationA, title: "Org A risk", summary: "Tenant A only" }).select("id").single();
    assert.equal(ownIssue.error, null);
    assert.equal((await clientA.from("issues").select("id").eq("id", issueId)).data?.length, 1);
    assert.equal((await clientB.from("issues").select("id").eq("id", issueId)).data?.length, 0);
    assert.ok((await clientA.from("issues").insert({ organization_id: ids.orgB, type: "STOCKOUT_RISK", severity: "high", sku_id: ids.skuB, location_id: ids.locationB, title: "Forbidden", summary: "Cross tenant" })).error);
    assert.ok((await viewerClient.from("issues").insert({ organization_id: ids.orgA, type: "STOCKOUT_RISK", severity: "low", sku_id: ids.skuA, title: "Forbidden", summary: "Viewer mutation" })).error);

    const actionId = crypto.randomUUID();
    const action = await clientA.from("actions").insert({ id: actionId, organization_id: ids.orgA, issue_id: issueId, type: "CREATE_TRANSFER_PLAN", status: "CREATED", requested_by: ids.userA, execution_mode: "ASSISTED", idempotency_key: `${ids.orgA}:${runId}:action` }).select("id").single();
    assert.equal(action.error, null);
    assert.ok((await clientA.from("actions").update({ status: "EXECUTED" }).eq("id", actionId)).error, "invalid CREATED → EXECUTED transition must fail");
    assert.equal((await clientA.from("actions").update({ status: "VALIDATED" }).eq("id", actionId)).error, null);
    assert.equal((await clientB.from("actions").select("id").eq("id", actionId)).data?.length, 0);
    assert.ok((await viewerClient.from("actions").insert({ organization_id: ids.orgA, type: "ASSIGN_TASK", requested_by: ids.viewer, idempotency_key: `${ids.orgA}:${runId}:viewer` })).error);
  });
}
