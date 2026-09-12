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

Apply the SQL files in `supabase/migrations` to the project. The initial migration creates organization, profile, membership, onboarding-channel, RLS, and private organization-asset storage policies.

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
- `/logout`: clears the Supabase session.

Authorization comes from `organization_members`, never user-editable Auth metadata. Every exposed business table has RLS and explicit grants.

## Validation

```bash
npm run lint
npm run typecheck
npm test
```

Inventory intelligence, channel connectors, automated actions, and AI are intentionally outside this foundation phase.
