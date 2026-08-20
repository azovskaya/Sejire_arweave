# Живые ссылки SEJIRE

**Чекпоинт продолжения:** [`CHECKPOINT.ru.md`](./CHECKPOINT.ru.md) (ветка `cursor/ao-protocol-v03-82e4`, протокол `sejire/v0.3`).

## Канон (цель)

**https://sejire.ar.io** — сайт на Arweave (имя куплено; Target ID после `npm run deploy:permaweb`).  
Решения: [`LOCKED_DECISIONS.ru.md`](./LOCKED_DECISIONS.ru.md).

## Зеркало сейчас (GitHub Pages)

**https://azovskaya.github.io/Sejire_arweave/**

Презентация (HTML): https://azovskaya.github.io/Sejire_arweave/presentation/  
PPTX: https://azovskaya.github.io/Sejire_arweave/presentation/SEJIRE-investor-deck.pptx  
PDF: https://azovskaya.github.io/Sejire_arweave/presentation/SEJIRE-investor-deck.pdf

Источник деплоя: ветка [`gh-pages`](https://github.com/azovskaya/Sejire_arweave/tree/gh-pages).

## Репозиторий

- Код: https://github.com/azovskaya/Sejire_arweave  
- Рабочая ветка продукта: `cursor/ao-protocol-v03-82e4`  
- Документация: [`docs/`](./)

## Как обновляется зеркало Pages

```bash
npm run deploy:pages   # из корня; сохраняет presentation/
```

## Как выгрузить SPA в Arweave

```bash
npm run deploy:permaweb   # нужен wallet.json на машине владельца; см. scripts/deploy-permaweb.sh
```

## Открыть уже сохранённый сейф

Только 12 слов + приложение. Банк и кассир **не нужны**. См. flow 07 и LOCKED_DECISIONS §4.
