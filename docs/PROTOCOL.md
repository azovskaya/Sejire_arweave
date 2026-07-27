# SEJIRE Protocol Specification

**Status:** Draft v0.2  
**Schema namespace:** `sejire/*`  
**Normative language:** MUST / SHOULD / MAY (RFC 2119)

---

## 1. Purpose

SEJIRE is a decentralized application protocol for **versioned genealogical trees**.

Core guarantee:

> Every mutation of a family tree MUST produce a new immutable commit.  
> Prior commits MUST remain readable forever. History MUST NOT be erased.

SEJIRE is **not** a hosted SaaS database. It is a data + compute layer on Arweave + AO.

---

## 2. Actors

| Actor | Role |
|-------|------|
| **Owner** | Arweave address authorized to `Commit` / manage ACL |
| **Reader** | Anyone who can query public process state / history |
| **Factory Process** | Spawns Tree Processes |
| **Tree Process** | One autonomous AO process per family tree |
| **Client (UI)** | Signs messages, holds draft, renders versions |
| **Gateway / HyperBEAM** | Message delivery + HTTP state access (replaceable) |

---

## 3. Identifiers

| ID | Format | Notes |
|----|--------|-------|
| `tree_id` | AO process id | Equals `ao.id` of Tree Process after spawn |
| `commit_id` | `c_<version>_<suffix>` | Unique within tree |
| `person.id` | opaque string | Stable across commits if same person |
| `media.tx` | Arweave TX id | 43-char base64url typical |

---

## 4. Data model

### 4.1 Person

See `packages/schema/person-v1.schema.json`.

Required: `id`, `name`.  
Optional: `born`, `died`, `place`, `parents[]`, `media[]`, `notes`, `tombstone`.

`tombstone: true` means the person is **removed in this version**, not deleted from history.

### 4.2 Snapshot

```json
{ "persons": { "<person_id>": { /* Person */ } } }
```

A snapshot is a **complete** tree state at a version (not a delta).  
Clients MAY compute deltas for UX, but the protocol stores full snapshots.

### 4.3 Commit

See `packages/schema/commit-v1.schema.json`.

| Field | Rule |
|-------|------|
| `schema` | MUST be `sejire/commit/v1` |
| `parent_commit_id` | MUST equal current HEAD (or `null` for genesis) |
| `version` | MUST be monotonic integer starting at 1 |
| `snapshot` | MUST contain full `persons` map |
| `message` | SHOULD describe the human intent of the change |

### 4.4 Tree Process State

```
Tree = {
  id, title, owners{},
  head,                    -- commit_id | nil
  commits{commit_id},      -- immutable map
  versions{n -> commit_id},
  next_version,            -- integer
  created_at
}
```

---

## 5. Versioning rules (normative)

1. `Commit` MUST NOT mutate an existing commit object.
2. `Commit` MUST set `parent_commit_id` to current `head` (linear history in v1).
3. If `parent_commit_id` ≠ `head`, process MUST reject with `StaleParent`.
4. Soft-delete MUST use `tombstone` inside a new commit.
5. Clients MUST be able to reconstruct any past version via `GetCommit`.

Forks (branching history) are **out of scope for v1** (see ADR-0004).

---

## 6. Storage tiers

| Tier | Stores | Must not store |
|------|--------|----------------|
| AO Tree Process | graph, commits, ACL, media refs | large binaries |
| Arweave Permaweb | photos, scans, audio blobs | authoritative graph alone |
| Client local draft | uncommitted edits | source of truth after commit |

---

## 7. Authorization

1. First successful `Init` or `Commit` from address A bootstraps `owners[A]=true` if owners empty.
2. Subsequent `Commit` / `AddOwner` / `RemoveOwner` MUST require `is_owner(msg.From)`.
3. `Info`, `GetHead`, `GetCommit`, `History`, `Ping` MAY be public (v1 default).

Encryption of person names (client-side AES + BIP-39) is **Phase 2+** (see security docs).  
v0.2 stores plaintext in process state for protocol bootstrap; production SHOULD encrypt before commit.

---

## 8. Message surface

Normative catalog: [`processes/MESSAGE_CATALOG.md`](./processes/MESSAGE_CATALOG.md).

Tree Process actions: `Init`, `Info`, `Commit`, `GetHead`, `GetCommit`, `History`, `AddOwner`, `RemoveOwner`, `Ping`.  
Factory Process actions: `SpawnTree`, `ListTrees`, `Info`.

---

## 9. Compatibility

| Version | Notes |
|---------|-------|
| `sejire/commit/v1` | Current |
| `sejire/tree/v1` | Legacy aggregate schema; prefer commit stream |

Clients MUST ignore unknown person fields (forward compatible).  
Process SHOULD reject unknown required schema constants.

---

## 10. Reference implementation map

| Concern | Path |
|---------|------|
| Tree AO logic | `ao/processes/tree.lua` |
| Factory AO logic | `ao/processes/factory.lua` |
| Local engine (mirrors protocol) | `apps/web/src/lib/treeEngine.ts` |
| JSON Schemas | `packages/schema/` |
| Process docs | `docs/processes/` |
