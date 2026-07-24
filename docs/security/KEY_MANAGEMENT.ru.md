# Управление ключами

## Phase 1 (local MVP)

- Авторство локальное (`local:draft-author`)
- Данные в `localStorage` — только для прототипа UX

## Phase 2 (on-chain)

- Arweave wallet: **Wander** / **ArConnect**
- Подпись каждого `Commit` / ACL сообщения
- Seed/JSON keyfile NEVER leaves device / extension

## Рекомендации пользователю

1. Записать seed offline
2. Сразу добавить второго owner (доверенный родственник)
3. Хранить `tree_id` в семейном сейфе / ArNS
4. Не использовать browser пароль-менеджер как единственную копию seed

## Будущее

| Механизм | Зачем |
|----------|-------|
| BIP-39 + AES-GCM encrypt snapshot | Приватность графа |
| Shamir 2-of-3 | Семейное восстановление |
| Hardware wallet | High-value trees |
| Session keys | UX без подписи каждого клика (ограниченные права) |
