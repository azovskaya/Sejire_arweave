# Sponsor edge (Cloudflare Worker)

Thin payment + Turbo upload service for SEJIRE.
See `/docs/SPONSOR_AND_PERMAWEB.ru.md` and ADR-0006.

## Setup (when going live)

```bash
cd apps/sponsor
npm install
npx wrangler kv namespace create sejire-idempotency
# put id into wrangler.toml

npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put TURBO_JWK
```

Never put the user BIP-39 seed here.
