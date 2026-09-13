# Sprint 4B — Purchase Order Intelligence

## Product thesis

Actnivo should not become a purchase-order CRUD tool or a file-upload product.

**The purpose of Sprint 4B is to make incoming supply operationally intelligent.**

The core question is:

> Will incoming supply arrive in time to protect demand, and if not, what should Actnivo recommend or execute next?

This sprint must extend the existing Actnivo operating loop:

**DETECT → PREDICT → ₹ IMPACT → RECOMMEND → APPROVE → EXECUTE → VERIFY → LEARN**

The primary product message is:

> Actnivo does not just track purchase orders. It knows whether incoming supply will arrive in time to protect demand.

---

## API-first architecture

Actnivo is an API-first commerce action layer.

CSV/XLSX is only a bootstrap and fallback adapter for:

- onboarding
- testing
- historical backfills
- one-off corrections
- customers whose legacy systems do not expose usable APIs

**Do not couple PO business logic to CSV/XLSX ingestion.**

All PO intelligence must operate on a normalized internal commerce model regardless of where the data came from.

```text
Supplier / ERP / OMS / WMS / Marketplace APIs
                 │
                 ├──────────────┐
                 │              │
              CSV/XLSX      Future connectors
                 │              │
                 └──────┬───────┘
                        ↓
                Source adapters
                        ↓
                Normalization layer
                        ↓
              purchase_orders
              purchase_order_lines
                        ↓
            PO intelligence engine
                        ↓
   Detect → Predict → ₹ Impact → Recommend
                        ↓
              Approve → Execute
                        ↓
                    Verify
```

### Source adapters

Each ingestion source should translate external data into the same normalized contract.

Examples:

- `file_import`
- `unicommerce`
- `easyecom`
- `erp`
- `supplier_api`
- future marketplace or procurement connector

The intelligence engine should not need to know which adapter produced the record.

---

## 4B scope

### 1. Purchase Order data model

Create organization-scoped PO entities.

### `purchase_orders`

Suggested fields:

- `id`
- `organization_id`
- `external_po_number`
- `supplier_name`
- `supplier_id` nullable
- `channel` nullable
- `destination_location_id`
- `status`
- `order_date`
- `expected_delivery_date`
- `actual_delivery_date` nullable
- `currency`
- `total_value` nullable
- `source_type`
- `source_connection_id` nullable
- `source_import_id` nullable
- timestamps

### `purchase_order_lines`

Suggested fields:

- `id`
- `organization_id`
- `purchase_order_id`
- `sku_id`
- `ordered_quantity`
- `confirmed_quantity` nullable
- `received_quantity` default `0`
- `unit_cost` nullable
- `expected_delivery_date` nullable
- timestamps

### PO statuses

- `DRAFT`
- `OPEN`
- `ACKNOWLEDGED`
- `PARTIALLY_RECEIVED`
- `RECEIVED`
- `LATE`
- `CANCELLED`

Keep organization isolation and RLS consistent with the rest of Actnivo.

---

## 2. Source-agnostic PO ingestion

Build a normalization boundary so all PO sources produce the same internal write contract.

Example conceptual contract:

```ts
interface NormalizedPurchaseOrder {
  externalPoNumber: string;
  supplierName: string;
  destinationLocation: string;
  channel?: string;
  orderDate: string;
  expectedDeliveryDate: string;
  currency?: string;
  lines: Array<{
    sku: string;
    orderedQuantity: number;
    confirmedQuantity?: number;
    receivedQuantity?: number;
    unitCost?: number;
    expectedDeliveryDate?: string;
  }>;
}
```

### File adapter for MVP

CSV/XLSX remains supported only as the first adapter.

Suggested columns:

- PO Number
- Supplier
- SKU
- Destination
- Order Date
- Expected Delivery Date
- Ordered Quantity
- Confirmed Quantity
- Received Quantity
- Unit Cost
- Channel

Reuse the existing import framework:

- `import_jobs`
- `source_files`
- `import_rows`
- column mapping
- SKU mapping
- validation
- duplicate detection

Do not put PO forecasting, risk logic, or action logic inside the file-import implementation.

---

## 3. API connector contract

Prepare an internal connector interface even if direct vendor integrations are not completed in 4B.

The connector boundary should support operations such as:

```ts
interface PurchaseOrderConnector {
  syncPurchaseOrders(context: ConnectorContext): Promise<NormalizedPurchaseOrder[]>;
  getCursor?(): Promise<string | null>;
}
```

Future connector implementations can include:

- Unicommerce
- EasyEcom
- ERP / procurement systems
- supplier systems
- custom customer APIs

Do not hard-code the intelligence layer to any named vendor.

---

## 4. Purchase Order Intelligence

For every relevant PO line, compare incoming supply with the existing demand and stockout forecast.

Core calculation:

```text
projected_stockout_date
vs
expected_po_arrival_date
```

If:

```text
projected_stockout_date < expected_po_arrival_date
```

then incoming supply arrives too late to protect demand.

Calculate:

