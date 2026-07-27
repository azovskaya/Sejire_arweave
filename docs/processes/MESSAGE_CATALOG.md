# Message Catalog (normative)

Все сообщения SEJIRE используют AO Tags.  
Общие Tags: `Action` (required), опционально `Data` (JSON string).

Ответы: `Action=<Name>-Response` или `Action=Error` + `Error-Code`.

---

## Tree Process

### `Ping`

| | |
|--|--|
| Tags | `Action=Ping` |
| Data | — |
| Response | `Action=Pong`, Data=`sejire-ok` |

### `Info`

| | |
|--|--|
| Tags | `Action=Info` |
| Response Data | `{ protocol, process, title, head, version_count, owners, created_at }` |

### `Init`

| | |
|--|--|
| Tags | `Action=Init`, `Title?` |
| Auth | bootstrap owner = `msg.From` |
| Errors | `AlreadyInitialized` |

### `Commit`

| | |
|--|--|
| Tags | `Action=Commit` |
| Auth | owner (or bootstrap) |
| Data | `{ message?, parent_commit_id?, title?, snapshot: { persons } }` |
| Response Tags | `Commit-Id`, `Version` |
| Errors | `Unauthorized`, `BadPayload`, `BadSnapshot`, `StaleParent` |

### `GetHead`

| | |
|--|--|
| Tags | `Action=GetHead` |
| Response Data | `{ head, commit }` |

### `GetCommit`

| | |
|--|--|
| Tags | `Action=GetCommit`, `Commit-Id` |
| Errors | `NotFound` |

### `History`

| | |
|--|--|
| Tags | `Action=History` |
| Response Data | `{ head, commits: HistoryItem[] }` |

### `AddOwner`

| | |
|--|--|
| Tags | `Action=AddOwner`, `Address` |
| Auth | owner |
| Errors | `Unauthorized`, `BadAddress` |

### `RemoveOwner`

| | |
|--|--|
| Tags | `Action=RemoveOwner`, `Address` |
| Auth | owner |
| Errors | `Unauthorized`, `BadAddress`, `LastOwner` |

---

## Factory Process

### `Ping`

Response Data: `sejire-factory-ok`

### `Info`

`{ protocol, process, tree_count }`

### `SpawnTree`

| | |
|--|--|
| Tags | `Action=SpawnTree`, `Title?` |
| Response Data | `{ process_id, title, owner, created_at }` |

### `RegisterTree`

| | |
|--|--|
| Tags | `Action=RegisterTree`, `Process-Id`, `Title?` |
| Errors | `BadProcessId` |

### `ListTrees`

| | |
|--|--|
| Tags | `Action=ListTrees`, `Owner?` |
| Response Data | `{ owner, trees: TreeMeta[] }` |

---

## App Tags (рекомендуемые на всех исходящих)

Клиент SHOULD добавлять:

| Tag | Value |
|-----|-------|
| `App-Name` | `SEJIRE` |
| `Protocol` | `sejire/v0.2` |
| `Content-Type` | `application/json` (если Data JSON) |

Это упрощает GraphQL/индексацию на gateway.
