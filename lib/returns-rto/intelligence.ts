import type { ReturnKind, ReturnStatus } from "./types";

export type ReturnException = {
  type: "RETURN_STUCK" | "REFUND_DELAYED" | "RETURN_RECEIPT_DELAYED";
  severity: "critical" | "high" | "medium";
  title: string;
  summary: string;
  revenueAtRisk: number;
  reason: string;
};

type ReturnLike = {
  kind: ReturnKind;
  status: ReturnStatus;
  refund_amount?: number | string | null;
  reverse_logistics_cost?: number | string | null;
  requested_at: string;
  picked_up_at?: string | null;
  received_at?: string | null;
  refund_due_at?: string | null;
  refunded_at?: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
const ageDays = (from: string, now: Date) => Math.max(0, (now.getTime() - new Date(from).getTime()) / DAY);
const moneyAtRisk = (row: ReturnLike) => Number(row.refund_amount ?? 0) + Number(row.reverse_logistics_cost ?? 0);

export function detectReturnException(row: ReturnLike, now = new Date()): ReturnException | null {
  if (["REFUNDED", "CLOSED", "CANCELLED"].includes(row.status)) return null;
  const exposure = moneyAtRisk(row);

  if (row.refund_due_at && !row.refunded_at && now.getTime() > new Date(row.refund_due_at).getTime()) {
    const overdue = ageDays(row.refund_due_at, now);
    return {
      type: "REFUND_DELAYED",
      severity: overdue >= 5 ? "critical" : "high",
      title: "Refund is overdue",
      summary: `Refund is ${overdue.toFixed(1)} days past the due date, tying up ${Math.round(exposure)} in customer and reverse-logistics value.`,
      revenueAtRisk: exposure,
      reason: "refund_due_at_passed",
    };
  }

  if (["PICKED_UP", "IN_TRANSIT"].includes(row.status) && row.picked_up_at && !row.received_at) {
    const transitDays = ageDays(row.picked_up_at, now);
    if (transitDays >= 5) return {
      type: "RETURN_RECEIPT_DELAYED",
      severity: transitDays >= 8 ? "critical" : "high",
      title: row.kind === "RTO" ? "RTO receipt is delayed" : "Return receipt is delayed",
      summary: `${row.kind === "RTO" ? "RTO" : "Return"} has been in reverse transit for ${transitDays.toFixed(1)} days without warehouse receipt.`,
      revenueAtRisk: exposure,
      reason: "reverse_transit_over_5_days",
    };
  }

  if (["REQUESTED", "APPROVED", "PICKUP_PENDING"].includes(row.status)) {
    const requestAge = ageDays(row.requested_at, now);
    if (requestAge >= 4) return {
      type: "RETURN_STUCK",
      severity: requestAge >= 7 ? "critical" : "high",
      title: row.kind === "RTO" ? "RTO recovery is stuck" : "Return pickup is stuck",
      summary: `${row.kind === "RTO" ? "RTO" : "Return"} has not progressed for ${requestAge.toFixed(1)} days after request.`,
      revenueAtRisk: exposure,
      reason: "no_progress_over_4_days",
    };
  }

  return null;
}

export function buildReturnRecoveryRecommendation(exception: ReturnException, kind: ReturnKind) {
  if (exception.type === "REFUND_DELAYED") return {
    title: "Create refund escalation task",
    detail: "Escalate the overdue refund and confirm settlement ownership.",
    task: "Escalate the overdue refund to the payments/refunds owner, confirm the blocking step, and record the expected settlement date. Do not claim the refund was issued until source data verifies it.",
  };
  if (exception.type === "RETURN_RECEIPT_DELAYED") return {
    title: kind === "RTO" ? "Create RTO receipt escalation" : "Create reverse-logistics escalation",
    detail: "Trace the reverse shipment and confirm warehouse receipt ownership.",
    task: `Trace this ${kind === "RTO" ? "RTO" : "return"} with the carrier/warehouse team, identify the delay, and confirm the expected receipt date. Do not claim carrier contact or receipt without connected source data.`,
  };
  return {
    title: kind === "RTO" ? "Create RTO recovery task" : "Create return pickup task",
    detail: "Confirm the next operational step and owner.",
    task: `Review this ${kind === "RTO" ? "RTO" : "return"}, assign an operator, and confirm the next pickup/recovery step. No external customer, carrier, OMS, or marketplace action is performed by Actnivo without a connector.`,
  };
}