- gap in days
- expected shortage during the gap
- affected location/channel
- units at risk
- estimated revenue at risk
- confidence

Example:

```text
Vitamin C Serum
Bangalore FC

Projected stockout: Sep 14
PO expected arrival: Sep 17
Supply gap: 3 days
Revenue at risk: ₹84,000
```

The calculation must remain deterministic and transparent.

---

## 5. Recommendation engine

When incoming supply is late relative to demand, evaluate options in this order where appropriate:

1. Is there a safe transfer from another location?
2. Is there an earlier existing PO or inbound source?
3. Can the current PO be expedited?
4. Is a new replenishment plan required?

Recommendation types:

- `EXPEDITE_PO`
- `CREATE_TRANSFER_PLAN`
- `CREATE_REPLENISHMENT_PLAN`

Reuse the existing transfer/rebalance logic from the operating loop instead of duplicating it.

Do not recommend a transfer that would create a new stockout at the source location.

---

## 6. Ops Inbox integration

PO intelligence must create prioritized operational issues, not a separate disconnected workflow.

Add issue types:

- `PO_LATE`
- `PO_SHORTAGE`
- `PO_ARRIVES_AFTER_STOCKOUT`
- `PO_PARTIAL_RECEIPT`

Rank them using the existing financial-priority approach.

The Ops Inbox should answer:

> Which incoming-supply problem should I fix first?

---

## 7. Actions and execution

Reuse the existing Action Engine.

### `EXPEDITE_PO`

For the 4B MVP, this should be **ASSISTED execution**, not fake API execution.

An approved expedite action may produce:

- an internal task
- supplier-ready summary
- downloadable or copyable expedite request
- audit entry

Actnivo must never claim that a supplier was contacted unless a real connector actually performed that action.

Future API connectors may later support direct execution.

---

## 8. Purchase Orders UI

### `/app/purchase-orders`

Summary metrics:

- Open POs
- PO value
- Late POs
- At-risk PO lines
- Units inbound
- Revenue at risk

Filters:

- status
- supplier
- destination
- channel
- expected delivery window
- risk status

Table columns:

- PO number
- supplier
- destination
- status
- expected arrival
- SKU count
- inbound units
- PO value
- revenue risk
- recommended action

### `/app/purchase-orders/[poId]`

Show:

- PO metadata
- supplier
- destination
- dates
- status
- value
- source / connection

Line-item view:

- SKU
- Product
- Ordered
- Confirmed
- Received
- Remaining
- Expected delivery
- Projected stockout
- Supply gap
- ₹ risk

Add a **Supply impact** section showing whether this PO is early enough to protect forecast demand.

---

## 9. Receipt handling

Support updates to received quantity from any adapter.

Status progression:

```text
OPEN → PARTIALLY_RECEIVED → RECEIVED
```

Do not overwrite historical inventory snapshots.

Purchase Orders describe inbound supply.

Inventory snapshots remain the source of truth for current on-hand inventory.

Avoid double counting if a receipt is reflected both in PO data and a later inventory snapshot.

---

## 10. Verification

PO actions should eventually feed the existing verification layer.

Examples:

- Did an expedited PO arrive earlier?
- Did the bridge transfer prevent the predicted stockout?
- Did actual inventory recover before the risk window?
- How much revenue was actually protected?

Outcome verification is part of the core Actnivo moat and should not be skipped.

---

## 11. Testing requirements

Cover at minimum:

- PO CSV import
- PO XLSX import
- normalized adapter contract
- duplicate import protection
- SKU mapping reuse
- organization isolation / RLS
- PO status transitions
- partial receipt handling
- late PO detection
- arrives-after-stockout detection
- supply-gap math
- ₹ risk calculation
- safe transfer recommendation reuse
- rejection of unsafe transfer source
- `EXPEDITE_PO` assisted action creation
- no fake external execution
- multi-tenant isolation

---

## Explicit non-goals for 4B

Do not build these yet unless needed to support the normalized connector boundary:

- full ERP replacement
- supplier portal
- procurement CRUD suite
- direct email sending without a real integration
- fake supplier API calls
- AI-generated demand calculations
- LLM-based inventory math
- advanced vendor scorecards
- complex finance reconciliation
- broad procurement optimization

---

## Engineering rules

1. API-first, source-agnostic architecture.
2. CSV/XLSX is an adapter, not the product.
3. Preserve raw source records/files for auditability.
4. Keep deterministic math outside the LLM.
5. Reuse the existing forecasting, transfer, issue, action, audit, and verification layers.
6. Never fake a connector, supplier action, or execution status.
7. Maintain organization-level tenancy and RLS.
8. Keep migrations additive.
9. Keep the working loop narrow and real before expanding connector count.

---

## Definition of done

Sprint 4B is complete when Actnivo can ingest a PO through at least one adapter, normalize it into the shared PO model, compare expected supply arrival with projected demand/stockout, quantify financial risk, create a prioritized issue, recommend a safe action, route it through approval/execution, and preserve enough data for outcome verification.

The same intelligence flow must be reusable by future API connectors without rewriting the PO business logic.
