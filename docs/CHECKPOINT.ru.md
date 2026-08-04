# SEJIRE — чекпоинт продолжения работы

> **С этого места продолжать доработку.**  
> Дата: **2026-07-27**  
> Ветка: `cursor/from-baseline-5d33`  
> Коммит: `c9769c3` (`Always show FIO and birth/death dates on PDF cards`)  
> Тег: `sejire-v0.4-checkpoint`  
> PR: https://github.com/azovskaya/Sejire_arweave/pull/4  

Старые решения владельца не переспрашивать: [`LOCKED_DECISIONS.ru.md`](./LOCKED_DECISIONS.ru.md).  
План Arweave/Kaspi: [`PERMAWEB_ROLLOUT.ru.md`](./PERMAWEB_ROLLOUT.ru.md).

---

## 1. Где смотреть живое

| Что | URL |
|-----|-----|
| Приложение (зеркало Pages) | https://azovskaya.github.io/Sejire_arweave/ |
| Investor deck (HTML) | https://azovskaya.github.io/Sejire_arweave/presentation/ |
| Investor deck (PPTX) | https://azovskaya.github.io/Sejire_arweave/presentation/SEJIRE-investor-deck.pptx |
| Investor deck (PDF) | https://azovskaya.github.io/Sejire_arweave/presentation/SEJIRE-investor-deck.pdf |
| Канон (цель) | `https://sejire.ar.io` — **имя куплено (Phantom/ARIO)**; сайт ещё не привязан |

Деплой зеркала: из корня `npm run deploy:pages` (сохраняет `presentation/`).

---

## 2. Что уже работает в продукте (не ломать без нужды)

### Редактор древа (`apps/web`)
- Старт с себя; `+ Папа / + Мама / + Ребёнок`
- Автосохранение черновика в `localStorage`
- Схема предков до **7** поколений
- Двойной клик = смотреть от предка; **«К себе» / «Вернуть ко мне»** возвращает фокус
- Гибкие даты текстом (`1990` или `15.03.1990`) — не `type=date`
- Панель профиля: ФИО, пол, даты, места, захоронение, занятие, заметки
- **Мобильный:** тап по карточке открывает профиль снизу (sheet), не «панель под схемой»

### Экспорт
- **Древо в PDF** — landscape, слоты без пересечения линий, ФИО + даты рождения/смерти
- **Жеті ата PDF** — орнаментальный вертикальный шежіре (қосқар мүйіз-мотивы)
- **Выгрузить / Загрузить JSON** — полный бэкап (`sejire/tree-export/v1`: store + guide)

### Вечность (базовый путь)
- 12 слов BIP-39 → шифр на устройстве → публикация envelope в Arweave (сейчас ещё путь «нужен AR на derived-кошельке»)
- Restore по 12 словам **без** банка/кассира

### Документы / презентация
- Investor deck в стиле Arweave + PDF
- ADR-0006, sponsor skeleton `apps/sponsor`, competitive notes

---

## 3. Ключевые файлы кода

| Зона | Путь |
|------|------|
| UI workspace | `apps/web/src/components/Workspace.tsx` |
| Схема | `apps/web/src/components/PedigreeView.tsx`, `lib/pedigree.ts` |
| Даты | `apps/web/src/lib/dates.ts` |
| JSON backup | `apps/web/src/lib/treeJson.ts` |
| Classic PDF | `apps/web/src/lib/pdf/classicTreePdf.ts`, `lineage.ts` |
| Жеті ата PDF | `apps/web/src/lib/pdf/shezhirePdf.ts`, `ornaments.ts` |
| Крипто / сейф | `apps/web/src/lib/crypto/*`, `arweave/*` |
| Кассир (скелет) | `apps/sponsor/` |
| Деплой Pages | `scripts/deploy-pages.sh` |

Тесты: `cd apps/web && npm test`

---

## 4. Что делать дальше (очередь)

Порядок из [`PERMAWEB_ROLLOUT.ru.md`](./PERMAWEB_ROLLOUT.ru.md) §5 + решения владельца:

1. **Владелец:** ~~купить ArNS `sejire`~~ **сделано** (Phantom + ARIO). Дальше — деплой SPA и Configure Domain.
2. **Код:** dual-base Vite (`/` для ArNS, `/Sejire_arweave/` для Pages) + CI permaweb-deploy.
3. **Привязать** `sejire.ar.io` → TX манифеста; Pages оставить зеркалом.
4. **Kaspi:** после ИП/ТОО + мерчант — тонкий кассир (оплата → Turbo upload ciphertext). До этого не блокировать бесплатный слой.
5. Переключить «В Arweave» на sponsor-путь (флаг); self-fund оставить fallback.
6. Позже: AO Lua live, медиа, GEDCOM (Phase 3–4).

**Не начинать** с переписывания редактора на Lua — SPA на TypeScript остаётся; на Arweave кладём собранные файлы.

---

## 5. Открытые хвосты у владельца (единственное, что можно спросить)

1. Имя `sejire` уже куплено навсегда? (**да**)
2. Казна (ArConnect с AR) готова к деплою сайта? (да/нет — **не** присылать ключ в чат)
3. Есть / будет ИП или ТОО под Kaspi для бизнеса?

Всё остальное из LOCKED_DECISIONS — закрыто.

---

## 6. Как поднять работу агенту / разработчику

```bash
git fetch origin
git checkout cursor/from-baseline-5d33   # или тег sejire-v0.4-checkpoint
cd apps/web && npm ci && npm test && npm run dev
# выкладка зеркала:
cd ../.. && npm run deploy:pages
```

Читать сначала:
1. этот файл (`CHECKPOINT.ru.md`)
2. `LOCKED_DECISIONS.ru.md`
3. `PERMAWEB_ROLLOUT.ru.md`
4. `LIVE.md`

---

## 7. Инварианты безопасности (не нарушать)

- 12 слов не уходят с устройства
- Кассир видит только ciphertext + факт оплаты
- Казна ≠ личный seed пользователя
- Restore по словам не зависит от кассира
