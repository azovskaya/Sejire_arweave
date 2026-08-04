# SEJIRE sponsor edge + permaweb ops

## Why your scheme works — and what we change

**Your idea:** project wallet funds the network; user pays $3 by card to you; you top up Arweave “under the hood”.

**Keep:** fiat for users, project treasury for AR/Turbo, no token shopping.

**Change (more optimal):**

| Your sketch | Recommended |
|-------------|-------------|
| Card → bank account → manual AR top-up | Stripe Checkout → webhook/verify → **Turbo upload instantly** |
| User wallet needs AR | User never holds AR; edge (or Credit Share) pays |
| Site somehow “runs” from wallet balance | Site is a **one-time permaweb deploy** + rare redeploys from treasury |
| GitHub Pages only | Pages = mirror; **ArNS** = canonical decentralized URL |

Manual bank→AR is fine as a fallback, but automation removes delay and support load.

## Two wallets (conceptually)

1. **Treasury (project)** — Turbo credits + AR for:
   - SPA / ArNS redeploys
   - Sponsoring user vault uploads after $3 payment
2. **User seed wallet** — still derived for encryption identity / optional later Credit Share; **not** funded by the user in MVP.

## Cost reality check

- Typical sealed vault: kilobytes → Arweave/Turbo cost is **cents**, not dollars.
- $3 = storage + Stripe fee + margin + contribution to site endowment.
- Site (few MB static): cheap per deploy; ArNS is the larger recurring/name cost — budget from treasury, not per user.

## Implementation slices

### Slice 1 — Docs + skeleton (this PR)
- ADR-0006, flow 10, worker stub, env template.

### Slice 2 — Live sponsor edge
- Cloudflare Worker (or similar) with Stripe + Turbo.
- Wire `PublishSeedModal`: after seal → Checkout → POST envelope.

### Slice 3 — Permaweb site
- Project JWK in CI secrets.
- `permaweb-deploy` on release; set ArNS `sejire` (or chosen name).
- Keep Pages mirror.

### Slice 4 — Hardening
- Idempotency store (KV): `sessionId → txId`.
- Size quotas, rate limits, refunds.
- Optional Credit Share (user-signed data items).

## What we need from you to go live

1. Stripe account (test + live keys).
2. Settlement account / card payout destination (already implied by “на наш счёт”).
3. Decision: ArNS name to buy (`sejire` etc.).
4. Initial treasury top-up (Turbo credits via fiat once — ironically the only crypto step, done by the team).

Until secrets exist, the app keeps the current “fund your derived address” path as fallback behind a flag.
