# Sprint 4B implementation status

Implementation is in progress on `sprint-4b-po-intelligence`.

Built so far:
- API-first normalized purchase order model
- organization-scoped PO tables and RLS
- deterministic PO-vs-stockout risk calculations
- safe-transfer-first recommendations with assisted expedite fallback
- Purchase Orders list and detail workspaces
- receipt updates and PO status progression
- PO issue generation for Ops Inbox
- assisted `EXPEDITE_PO` action preparation and verification hooks
- unit coverage for risk math, status transitions, and migration invariants

Before merge:
- wire PO issue-specific UX into Ops Inbox and Action detail
- run CI (typecheck/build/tests) and fix any failures
- verify the migration parses cleanly against PostgreSQL/Supabase
- merge only after checks are green
