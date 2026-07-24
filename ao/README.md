# SEJIRE AO Tree Process

Lua process for versioned family trees on AO / HyperBEAM.

## Deploy (Phase 2)

```bash
npm i -g https://get_ao.arweave.net
aos --node https://push.forward.computer
```

In the AOS REPL:

```lua
.load ao/processes/tree.lua
Send({ Target = ao.id, Tags = { Action = "Init", Title = "Sultanov Family" } })
```

Commit payload (`Data` JSON):

```json
{
  "message": "Add ancestor",
  "parent_commit_id": null,
  "snapshot": {
    "persons": {
      "p1": {
        "id": "p1",
        "name": "Ayan",
        "born": "1894-03-12",
        "parents": [],
        "media": [],
        "tombstone": false
      }
    }
  }
}
```

```lua
Send({
  Target = ao.id,
  Tags = { Action = "Commit" },
  Data = "<json above>"
})
```

Read:

```lua
Send({ Target = ao.id, Tags = { Action = "History" } })
Send({ Target = ao.id, Tags = { Action = "GetHead" } })
```

HTTP (HyperBEAM patch after commits):

```
https://push.forward.computer/<process-id>~process@1.0/compute/sejire
```
