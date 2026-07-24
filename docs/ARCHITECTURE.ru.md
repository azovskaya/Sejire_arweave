# SEJIRE — архитектура дешёвого децентрализованного MVP

Цель: протокол вечного хранения генеалогических структур **без дорогих серверов**, с суверенитетом пользователя (BIP-39) и фиксацией на Arweave + AO.

## Принцип

```
Черновик (бесплатно, локально)
        ↓  «Зафиксировать навечно»
Шифрование на устройстве (AES-GCM + BIP-39)
        ↓
Публикация JSON на Arweave (раз за дерево / коммит)
        ↓
AO-процесс = живое состояние древа (Parent_TX chain)
```

SEJIRE — не SaaS с SQL. SEJIRE — **слой данных** + тонкий клиент.

---

## Что разворачивать (минимум)

| Слой | Решение | Стоимость |
|------|---------|-----------|
| Презентация / лендинг | Статика (`presentation/`) | $0 |
| Web-приложение (черновик + просмотр) | Vite + React/TS, статический билд | $0 на хостинг |
| Хостинг UI | Arweave (permaweb) или GitHub Pages / Cloudflare Pages | $0–разово ~$1–5 за UI |
| Черновики | IndexedDB / localStorage в браузере | $0 |
| Ключи | BIP-39 seed + WebCrypto (клиент) | $0 |
| Вечное хранилище | Arweave через Irys / Turbo | ~$0.005–0.05 за текстовое дерево |
| Логика древа | AO process (Lua/JS handler) | газ AO, копейки на операции |
| Опциональный индекс | GraphQL gateway Arweave (публичный) | $0 |

**Не нужно на старте:** свой backend, Postgres, Kubernetes, monthly cloud, KYC-хранилища паролей.

---

## Рекомендуемый стек

### 1. Клиент (`apps/web`)

- Vite + React + TypeScript
- `bip39` + `@noble/hashes` / WebCrypto для seed → AES ключ
- Редактор дерева: узлы (person), рёбра (parent/spouse), даты, координаты
- Режим **Draft**: всё локально
- Режим **Commit**: сериализация → encrypt → upload

### 2. Формат данных («Цифровой гранит»)

Только UTF-8 JSON. Без медиа внутри протокола.

```json
{
  "schema": "sejire/tree/v1",
  "tree_id": "did:sejire:…",
  "parent_tx": null,
  "created_at": "2026-07-24T00:00:00Z",
  "persons": [
    {
      "id": "p1",
      "name": "Ayan Bekmuratov",
      "born": "1894-03-12",
      "died": null,
      "place": { "lat": 43.238, "lon": 76.945 },
      "parents": [],
      "notes": ""
    }
  ],
  "meta": {
    "encrypted": true,
    "cipher": "AES-GCM-256",
    "kdf": "HKDF-SHA256"
  }
}
```

Каждый коммит ссылается на `parent_tx` предыдущей транзакции Arweave — git-подобная история.

### 3. Публикация на Arweave

1. Пользователь платит **один раз** (кошелёк AR / Turbo credits).
2. Клиент шлёт транзакцию с тегами:
   - `App-Name: SEJIRE`
   - `Type: tree-commit`
   - `Tree-Id: …`
   - `Parent-Tx: …`
3. Endowment Arweave обеспечивает 200+ лет хранения.

### 4. AO Computer

- Один **AO process на древо** (actor).
- Сообщения: `append_commit`, `get_head`, `list_history`.
- Состояние восстанавливается из Arweave (gologram), не с серверов SEJIRE.
- На MVP можно начать **без AO**: только цепочка TX по тегам GraphQL, AO добавить как «мозг» v2.

---

## Фазы внедрения (дешёвый путь)

### Phase 0 — Презентация (этот репозиторий)

- Слайды инвесторам / партнёрам
- Архитектурный документ
- Стоимость: $0

### Phase 1 — Локальный редактор + экспорт

- UI древа, BIP-39 wallet create/import
- Encrypt/decrypt JSON
- Export файла (offline-first)
- Стоимость: только время разработки

### Phase 2 — Фиксация на Arweave

- Irys/Turbo upload
- Теги + GraphQL поиск «моих» деревьев
- Pay-once UX («вечная фиксация»)
- Оценка: ~$0.005–0.05 / коммит текста

### Phase 3 — AO + API для партнёров

- AO process template
- Read API (REST/GraphQL поверх публичных gateways)
- White-label «бэкенд для вечности»

---

## Модель денег (согласована с презентацией)

- **Пользователь:** разовый Endowment Fee (Arweave) + Service Fee (протокол/UX)
- **Нет** monthly subscription за хранение
- **Гибрид:** Web2-черновик бесплатно → Web3 только при фиксации
- Операционные расходы команды ≈ домен + редкие обновления UI на permaweb (не аренда серверов)

---

## Безопасность (обязательный минимум)

1. Seed никогда не уходит на сервер.
2. Plaintext имён/дат не попадает в логи.
3. После commit удаление невозможно — UI обязан warn + confirm.
4. Recovery: только BIP-39; нет «forgot password».
5. Опционально: Shamir 2-of-3 для семейного доступа (позже).

---

## Что купить / зарегистрировать

| Нужно | Зачем | Дорого? |
|-------|-------|---------|
| Домен (опционально) | sejire.org / .kz | низко |
| AR / Turbo credits | тестовые и демо-фиксации | низко |
| GitHub | код + Pages | бесплатно |
| ArConnect / Wander | кошельки для теста | бесплатно |
| AO testnet/mainnet | процессы | низко |

**Не покупать на старте:** VPS, RDS, CDN-подписки, enterprise KYC.

---

## Риски и смягчение

| Риск | Смягчение |
|------|-----------|
| Пользователь потерял seed | Образование + опциональный Shamir / social recovery позже |
| Дорогой AR | Текст-only JSON; коммиты дельтой; batch |
| Сложность Web3 UX | Черновик без кошелька; кошелёк только на commit |
| AO ещё молод | Phase 2 без AO, только Arweave tags |

---

## Критерий успеха MVP

1. Создать древо из 20 человек офлайн.
2. Зашифровать seed-фразой.
3. Зафиксировать на Arweave один раз.
4. На другом устройстве восстановить древо **только** seed + Tree-Id / TX.
5. Доказать, что удалить commit нельзя.

---

## Структура репозитория (целевая)

```
/
  presentation/          # эта презентация
  docs/ARCHITECTURE.ru.md
  apps/web/              # клиент (следующий этап)
  packages/schema/       # JSON schema sejire/tree/v1
  ao/processes/          # AO handlers (этап 3)
```

Открыть слайды: [`presentation/index.html`](../presentation/index.html)
