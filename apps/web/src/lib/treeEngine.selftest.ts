/**
 * Minimal protocol self-check for versioned trees.
 * Run: node --experimental-strip-types src/lib/treeEngine.selftest.ts
 * (or via npm run test:engine)
 */
import {
  activePersons,
  commitDraft,
  createTree,
  getCommit,
  listHistory,
  upsertPersonFields,
} from "./treeEngine.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let store = createTree("Test");
store = upsertPersonFields(store, { name: "Ayan", born: "1894-01-01", parents: [] });
store = commitDraft(store, "genesis");
assert(store.meta.head, "head set");
assert(store.meta.next_version === 2, "version bumped");
assert(listHistory(store).length === 1, "one commit");

const v1 = getCommit(store, store.meta.head!);
assert(v1 && activePersons(v1.snapshot).length === 1, "one person in v1");

store = upsertPersonFields(store, { name: "Child", parents: [activePersons(store.draft)[0].id] });
store = commitDraft(store, "add child");
assert(listHistory(store).length === 2, "two commits");

const oldId = store.versions[1];
const old = getCommit(store, oldId);
assert(old && activePersons(old.snapshot).length === 1, "v1 unchanged");
assert(activePersons(store.draft).length === 2, "head has two");

console.log("treeEngine.selftest: OK");
