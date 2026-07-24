-- SEJIRE Tree Process (AO / aos)
-- Invariant: every mutation is a new immutable commit. History is never erased.
-- Deploy: load into aos connected to HyperBEAM, then use as family tree process.

local json = require("json")

Tree = Tree or {
  id = ao.id,
  title = "Untitled Family Tree",
  owners = {},
  head = nil,
  commits = {},
  versions = {},
  next_version = 1,
  created_at = nil
}

local function reply(msg, tags, data)
  msg.reply({
    Data = data or "",
    Tags = tags or {}
  })
end

local function is_owner(addr)
  if not next(Tree.owners) then
    return true -- bootstrap: first signer becomes owner on Init/Commit
  end
  return Tree.owners[addr] == true
end

local function ensure_owner_boot(addr)
  if not next(Tree.owners) then
    Tree.owners[addr] = true
  end
end

local function patch_http()
  -- Expose compact public state via HyperBEAM patch device
  Send({
    device = "patch@1.0",
    sejire = {
      title = Tree.title,
      head = Tree.head,
      version_count = Tree.next_version - 1,
      owners = Tree.owners
    }
  })
end

local function person_count(snapshot)
  local n = 0
  if snapshot and snapshot.persons then
    for _ in pairs(snapshot.persons) do
      n = n + 1
    end
  end
  return n
end

Handlers.add(
  "Info",
  Handlers.utils.hasMatchingTag("Action", "Info"),
  function(msg)
    reply(msg, { Action = "Info-Response" }, json.encode({
      protocol = "sejire/tree/v1",
      process = Tree.id,
      title = Tree.title,
      head = Tree.head,
      version_count = Tree.next_version - 1,
      owners = Tree.owners,
      created_at = Tree.created_at
    }))
  end
)

Handlers.add(
  "Init",
  Handlers.utils.hasMatchingTag("Action", "Init"),
  function(msg)
    if Tree.created_at then
      reply(msg, { Action = "Error", ["Error-Code"] = "AlreadyInitialized" }, "Tree already initialized")
      return
    end
    local title = msg.Tags.Title or "Untitled Family Tree"
    Tree.title = title
    Tree.created_at = msg.Timestamp or tostring(os.time())
    ensure_owner_boot(msg.From)
    Tree.owners[msg.From] = true
    patch_http()
    reply(msg, { Action = "Init-Response" }, json.encode({
      process = Tree.id,
      title = Tree.title,
      owners = Tree.owners
    }))
  end
)

Handlers.add(
  "GetHead",
  Handlers.utils.hasMatchingTag("Action", "GetHead"),
  function(msg)
    if not Tree.head then
      reply(msg, { Action = "GetHead-Response" }, json.encode({ head = nil, commit = nil }))
      return
    end
    local c = Tree.commits[Tree.head]
    reply(msg, { Action = "GetHead-Response" }, json.encode({ head = Tree.head, commit = c }))
  end
)

Handlers.add(
  "GetCommit",
  Handlers.utils.hasMatchingTag("Action", "GetCommit"),
  function(msg)
    local id = msg.Tags["Commit-Id"]
    if not id or not Tree.commits[id] then
      reply(msg, { Action = "Error", ["Error-Code"] = "NotFound" }, "Commit not found")
      return
    end
    reply(msg, { Action = "GetCommit-Response" }, json.encode(Tree.commits[id]))
  end
)

Handlers.add(
  "History",
  Handlers.utils.hasMatchingTag("Action", "History"),
  function(msg)
    local list = {}
    for v = 1, Tree.next_version - 1 do
      local cid = Tree.versions[v]
      local c = Tree.commits[cid]
      if c then
        table.insert(list, {
          commit_id = c.commit_id,
          version = c.version,
          parent_commit_id = c.parent_commit_id,
          author = c.author,
          created_at = c.created_at,
          message = c.message,
          person_count = person_count(c.snapshot)
        })
      end
    end
    reply(msg, { Action = "History-Response" }, json.encode({
      head = Tree.head,
      commits = list
    }))
  end
)

Handlers.add(
  "Commit",
  Handlers.utils.hasMatchingTag("Action", "Commit"),
  function(msg)
    ensure_owner_boot(msg.From)
    if not is_owner(msg.From) then
      reply(msg, { Action = "Error", ["Error-Code"] = "Unauthorized" }, "Only owners can commit")
      return
    end

    local ok, body = pcall(json.decode, msg.Data or "{}")
    if not ok or type(body) ~= "table" then
      reply(msg, { Action = "Error", ["Error-Code"] = "BadPayload" }, "Data must be JSON object")
      return
    end

    local snapshot = body.snapshot
    if type(snapshot) ~= "table" or type(snapshot.persons) ~= "table" then
      reply(msg, { Action = "Error", ["Error-Code"] = "BadSnapshot" }, "snapshot.persons required")
      return
    end

    -- Parent must match current HEAD (linear history, no silent forks in v1)
    local parent = Tree.head
    if body.parent_commit_id and body.parent_commit_id ~= parent then
      reply(msg, { Action = "Error", ["Error-Code"] = "StaleParent" }, "parent_commit_id must equal current HEAD")
      return
    end

    local version = Tree.next_version
    local commit_id = "c_" .. tostring(version) .. "_" .. tostring(msg.Id or msg.Timestamp or os.time())

    local commit = {
      schema = "sejire/commit/v1",
      tree_id = Tree.id,
      commit_id = commit_id,
      parent_commit_id = parent,
      version = version,
      author = msg.From,
      created_at = msg.Timestamp or tostring(os.time()),
      message = body.message or ("Commit v" .. tostring(version)),
      snapshot = snapshot
    }

    Tree.commits[commit_id] = commit
    Tree.versions[version] = commit_id
    Tree.head = commit_id
    Tree.next_version = version + 1

    if body.title and type(body.title) == "string" and #body.title > 0 then
      Tree.title = body.title
    end

    patch_http()
    reply(msg, {
      Action = "Commit-Response",
      ["Commit-Id"] = commit_id,
      Version = tostring(version)
    }, json.encode(commit))
  end
)

Handlers.add(
  "AddOwner",
  Handlers.utils.hasMatchingTag("Action", "AddOwner"),
  function(msg)
    if not is_owner(msg.From) then
      reply(msg, { Action = "Error", ["Error-Code"] = "Unauthorized" }, "Only owners can add owners")
      return
    end
    local addr = msg.Tags.Address
    if not addr or #addr == 0 then
      reply(msg, { Action = "Error", ["Error-Code"] = "BadAddress" }, "Address tag required")
      return
    end
    Tree.owners[addr] = true
    patch_http()
    reply(msg, { Action = "AddOwner-Response" }, json.encode({ owners = Tree.owners }))
  end
)

Handlers.add(
  "Ping",
  Handlers.utils.hasMatchingTag("Action", "Ping"),
  function(msg)
    reply(msg, { Action = "Pong" }, "sejire-ok")
  end
)

print("SEJIRE tree process loaded: " .. tostring(ao.id))
