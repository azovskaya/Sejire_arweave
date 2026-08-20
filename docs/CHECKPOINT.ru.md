# SEJIRE — чекпоинт продолжения работы

> **С этого места продолжать доработку.**  
> Дата: **2026-08-20**  
> Ветка: `cursor/ao-protocol-v03-82e4`  
> Протокол: **`sejire/v0.3`**  
> Предыдущий продукт-чекпоинт: v0.4 (`sejire-v0.4-checkpoint`, permaweb upload)

Старые решения владельца не переспрашивать: [`LOCKED_DECISIONS.ru.md`](./LOCKED_DECISIONS.ru.md).  
План Arweave/Kaspi: [`PERMAWEB_ROLLOUT.ru.md`](./PERMAWEB_ROLLOUT.ru.md).  
Норматив протокола: [`PROTOCOL.md`](./PROTOCOL.md).

---

## 1. Где смотреть живое

| Что | URL |
|-----|-----|
| Приложение (зеркало Pages) | https://azovskaya.github.io/Sejire_arweave/ |
| Investor deck (HTML) | https://azovskaya.github.io/Sejire_arweave/presentation/ |
| Канон (цель) | `https://sejire.ar.io` — **имя куплено (Phantom/ARIO)**; Target ID после `npm run deploy:permaweb` |

Сайт уже открывается на **https://sejire.ar.io/**. На текущем манифесте (до этой ветки) схема из 7 пустых поколений уводила карточку «себя» за край экрана — после «Начать» канвас казался пустым. Исправление: компактная раскладка + центр на фокусе; в сборке всегда есть `404.html` для ArNS fallback. **Нужен повторный `npm run deploy:permaweb` + обновить Target ID в ArNS.**

---

## 2. Что уже работает (не ломать без нужды)

Всё из v0.4: редактор до 7 поколений, PDF, JSON backup, 12 слов → envelope, Pages-зеркало, кассир mock.

### Протокол v0.3 (этот чекпоинт)

- Tree Process: `GetAncestors`, `GetJetiAta`, `Relate` (публичное чтение HEAD или `Commit-Id`)
- Коды родства: `packages/schema/kinship-codes.json` (не локализованные строки в процессе)
- Тестовый двойник Lua: `apps/web/src/lib/ao/treeProcess.ts` + `SejireAoClient`
- Selftest: `cd apps/web && npm run test:protocol`
- Live aos: `.load ao/processes/tree.lua` — те же Action; process id в `VITE_SEJIRE_FACTORY_ID` когда задеплоен

---

## 3. Ключевые файлы

| Зона | Путь |
|------|------|
| Lua Tree (норматив on-chain) | `ao/processes/tree.lua` |
| AO client / simulator | `apps/web/src/lib/ao/*` |
| Kinship codes | `apps/web/src/lib/kinship.ts` |
| Schemas | `packages/schema/{ancestors,jeti-ata,relate}-v1.schema.json` |
| UI workspace | `apps/web/src/components/Workspace.tsx` |
| Permaweb upload | `scripts/deploy-permaweb.sh` |

Тесты: `cd apps/web && npm test`

---

## 4. Что делать дальше

1. **Владелец:** привязать `sejire.ar.io` → TX манифеста (Phantom → arns.ar.io). Ключ в чат не слать.
2. **aos:** задеплоить Factory + Tree module; прописать `VITE_SEJIRE_FACTORY_ID` + `VITE_AO_MODE=live`.
3. **UI:** экран «Родство» / жеті ата из `Relate` + `GetJetiAta` (сейчас расчёт локальный в SPA).
4. **Kaspi live** — после ИП/мерчанта; не блокирует протокол.
5. Позже: медиа Turbo, GEDCOM, encrypted-commit profile для публичного AO.

**Не начинать** с переписывания редактора на Lua.

---

## 5. Открытые хвосты у владельца

1. Казна (Wander/ArConnect) готова к деплою сайта? (да/нет — **не** присылать ключ)
2. Есть / будет ИП или ТОО под Kaspi?
3. Live Factory process id — когда появится после aos.

Всё остальное из LOCKED_DECISIONS — закрыто.

---

## 6. Как поднять работу

```bash
git fetch origin
git checkout cursor/ao-protocol-v03-82e4
cd apps/web && npm ci && npm test && npm run dev
```

Читать сначала:
1. этот файл
2. `PROTOCOL.md` (v0.3)
3. `LOCKED_DECISIONS.ru.md`
4. `PERMAWEB_ROLLOUT.ru.md`

---

## 7. Инварианты безопасности (не нарушать)

- 12 слов не уходят с устройства
- Кассир видит только ciphertext + факт оплаты
- Казна ≠ личный seed пользователя
- Restore по словам не зависит от кассира
- Kinship queries на AO читают snapshot процесса; приватный род остаётся в encrypted envelope
