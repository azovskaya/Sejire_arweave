# AO processes — SEJIRE

| Process | File | Spec |
|---------|------|------|
| Tree | [`processes/tree.lua`](./processes/tree.lua) | [`docs/processes/TREE.md`](../docs/processes/TREE.md) |
| Factory | [`processes/factory.lua`](./processes/factory.lua) | [`docs/processes/FACTORY.md`](../docs/processes/FACTORY.md) |

Message catalog: [`docs/processes/MESSAGE_CATALOG.md`](../docs/processes/MESSAGE_CATALOG.md)

## Deploy (Phase 2)

```bash
npm i -g https://get_ao.arweave.net
aos --node https://push.forward.computer
```

### Tree

```lua
.load processes/tree.lua
Send({ Target = ao.id, Tags = { Action = "Init", Title = "Sultanov Family" } })
Send({
  Target = ao.id,
  Tags = { Action = "Commit" },
  Data = '{"message":"genesis","snapshot":{"persons":{}}}'
})
Send({ Target = ao.id, Tags = { Action = "History" } })
```

### Factory

```lua
.load processes/factory.lua
Send({ Target = ao.id, Tags = { Action = "SpawnTree", Title = "Sultanov Family" } })
Send({ Target = ao.id, Tags = { Action = "ListTrees" } })
```

После `SpawnTree` клиент загружает `tree.lua` в новый process (или использует prebuilt module) и вызывает `Init` → `Commit`.

HTTP patch (HyperBEAM):

```
https://push.forward.computer/<process-id>~process@1.0/compute/sejire
https://push.forward.computer/<factory-id>~process@1.0/compute/sejire_factory
```
