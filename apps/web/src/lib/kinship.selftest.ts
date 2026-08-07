/**
 * Kinship self-test
 */
import { relationshipLabel } from "./kinship";
import type { Snapshot } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const snapshot: Snapshot = {
  persons: {
    g: { id: "g", name: "Grand", parents: [], media: [] },
    p1: { id: "p1", name: "Parent1", parents: ["g"], media: [] },
    p2: { id: "p2", name: "Parent2", parents: ["g"], media: [] },
    c: { id: "c", name: "Child", parents: ["p1"], media: [] },
  },
};

assert(relationshipLabel(snapshot, "p1", "c").includes("родител") || relationshipLabel(snapshot, "p1", "c").includes("ребён"), "parent/child");
assert(relationshipLabel(snapshot, "p1", "p2").includes("брат"), "siblings");
console.log("kinship.selftest: OK");
