export type OrderLike = {
  id: string;
  external_order_id: string;
  status: string;
  fulfillment_status: string;
  payment_method: string;
  order_value: number | string;
  order_placed_at: string;
  promised_ship_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivery_attempts: number;
};

export type OrderException = {
  type: "ORDER_DELAYED" | "ORDER_STUCK" | "RTO_RISK";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  revenueAtRisk: number;
  ageHours: number;
  reason: string;
};

function hoursBetween(a: Date, b: Date) {
  return Math.max(0, (a.getTime() - b.getTime()) / 3_600_000);
}

export function detectOrderException(order: OrderLike, now = new Date()): OrderException | null {
  if (["DELIVERED", "CANCELLED", "RETURNED", "RTO"].includes(order.status)) return null;
  const value = Number(order.order_value ?? 0);
  const placed = new Date(order.order_placed_at);
  const ageHours = hoursBetween(now, placed);

  if (order.payment_method === "COD" && order.delivery_attempts > 0 && !order.delivered_at) {
    return {
      type: "RTO_RISK",
      severity: order.delivery_attempts >= 2 ? "critical" : "high",
      title: `COD order ${order.external_order_id} is at RTO risk`,
      summary: `${order.delivery_attempts} delivery attempt${order.delivery_attempts === 1 ? " has" : "s have"} failed for this COD order.`,
      revenueAtRisk: value,
      ageHours,
      reason: "COD order with failed delivery attempt",
    };
  }

  if (!order.shipped_at && order.promised_ship_at) {
    const promised = new Date(order.promised_ship_at);
    const overdueHours = hoursBetween(now, promised);
    if (now > promised && overdueHours >= 24) {
      return {
        type: "ORDER_STUCK",
        severity: overdueHours >= 48 ? "critical" : "high",
        title: `Order ${order.external_order_id} is stuck before shipment`,
        summary: `Shipment is ${Math.floor(overdueHours)} hours past the promised ship time.`,
        revenueAtRisk: value,
        ageHours,
        reason: "Unshipped more than 24 hours beyond promised ship time",
      };
    }
    if (now > promised) {
      return {
        type: "ORDER_DELAYED",
        severity: "medium",
        title: `Order ${order.external_order_id} is delayed`,
        summary: `The promised ship time has passed and the order is still unshipped.`,
        revenueAtRisk: value,
        ageHours,
        reason: "Promised ship time passed",
      };
    }
  }

  return null;
}
