export type PurchaseOrderStatus = "DRAFT" | "OPEN" | "ACKNOWLEDGED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "LATE" | "CANCELLED";

export type PurchaseOrderSourceType = "file_import" | "unicommerce" | "easyecom" | "erp" | "supplier_api" | "custom_api";

export type NormalizedPurchaseOrderLine = {
  externalLineId?: string;
  sku: string;
  orderedQuantity: number;
  confirmedQuantity?: number;
  receivedQuantity?: number;
  unitCost?: number;
  expectedDeliveryDate?: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedPurchaseOrder = {
  externalPoNumber: string;
  supplierName: string;
  supplierId?: string;
  destinationLocation: string;
  channel?: string;
  orderDate: string;
  expectedDeliveryDate: string;
  currency?: string;
  totalValue?: number;
  sourceType: PurchaseOrderSourceType;
  sourceConnectionId?: string;
  sourceImportId?: string;
  metadata?: Record<string, unknown>;
  lines: NormalizedPurchaseOrderLine[];
};

export interface PurchaseOrderConnector {
  readonly sourceType: PurchaseOrderSourceType;
  syncPurchaseOrders(context: { organizationId: string; since?: string; cursor?: string | null }): Promise<NormalizedPurchaseOrder[]>;
  getCursor?(): Promise<string | null>;
}

export type PurchaseOrderRisk = {
  poId: string;
  poNumber: string;
  poLineId: string;
  skuId: string;
  masterSku: string;
  productName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  supplierName: string;
  projectedStockoutAt: string;
  expectedArrivalDate: string;
  gapDays: number;
  weightedDailyVelocity: number;
  unitsAtRisk: number;
  revenueAtRisk: number;
  confidence: number;
  recommendationType: "CREATE_TRANSFER_PLAN" | "EXPEDITE_PO";
  transfer?: {
    sourceLocationId: string;
    sourceLocationName: string;
    quantity: number;
    sourceCoverageAfter: number;
    destinationCoverageAfter: number;
    estimatedRevenueProtected: number;
  };
};
