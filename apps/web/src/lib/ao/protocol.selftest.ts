/**
 * Protocol self-test: local Tree + Factory process (mirrors ao/processes/*.lua).
 * Spec: docs/PROTOCOL.md v0.3, docs/processes/TREE.md
 */
import { SejireAoClient, isErrorReply, parseReplyJson } from "./client";
import { LocalTreeProcess } from "./treeProcess";
import { relationship } from "../kinship";
import type { Snapshot } from "../types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const alice = "addr_alice";
const bob = "addr_bob";

function snapshot(): Snapshot {
  return {
    persons: {
      g: { id: "g", name: "Ata", sex: "M", parents: [], media: [] },
      f: { id: "f", name: "Father", sex: "M", parents: ["g"], media: [] },
      m: { id: "m", name: "Mother", sex: "F", parents: [], media: [] },
      u: { id: "u", name: "Uncle", sex: "M", parents: ["g"], media: [] },
      c: { id: "c", name: "Child", sex: "M", parents: ["f", "m"], media: [] },
      x: { id: "x", name: "Stranger", sex: "M", parents: [], media: [] },
    },
  };
}

function main() {
  const tree = new LocalTreeProcess("tree_test");
  let r = tree.handle({ From: alice, Tags: { Action: "Ping" } });
  assert(r.Tags.Action === "Pong" && r.Data === "sejire-ok", "ping");

  r = tree.handle({ From: alice, Tags: { Action: "GetAncestors", "Person-Id": "c" } });
  assert(isErrorReply(r) && r.Tags["Error-Code"] === "EmptyTree", "query before commit");

  r = tree.handle({ From: alice, Tags: { Action: "Init", Title: "Sultanov" } });
  assert(r.Tags.Action === "Init-Response", "init");
  const info = parseReplyJson<{ release: string; queries: string[] }>(
    tree.handle({ From: alice, Tags: { Action: "Info" } })
  );
  assert(info.release === "sejire/v0.3", "release tag");
  assert(info.queries.includes("Relate"), "kinship queries advertised");

  r = tree.handle({ From: bob, Tags: { Action: "Init", Title: "Nope" } });
  assert(isErrorReply(r) && r.Tags["Error-Code"] === "AlreadyInitialized", "second init");

  r = tree.handle({
    From: alice,
    Id: "msg1",
    Tags: { Action: "Commit" },
    Data: JSON.stringify({ message: "genesis", snapshot: snapshot() }),
  });
  assert(r.Tags.Action === "Commit-Response", "genesis commit");
  assert(r.Tags.Version === "1", "version 1");
  const genesis = parseReplyJson<{ commit_id: string; parent_commit_id: string | null }>(r);
  assert(genesis.parent_commit_id === null, "genesis parent null");

  r = tree.handle({
    From: bob,
    Tags: { Action: "Commit" },
    Data: JSON.stringify({ snapshot: snapshot() }),
  });
  assert(isErrorReply(r) && r.Tags["Error-Code"] === "Unauthorized", "non-owner commit");

  r = tree.handle({
    From: alice,
    Tags: { Action: "Commit" },
    Data: JSON.stringify({ parent_commit_id: "c_stale", snapshot: snapshot() }),
  });
  assert(isErrorReply(r) && r.Tags["Error-Code"] === "StaleParent", "stale parent");

  r = tree.handle({
    From: alice,
    Tags: { Action: "Commit" },
    Data: JSON.stringify({ parent_commit_id: genesis.commit_id, message: "same head", snapshot: snapshot() }),
  });
  assert(r.Tags.Action === "Commit-Response" && r.Tags.Version === "2", "explicit matching parent ok");

  const head = parseReplyJson<{ head: string }>(tree.handle({ From: alice, Tags: { Action: "GetHead" } }));
  assert(head.head, "head set");

  r = tree.handle({ From: alice, Tags: { Action: "GetAncestors", "Person-Id": "c" } });
  const anc = parseReplyJson<{ ancestors: { id: string; distance: number }[] }>(r);
  assert(anc.ancestors[0].id === "c" && anc.ancestors[0].distance === 0, "self distance 0");
  assert(anc.ancestors.some((x) => x.id === "f" && x.distance === 1), "father dist 1");
  assert(anc.ancestors.some((x) => x.id === "g" && x.distance === 2), "ata dist 2");

  r = tree.handle({ From: alice, Tags: { Action: "GetAncestors", "Person-Id": "c", "Max-Depth": "1" } });
  const anc1 = parseReplyJson<{ ancestors: { id: string; distance: number }[] }>(r);
  assert(anc1.ancestors.every((x) => x.distance <= 1), "max depth");
  assert(!anc1.ancestors.some((x) => x.id === "g"), "ata excluded at depth 1");

  r = tree.handle({ From: alice, Tags: { Action: "GetJetiAta", "Person-Id": "c" } });
  const jeti = parseReplyJson<{ line: { id: string; generation: number }[]; complete: boolean; max: number }>(r);
  assert(jeti.max === 7, "jeti ata max 7");
  assert(jeti.line.map((x) => x.id).join(",") === "c,f,g", "paternal line child-father-ata");
  assert(jeti.complete === false, "incomplete 3 of 7");

  r = tree.handle({ From: alice, Tags: { Action: "Relate", "Person-A": "c", "Person-B": "f" } });
  const childOf = parseReplyJson<{ code: string; da: number; db: number }>(r);
  assert(childOf.code === "child" && childOf.da === 1 && childOf.db === 0, "child vs father");

  r = tree.handle({ From: alice, Tags: { Action: "Relate", "Person-A": "c", "Person-B": "u" } });
  const nibling = parseReplyJson<{ code: string }>(r);
  assert(nibling.code === "nibling", "child vs uncle = nibling");

  r = tree.handle({ From: alice, Tags: { Action: "Relate", "Person-A": "c", "Person-B": "x" } });
  assert(parseReplyJson<{ code: string }>(r).code === "unrelated", "stranger");

  r = tree.handle({ From: alice, Tags: { Action: "Relate", "Person-A": "c" } });
  assert(isErrorReply(r) && r.Tags["Error-Code"] === "BadPersonId", "relate missing B");

  r = tree.handle({ From: alice, Tags: { Action: "AddOwner", Address: bob } });
  assert(r.Tags.Action === "AddOwner-Response", "add owner");
  r = tree.handle({ From: alice, Tags: { Action: "RemoveOwner", Address: alice } });
  assert(r.Tags.Action === "RemoveOwner-Response", "remove one of two");
  r = tree.handle({ From: bob, Tags: { Action: "RemoveOwner", Address: bob } });
  assert(isErrorReply(r) && r.Tags["Error-Code"] === "LastOwner", "last owner");

  const snap = snapshot();
  assert(relationship(snap, "c", "f").code === "child", "ts kinship matches process");
  assert(relationship(snap, "f", "u").code === "sibling", "brothers");

  const ao = new SejireAoClient({ mode: "local" });
  r = ao.spawnTree(alice, "Sultanov");
  const spawned = parseReplyJson<{ process_id: string }>(r);
  assert(spawned.process_id, "spawn id");
  const t2 = ao.tree(spawned.process_id)!;
  t2.handle({ From: alice, Tags: { Action: "Init", Title: "Sultanov" } });
  return ao
    .commit(spawned.process_id, alice, { message: "genesis", snapshot: snapshot() })
    .then((commit) => {
      assert(commit.Tags.Action === "Commit-Response", "client commit");
      return ao.relate(spawned.process_id, alice, "f", "u");
    })
    .then((rel) => {
      assert(parseReplyJson<{ code: string }>(rel).code === "sibling", "client relate");
      const listed = parseReplyJson<{ trees: { process_id: string }[] }>(
        ao.factory.handle({ From: alice, Tags: { Action: "ListTrees" } })
      );
      assert(listed.trees.length === 1, "list trees");
      console.log("protocol.selftest: OK");
    });
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
