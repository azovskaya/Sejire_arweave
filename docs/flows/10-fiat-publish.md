# Flow 10 — Fiat publish ($3) → sponsored Arweave

Related ADR: [0006-sponsored-fiat-publish.md](../adr/0006-sponsored-fiat-publish.md)

## Happy path

1. User builds a tree (local draft).
2. Clicks **В Arweave**.
3. Creates or enters **12 words** (device only) → vault sealed.
4. Pays **$3** via Stripe Checkout (card).
5. Client sends `{ envelope, stripeSessionId }` to sponsor edge.
6. Edge verifies payment, uploads via Turbo, returns `txId`.
7. UI shows success + explorer link; restore still works from 12 words.

## Failure path

| Failure | Handling |
|---------|----------|
| Card declined | No upload |
| Payment ok, upload fails | Edge retries; then refund |
| Envelope too large | Reject before charge or after quote |
| Replay same session | Idempotent: return existing txId |

## Security

- Seed / mnemonic: never in request body.
- Envelope: ciphertext only.
- Edge auth: Stripe signature + paid session check.
- Size limit: e.g. 512 KiB MVP (genealogy JSON + meta).
