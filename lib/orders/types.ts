import type { CommerceChannel } from "@/lib/supabase/database.types";

export type OrderStatus = "CREATED" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "RTO";
export type FulfillmentStatus = "UNFULFILLED" | "PROCESSING" | "PARTIALLY_FULFILLED" | "FULFILLED" | "DELIVERED" | "FAILED" | "RETURNED" | "RTO";
export type PaymentMethod = "PREPAID" | "COD" | "OTHER";

export type NormalizedOrderLine = {
  externalLineId?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  metadata?: Record<string, unknown>;
};

export type NormalizedOrder = {
  externalOrderId: string;
  channel?: CommerceChannel;
  location?: string;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod: PaymentMethod;
  currency: string;
  orderValue: number;
  customerName?: string;
  customerCity?: string;
  orderPlacedAt: string;
  promisedShipAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  deliveryAttempts: number;
  sourceType: string;
  sourceConnectionId?: string;
  metadata?: Record<string, unknown>;
  lines: NormalizedOrderLine[];
};

export interface OrderConnector {
  readonly sourceType: string;
  syncOrders(context: { organizationId: string; since?: string; cursor?: string | null }): Promise<NormalizedOrder[]>;
  getCursor?(): Promise<string | null>;
}
