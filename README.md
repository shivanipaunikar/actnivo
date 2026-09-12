# Actnivo

Actnivo is a multi-tenant commerce operations SaaS for Indian D2C brands. The public marketing site remains at `/`; authenticated customer workspaces live under `/app`.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup

Create a Supabase project, then copy its Project URL and current publishable key from the Connect dialog into `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Do not add a service-role or secret key to a `NEXT_PUBLIC_` variable. This application does not require a service-role credential.

Apply the SQL files in `supabase/migrations` in filename order. The migrations create organization membership, the commerce/import model, RLS, and private organization-scoped storage. Raw files use paths shaped like `<organization-id>/imports/<job-id>/<filename>` inside the private `commerce-imports` bucket.

In Supabase Auth settings:

1. Enable Email authentication.
2. Add `http://localhost:3000/auth/callback` as a local redirect URL.
3. Add the production `/auth/callback` URL before deployment.
4. Keep email confirmation enabled for production.

## Application flow

- `/login` and `/signup`: password authentication and optional magic link.
- `/auth/callback`: PKCE code exchange.
- `/onboarding/company` and `/onboarding/channels`: organization creation and channel selection.
- `/app/*`: server-protected tenant workspace.
- `/app/integrations/import`: CSV/XLSX inventory and sales import wizard.
- `/app/inventory/sku-mapping`: deterministic SKU review and bulk mapping.
- `/app/inventory`: current normalized inventory with filters and SKU detail pages.
- `/logout`: clears the Supabase session.

Authorization comes from `organization_members`, never user-editable Auth metadata. Every exposed business table has RLS and explicit grants. Inventory snapshots are append-only: authenticated clients receive only `select` and `insert`, and import retries skip existing source rows.

## Import limits and required columns

Uploads accept CSV and XLSX files up to 10 MB and 25,000 data rows. Inventory requires SKU, location, available quantity, and snapshot date. Sales requires SKU, channel, date, units sold, and gross sales. Optional fields can be mapped during preview.

SKU matching is deterministic: exact barcode, exact SKU, normalized SKU, then product/variant/pack-size similarity. Similarity matches require human approval before import; no LLM is used.

## Validation

```bash
npm run lint
npm run typecheck
npm test
```

### Isolated Supabase integration tests

The two-user database and Storage RLS suite is intentionally separate because it creates and deletes test users and organizations. Run it only against a disposable local or hosted test project with all migrations applied:

```bash
SUPABASE_TEST_URL=https://your-test-project.supabase.co \
SUPABASE_TEST_PUBLISHABLE_KEY=sb_publishable_test_key \
SUPABASE_TEST_SERVICE_ROLE_KEY=your_test_admin_key \
SUPABASE_TEST_ISOLATED=true \
npm run test:integration
```

The admin key is used only for fixture setup and cleanup. Every authorization assertion uses a password-authenticated publishable-key client representing User A, User B, or a viewer. Never use the production project for this suite and never expose the test admin key through a `NEXT_PUBLIC_` variable.

Advanced inventory recommendations, live marketplace connectors, automated actions, and AI are intentionally outside this sprint.
