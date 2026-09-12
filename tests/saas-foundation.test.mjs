import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canAccessOrganization,
  protectedRouteDestination,
} from "../lib/auth/authorization.ts";
import {
  buildOrganizationRecords,
  normalizeChannels,
} from "../lib/data/organizations.ts";

test("unauthenticated application requests redirect to login", () => {
  assert.equal(
    protectedRouteDestination({ authenticated: false, hasOrganization: false, onboardingComplete: false }),
    "/login",
  );
});

test("organization access is isolated by user membership", () => {
  const memberships = [
    { userId: "user-a", organizationId: "org-a" },
    { userId: "user-b", organizationId: "org-b" },
  ];
  assert.equal(canAccessOrganization(memberships, "user-a", "org-a"), true);
  assert.equal(canAccessOrganization(memberships, "user-a", "org-b"), false);
  assert.equal(canAccessOrganization(memberships, "user-c", "org-a"), false);
});

test("successful onboarding creates an owner membership and normalized channels", () => {
  const records = buildOrganizationRecords(
    {
      name: "Nourish & Co.",
      website: "https://nourish.example/",
      country: "India",
      monthlyOrderVolume: 12000,
      skuCount: 280,
    },
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
  );
  assert.equal(records.organization.currency, "INR");
  assert.equal(records.organization.created_by, "00000000-0000-4000-8000-000000000001");
  assert.equal(records.organization.timezone, "Asia/Kolkata");
  assert.equal(records.membership.role, "owner");
  assert.equal(records.membership.organization_id, records.organization.id);
  assert.deepEqual(normalizeChannels(["shopify", "blinkit", "shopify"]), [
    { channel: "shopify", custom_name: null },
    { channel: "blinkit", custom_name: null },
  ]);
});

test("protected routes render only for an onboarded organization context", () => {
  assert.equal(protectedRouteDestination({ authenticated: false, hasOrganization: false, onboardingComplete: false }), "/login");
  assert.equal(protectedRouteDestination({ authenticated: true, hasOrganization: false, onboardingComplete: false }), "/onboarding/company");
  assert.equal(protectedRouteDestination({ authenticated: true, hasOrganization: true, onboardingComplete: false }), "/onboarding/channels");
  assert.equal(protectedRouteDestination({ authenticated: true, hasOrganization: true, onboardingComplete: true }), null);
});

test("migration enables membership-based RLS and avoids metadata authorization", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260912191611_initial_saas_schema.sql", import.meta.url), "utf8");
  for (const table of ["organizations", "profiles", "organization_members", "organization_channels"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(sql, /private\.is_org_member/i);
  assert.match(sql, /membership\.user_id = \(select auth\.uid\(\)\)/i);
  const policies = sql.slice(sql.indexOf("create policy"));
  assert.doesNotMatch(policies, /raw_user_meta_data/i);
  assert.doesNotMatch(policies, /to authenticated\s+using\s*\(\s*true\s*\)/i);
});
