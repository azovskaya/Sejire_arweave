# ADR-0001: AO-first without application backend

## Status

Accepted

## Context

Classic genealogy apps need Postgres + Node API. That creates custody risk, monthly cost, and a kill-switch for family memory.

Arweave historically was “eternal disk”. AO + HyperBEAM now provide autonomous processes with holographic state.

## Decision

SEJIRE core logic MUST run as AO processes.  
No required SEJIRE-operated database for tree truth.

Optional centralized services (analytics, support UI hosting) MUST NOT be required to read or append history.

## Consequences

+ Trees survive project shutdown  
+ Lower ops cost  
− UX depends on wallets/gateways  
− Debugging distributed actors is harder  
