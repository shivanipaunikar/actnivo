import assert from "node:assert/strict";
import test from "node:test";
import { buildReturnRecoveryRecommendation, detectReturnException } from "../lib/returns-rto/intelligence.ts";

const now = new Date("2026-09-13T12:00:00Z");
const base = { kind: "RETURN", status: "REQUESTED", refund_amount: 1200, reverse_logistics_cost: 150, requested_at: "2026-09-08T12:00:00Z", picked_up_at: null, received_at: null, refund_due_at: null, refunded_at: null };

test("flags a return that has not progressed for four days", () => {
  const issue = detectReturnException(base, now);
  assert.equal(issue?.type, "RETURN_STUCK");
  assert.equal(issue?.revenueAtRisk, 1350);
});

test("flags overdue refund before generic stuck logic", () => {
  const issue = detectReturnException({ ...base, status: "REFUND_PENDING", refund_due_at: "2026-09-07T12:00:00Z" }, now);
  assert.equal(issue?.type, "REFUND_DELAYED");
  assert.equal(issue?.severity, "critical");
});

test("flags reverse transit that has not reached warehouse", () => {
  const issue = detectReturnException({ ...base, kind: "RTO", status: "IN_TRANSIT", picked_up_at: "2026-09-06T12:00:00Z" }, now);
  assert.equal(issue?.type, "RETURN_RECEIPT_DELAYED");
  assert.match(issue?.title ?? "", /RTO/);
});

test("does not flag closed reverse logistics", () => {
  assert.equal(detectReturnException({ ...base, status: "REFUNDED", refunded_at: "2026-09-12T12:00:00Z" }, now), null);
});

test("recovery recommendation never claims an external action", () => {
  const issue = detectReturnException(base, now);
  assert.ok(issue);
  const recommendation = buildReturnRecoveryRecommendation(issue, "RETURN");
  assert.match(recommendation.task, /No external|Do not claim/);
});
