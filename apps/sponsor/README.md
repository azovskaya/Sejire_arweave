# Sponsor edge (Cloudflare Worker) — SEJIRE cashier

Thin **payment verify → Turbo upload** for sealed vault envelopes.
Never handles BIP-39 / plaintext trees.

Locked rail for KZ: **Kaspi Pay Business** (ИП/ТОО). Until merchant exists, `PAYMENT_PROVIDER=mock`.

See `docs/LOCKED_DECISIONS.ru.md`, ADR-0006, `docs/flows/10-fiat-publish.md`.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/health` | Liveness + price |
| POST | `/v1/checkout` | Create payment session |
| POST | `/v1/mock-pay` | Mark session paid (**mock only**) |
| POST | `/v1/publish` | `{ sessionId, envelope }` → verify → upload → `{ txId }` |

## Local mock

```bash
cd apps/sponsor
npm install
npm test
# optional live worker:
# npx wrangler dev
```

Web app (sponsor path):

```bash
# apps/web/.env.local
VITE_PUBLISH_MODE=sponsor
VITE_SPONSOR_URL=http://127.0.0.1:8787
```

## Going live (Kaspi)

1. ИП/ТОО + Kaspi для бизнеса + API token  
2. `PAYMENT_PROVIDER=kaspi`  
3. `npx wrangler secret put KASPI_MERCHANT_TOKEN`  
4. Wire Kaspi order create in `src/payments.ts`  
5. `npx wrangler secret put TURBO_JWK` (treasury)  
6. KV namespace for idempotency → uncomment in `wrangler.toml`  
7. Set `APP_ORIGIN` to Pages + `https://sejire.ar.io`

## Security

- Reject bodies with `mnemonic` / `seed` / `trees` / …
- Only `sejire/envelope/v1` ciphertext
- One paid session → one upload (idempotent)
- Restore-by-12-words never needs this Worker
