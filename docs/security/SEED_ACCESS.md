# Access by 12 words (BIP-39)

**Goal:** Anyone who knows the 12-word phrase can open their SEJIRE vault from any device, anywhere. No email, no SEJIRE account.

## Derivation

```
mnemonic (12 words, BIP-39 English)
    │
    ▼
seed = PBKDF2(mnemonic)          // bip39 mnemonicToSeed
    │
    ▼
master = HKDF-SHA256(seed, info="sejire/v1")
    ├── encKey   = HKDF(master, info="enc")     // AES-256-GCM
    ├── vaultId  = SHA256(master || "vault")[0:16 hex]  // public locator
    └── arweave JWK = RSA-2048 via deterministic PRNG(seed)  // ownership / publish
```

Same 12 words ⇒ same `vaultId`, same encryption key, same Arweave address.

## Vault envelope (what is stored forever)

Published to Arweave (and cached locally encrypted):

```json
{
  "schema": "sejire/envelope/v1",
  "vault_id": "…",
  "cipher": "aes-gcm-256",
  "kdf": "hkdf-sha256",
  "iv": "<base64>",
  "ciphertext": "<base64>"
}
```

Plaintext vault (never uploaded raw):

```json
{
  "schema": "sejire/vault/v1",
  "vault_id": "…",
  "trees": { "<tree_id>": /* TreeStore */ },
  "active_tree_id": "…"
}
```

Arweave tags:

| Tag | Value |
|-----|-------|
| `App-Name` | `SEJIRE` |
| `Protocol` | `sejire/v0.3` |
| `Type` | `vault-envelope` |
| `Vault-Id` | `vaultId` |

## Recovery algorithm

1. User enters 12 words
2. Client derives `encKey` + `vaultId` (+ wallet)
3. Load local envelope for `vaultId` if present
4. Else GraphQL: transactions with `App-Name=SEJIRE` and `Vault-Id=vaultId`, newest first
5. Decrypt envelope → restore trees + history
6. Without the 12 words, ciphertext is noise

## Security notes

- Seed NEVER leaves the device / never sent to SEJIRE servers (there are none required)
- Show seed once at creation; require re-entry confirmation
- Public `vaultId` does not reveal family data
- Losing the 12 words = losing write access and decryption (warn clearly)

See also: `docs/security/KEY_MANAGEMENT.ru.md`, `docs/flows/07-seed-access.md`
