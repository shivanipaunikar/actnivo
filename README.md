# Actnivo

Actnivo is an AI commerce operations workspace for Indian D2C brands. It turns operational signals into a closed action loop:

**Detect → Explain → Quantify impact → Recommend → Approve → Execute → Verify**

## Prototype scope

- Executive command center with sales, orders, inventory value, revenue risk and protected revenue
- AI action queue with working approval, execution and verification states
- Channel performance for Shopify, Amazon, Flipkart and Blinkit, with support for additional marketplaces
- Inventory, purchase-order, stockout, overstock, returns and RTO health
- Warehouse fulfilment and quick-commerce availability views
- Responsive desktop and mobile layouts

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
```

This prototype uses realistic sample data and simulated execution states. Live channel connectors and persistent action workflows are the next implementation phase.
