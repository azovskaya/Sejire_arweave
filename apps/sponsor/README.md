# Sponsor edge (Cloudflare Worker) — SEJIRE cashier

Thin **payment verify → Turbo upload** for sealed vault envelopes.
Never handles BIP-39 / plaintext trees.

Locked rail for KZ: **Kaspi Pay Business** (ИП/ТОО). Until merchant exists, `PAYMENT_PROVIDER=mock`.

See `docs/LOCKED_DECISIONS.ru.md`, ADR-0006, `docs/flows/10-fiat-publish.md`.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/health` | Liveness + price + `kaspiReady` / `treasuryReady` |
| POST | `/v1/checkout` | Create payment session (Kaspi `payUrl` when live) |
| POST | `/v1/mock-pay` | Mark session paid (**mock only**) |
| GET | `/v1/session` | Poll payment (`paid` after Kaspi / mock) |
| POST | `/v1/kaspi-webhook` | Kaspi HMAC callback |
| POST | `/v1/publish` | `{ sessionId, envelope }` → verify → Turbo upload → `{ txId }` |
| GET | `/admin` | Ops desk (counts + times, no user data) |
| GET | `/v1/admin/overview` | Same JSON (`Authorization: Bearer ADMIN_TOKEN`) |

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

Protocol is wired (Merchant API v2: HMAC invoice, poll, webhook). Remaining is cabinet + secrets:

1. На Mac: `npm run treasury:init` — файл `treasury.local.json` не в git (см. `docs/TREASURY_AND_ADMIN.ru.md`)
2. ИП/ТОО + Kaspi Pay Business + API token + Trade Point Id  
3. `npx wrangler kv namespace create IDEMPOTENCY` → uncomment in `wrangler.toml`  
4. `npx wrangler secret put KASPI_MERCHANT_TOKEN`  
5. Optional: `KASPI_TRADE_POINT_ID` / `KASPI_API_BASE` (`https://testpay.kaspi.kz/api/v2` for sandbox)  
6. `PAYMENT_PROVIDER=kaspi` in `[vars]`  
7. `npx wrangler secret put TURBO_JWK` и `npx wrangler secret put ADMIN_TOKEN`  
8. Set `APP_ORIGIN` to Pages + `https://sejire.ar.io`  
9. In Kaspi cabinet, webhook = `https://<worker>/v1/kaspi-webhook`
10. Админка: `https://<worker>/admin`

## Security

- Reject bodies with `mnemonic` / `seed` / `trees` / …
- Only `sejire/envelope/v1` ciphertext
- One paid session → one upload (idempotent)
- Restore-by-12-words never needs this Worker
