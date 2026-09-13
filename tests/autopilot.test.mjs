import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20260913120000_autopilot_policies.sql", import.meta.url);
const enginePath = new URL("../lib/autopilot/engine.ts", import.meta.url);
const pagePath = new URL("../app/app/autopilot/page.tsx", import.meta.url);

test("Autopilot policies are disabled by default and external execution is locked", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /enabled boolean not null default false/);
  assert.match(sql, /external_execution_enabled boolean not null default false/);
  assert.match(sql, /approval_required boolean not null default true/);
  assert.match(sql, /members read autopilot policies/);
  assert.match(sql, /managers update autopilot policies/);
});

test("Autopilot prepares assisted approval-gated actions with idempotency and caps", async () => {
  const source = await readFile(enginePath, "utf8");
  assert.match(source, /status: "AWAITING_APPROVAL"/);
  assert.match(source, /execution_mode: "ASSISTED"/);
  assert.match(source, /external_action_performed: false/);
  assert.match(source, /daily_action_cap/);
  assert.match(source, /autopilot:\$\{issue\.id\}/);
  assert.match(source, /autopilot_action_prepared/);
});

test("Autopilot UI explicitly communicates safety boundaries", async () => {
  const source = await readFile(pagePath, "utf8");
  assert.match(source, /External execution remains locked/);
  assert.match(source, /Run Autopilot now/);
  assert.match(source, /Approval required/);
});
