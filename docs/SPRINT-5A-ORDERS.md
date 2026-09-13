# Sprint 5A — Unified Orders Workspace

Actnivo normalizes orders from any source, detects fulfillment exceptions, ranks them by financial exposure, and feeds the same issue/action/Copilot loop used elsewhere.

## Scope
- API-first `orders` and `order_lines` model with org-scoped RLS.
- Unified order list + detail page.
- Deterministic delayed/stuck/RTO-risk detection.
- Ops Inbox issue generation.
- Copilot order-health context and questions.
- No fake carrier, marketplace, refund, or customer communication execution.

## Initial policy
- Processing/unfulfilled beyond promised ship time is delayed.
- More than 24 hours beyond promised ship time without shipment is stuck.
- COD + at least one failed delivery attempt is RTO risk.
- Financial exposure uses stored order value; the LLM never calculates or invents it.
