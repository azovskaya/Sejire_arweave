/**
 * Pedigree layout self-test
 */
import { buildPedigree, splitParents } from "./pedigree";
import type { Snapshot } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const snapshot: Snapshot = {
  persons: {
    me: { id: "me", name: "Me", sex: "U", parents: ["fa", "mo"], media: [] },
    fa: { id: "fa", name: "Father", sex: "M", parents: [], media: [] },
    mo: { id: "mo", name: "Mother", sex: "F", parents: [], media: [] },
  },
};

const { fatherId, motherId } = splitParents(snapshot, "me");
assert(fatherId === "fa", "father");
assert(motherId === "mo", "mother");

const ped = buildPedigree(snapshot, "me", 3);
assert(ped.items.some((i) => i.kind === "person" && i.id === "me"), "focus present");
assert(ped.items.some((i) => i.kind === "add" && i.role === "father"), "add grandfather slot");
console.log("pedigree.selftest: OK", { items: ped.items.length, edges: ped.edges.length });
