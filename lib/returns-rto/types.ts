export type ReturnKind = "RETURN" | "RTO";
export type ReturnStatus = "REQUESTED" | "APPROVED" | "PICKUP_PENDING" | "PICKED_UP" | "IN_TRANSIT" | "RECEIVED" | "REFUND_PENDING" | "REFUNDED" | "CLOSED" | "CANCELLED";

export type NormalizedReturnLine = {
  sku: string;
  quantity: number;
  unitValue: number;
  metadata?: Record<string, unknown>;
};

export type NormalizedReturn = {
  externalReturnId: string;
  externalOrderId: string;
  kind: ReturnKind;
  status: ReturnStatus;
  reason?: string;
  currency: string;
  refundAmount: number;
  reverseLogisticsCost: number;
  requestedAt: string;
  approvedAt?: string;
  pickedUpAt?: string;
  receivedAt?: string;
  refundDueAt?: string;
  refundedAt?: string;
  sourceType: string;
  metadata?: Record<string, unknown>;
  lines: NormalizedReturnLine[];
};
