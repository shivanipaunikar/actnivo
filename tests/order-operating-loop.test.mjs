import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260913100000_order_issue_action_link.sql", "utf8");
const loop = fs.readFileSync("lib/orders/operating-loop.ts", "utf8");
const orderActions = fs.readFileSync("app/app/orders/actions.ts", "utf8");

 test("order issue migration links issues to orders and keeps recovery actions assisted", () => {
  assert.match(migration, /CREATE_ORDER_RECOVERY_TASK/);
  assert.match(migration, /alter table public\.issues alter column sku_id drop not null/);
  assert.match(migration, /foreign key \(order_id, organization_id\)/);
  assert.match(migration, /issues_one_active_order_key/);
});

test("order operating loop creates auditable issues and resolves stale exceptions", () => {
  assert.match(loop, /detectOrderException/);
  assert.match(loop, /order_exception_detected/);
  assert.match(loop, /order_exception_resolved/);
  assert.match(loop, /external_action_performed: false/);
  assert.match(loop, /verification_status: "SUCCESS"/);
});

test("order recovery proposal requires approval before assisted execution", () => {
  assert.match(orderActions, /AWAITING_APPROVAL/);
  assert.match(orderActions, /execution_mode: "ASSISTED"/);
  assert.match(orderActions, /external_action_performed: false/);
  assert.doesNotMatch(orderActions, /customer contacted/i);
});
