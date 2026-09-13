export type ProfitabilityInput = {
  sales: any[];
  skus: any[];
  returns: any[];
  returnLines: any[];
  orders: any[];
};

type Bucket = {
  key: string;
  label: string;
  units: number;
  revenue: number;
  knownCogs: number;
  cogsEligibleRevenue: number;
  refunds: number;
  reverseCost: number;
};

const money = (value: unknown) => Number(value ?? 0);
const pct = (num: number, den: number) => den > 0 ? num / den : 0;

export function buildProfitability(input: ProfitabilityInput) {
  const skuMap = new Map(input.skus.map((sku) => [sku.id, sku]));
  const orderMap = new Map(input.orders.map((order) => [order.id, order]));
  const returnMap = new Map(input.returns.map((row) => [row.id, row]));
  const buckets = new Map<string, Bucket>();

  const bucketFor = (key: string, label: string) => {
    const existing = buckets.get(key);
    if (existing) return existing;
    const created: Bucket = { key, label, units: 0, revenue: 0, knownCogs: 0, cogsEligibleRevenue: 0, refunds: 0, reverseCost: 0 };
    buckets.set(key, created);
    return created;
  };

  let totalRevenue = 0;
  let totalKnownCogs = 0;
  let totalCogsEligibleRevenue = 0;
  let totalUnits = 0;

  for (const sale of input.sales) {
    const sku = skuMap.get(sale.sku_id);
    const key = `${sale.sku_id}:${sale.channel}`;
    const label = `${sku?.master_sku ?? "Unknown SKU"} · ${String(sale.channel ?? "unassigned").replaceAll("_", " ")}`;
    const bucket = bucketFor(key, label);
    const revenue = money(sale.net_sales ?? sale.gross_sales);
    const units = money(sale.units_sold);
    bucket.revenue += revenue;
    bucket.units += units;
    totalRevenue += revenue;
    totalUnits += units;
    if (sku?.cost_price != null) {
      const cogs = units * money(sku.cost_price);
      bucket.knownCogs += cogs;
      bucket.cogsEligibleRevenue += revenue;
      totalKnownCogs += cogs;
      totalCogsEligibleRevenue += revenue;
    }
  }

  let totalRefunds = 0;
  let totalReverseCost = 0;
  const allocatedReturnIds = new Set<string>();

  for (const line of input.returnLines) {
    const ret = returnMap.get(line.return_id);
    if (!ret) continue;
    const order = orderMap.get(ret.order_id);
    const sku = skuMap.get(line.sku_id);
    const key = `${line.sku_id}:${order?.channel ?? "unassigned"}`;
    const label = `${sku?.master_sku ?? "Unknown SKU"} · ${String(order?.channel ?? "unassigned").replaceAll("_", " ")}`;
    const bucket = bucketFor(key, label);
    const lineValue = money(line.quantity) * money(line.unit_value);
    const returnRefund = money(ret.refund_amount);
    const returnReverse = money(ret.reverse_logistics_cost);
    const siblingLines = input.returnLines.filter((candidate) => candidate.return_id === ret.id);
    const totalLineValue = siblingLines.reduce((sum, candidate) => sum + money(candidate.quantity) * money(candidate.unit_value), 0);
    const share = totalLineValue > 0 ? lineValue / totalLineValue : 1 / Math.max(1, siblingLines.length);
    bucket.refunds += returnRefund * share;
    bucket.reverseCost += returnReverse * share;
    if (!allocatedReturnIds.has(ret.id)) {
      totalRefunds += returnRefund;
      totalReverseCost += returnReverse;
      allocatedReturnIds.add(ret.id);
    }
  }

  const rows = [...buckets.values()].map((bucket) => {
    const knownContribution = bucket.revenue - bucket.knownCogs - bucket.refunds - bucket.reverseCost;
    return {
      ...bucket,
      knownContribution,
      contributionMargin: pct(knownContribution, bucket.revenue),
      costCoverage: pct(bucket.cogsEligibleRevenue, bucket.revenue),
      leakage: bucket.refunds + bucket.reverseCost,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const bySku = new Map<string, Bucket>();
  const byChannel = new Map<string, Bucket>();
  const add = (map: Map<string, Bucket>, key: string, label: string, row: Bucket) => {
    const target = map.get(key) ?? { key, label, units: 0, revenue: 0, knownCogs: 0, cogsEligibleRevenue: 0, refunds: 0, reverseCost: 0 };
    target.units += row.units; target.revenue += row.revenue; target.knownCogs += row.knownCogs; target.cogsEligibleRevenue += row.cogsEligibleRevenue; target.refunds += row.refunds; target.reverseCost += row.reverseCost;
    map.set(key, target);
  };
  for (const row of rows) {
    const [skuId, channel] = row.key.split(":");
    const sku = skuMap.get(skuId);
    add(bySku, skuId, sku ? `${sku.master_sku} · ${sku.product_name}` : "Unknown SKU", row);
    add(byChannel, channel, channel.replaceAll("_", " "), row);
  }
  const finalize = (values: Bucket[]) => values.map((bucket) => ({
    ...bucket,
    leakage: bucket.refunds + bucket.reverseCost,
    knownContribution: bucket.revenue - bucket.knownCogs - bucket.refunds - bucket.reverseCost,
    contributionMargin: pct(bucket.revenue - bucket.knownCogs - bucket.refunds - bucket.reverseCost, bucket.revenue),
    costCoverage: pct(bucket.cogsEligibleRevenue, bucket.revenue),
  })).sort((a, b) => b.revenue - a.revenue);

  const knownContribution = totalRevenue - totalKnownCogs - totalRefunds - totalReverseCost;
  return {
    summary: {
      revenue: totalRevenue,
      units: totalUnits,
      knownCogs: totalKnownCogs,
      refunds: totalRefunds,
      reverseCost: totalReverseCost,
      leakage: totalRefunds + totalReverseCost,
      knownContribution,
      contributionMargin: pct(knownContribution, totalRevenue),
      costCoverage: pct(totalCogsEligibleRevenue, totalRevenue),
      missingCostSkus: input.skus.filter((sku) => sku.cost_price == null).length,
    },
    rows,
    bySku: finalize([...bySku.values()]),
    byChannel: finalize([...byChannel.values()]),
  };
}
