# SEJIRE

**Создание неизменяемой ткани человеческой истории.**

Протокол вечного версионного хранения родовых деревьев.  
**Доступ с любой точки мира — по 12 словам BIP-39.**

## Пользовательский путь

**Открыть сейчас:** https://cdn.jsdelivr.net/gh/azovskaya/Sejire_arweave@gh-pages/index.html  
(зеркало: https://raw.githack.com/azovskaya/Sejire_arweave/gh-pages/index.html · детали: [`docs/LIVE.md`](./docs/LIVE.md))

1. Создать сейф → записать 12 слов  
2. Добавить предков → «Зафиксировать версию» (история не стирается)  
3. «Экспорт» (файл) или «В вечность» (Arweave, нужен небольшой AR)  
4. На другом устройстве: ввести те же 12 слов → древо открывается  

```bash
cd apps/web && npm install && npm run dev
```

## Структура

| Путь | Содержание |
|------|------------|
| `docs/` | Протокол, процессы, flows, ADR, security |
| `docs/security/SEED_ACCESS.md` | Деривация 12 слов → ключи / vaultId |
| `apps/web` | Клиент: onboarding + editor + publish |
| `ao/processes` | Lua Tree / Factory (Phase 3 on-chain wiring) |
| `packages/schema` | JSON Schema |
| `presentation/` | Презентация |

## Статус

- ✅ Phase 0–1: docs + versioned local engine  
- ✅ Phase 2: BIP-39, AES-GCM vault, Arweave envelope publish/fetch  
- ⏳ Phase 3: live AO process commits, ArNS, Shamir  

Подробнее: [`docs/roadmap/PHASES.ru.md`](./docs/roadmap/PHASES.ru.md)
