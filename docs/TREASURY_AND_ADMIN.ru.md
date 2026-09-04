# Казна и админка SEJIRE

Казна — отдельный кошелёк **проекта**. Им оплачивается сеть за чужие зашифрованные сейфы после Kaspi. Это **не** 12 слов пользователя и не личный кошелёк.

Агент ключ не создаёт и в чат не принимает: если сделать казну в облаке, файл пропадёт вместе с машиной.

## Порядок (на своём Mac)

```bash
cd путь/к/Sejire_arweave
npm install --prefix apps/sponsor
npm run treasury:init
```

Появится **`treasury.local.json`** (в git не попадает) и **`treasury.address.txt`**.

### Куда сохранить, чтобы не потерять доступ

| Место | Что лежит |
|--------|-----------|
| 1Password / Bitwarden | весь `treasury.local.json` |
| Зашифрованная флешка или сейф | копия того же файла |
| Бумага | только **адрес** казны (не JSON) |

Три копии. Если файл исчезнет и бумажки нет — из казны больше нельзя подписать загрузки.

**Нельзя:** git, Slack, почта, чат с агентом.

### Кассир (Cloudflare Worker)

```bash
cd apps/sponsor
npx wrangler login
npx wrangler kv namespace create IDEMPOTENCY
# id прописать в wrangler.toml
npx wrangler secret put TURBO_JWK      # объект jwk из файла
npx wrangler secret put ADMIN_TOKEN    # adminToken из файла
```

В `[vars]` wrangler.toml:

```
TREASURY_ADDRESS = "<адрес из treasury.address.txt>"
```

Пока нет ИП/Kaspi: `PAYMENT_PROVIDER=mock`. Mock **нельзя** включать вместе с живым `TURBO_JWK`.

Админка: `https://<worker>.workers.dev/admin` — ключ из `adminToken`.

На экране: сколько древ, сколько сохранений, оплаты, **время** появления каждого древа. Имена, 12 слов, содержимое сейфа — нет.

### GitHub

Settings → Secrets → Actions: `TURBO_JWK`, `ADMIN_TOKEN` (те же значения). Нужны для деплоя кассира/сайта, не для хранения казны как единственной копии.

### Пополнить казну AR

На адрес из `treasury.address.txt` (Binance → вывод AR → сеть Arweave). Сколько держать на горячем кошельке — отдельно; это не 12 слов людей.
