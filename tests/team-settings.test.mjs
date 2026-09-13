import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260913130000_team_settings.sql", "utf8");
const teamPage = fs.readFileSync("app/app/team/page.tsx", "utf8");
const settingsPage = fs.readFileSync("app/app/settings/page.tsx", "utf8");
const valuePage = fs.readFileSync("app/app/value/page.tsx", "utf8");

test("team/settings migration is organization scoped with RLS", () => {
  assert.match(migration, /create table public\.organization_settings/);
  assert.match(migration, /create table public\.team_invitations/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /private\.is_org_admin/);
});

test("team UI is honest about invitation delivery", () => {
  assert.match(teamPage, /Email delivery is not enabled yet/);
  assert.match(teamPage, /pending invitation/i);
});

test("settings and value use explicit software cost", () => {
  assert.match(settingsPage, /monthly_software_cost/);
  assert.match(valuePage, /monthly_software_cost/);
  assert.match(valuePage, /will not fabricate an ROI number/);
});
