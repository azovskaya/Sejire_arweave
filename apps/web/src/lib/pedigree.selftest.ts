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

const meCard = ped.items.find((i) => i.kind === "person" && i.id === "me");
assert(meCard && meCard.kind === "person" && meCard.y < 500, "focus card stays in view");

const solo: Snapshot = {
  persons: { me: { id: "me", name: "Me", parents: [], media: [] } },
};
const soloPed = buildPedigree(solo, "me", 7);
const soloMe = soloPed.items.find((i) => i.kind === "person" && i.id === "me");
assert(soloMe && soloMe.kind === "person" && soloMe.y < 250, "solo focus not buried in empty 7-gen canvas");
assert(soloPed.height < 600, "solo tree compact height");
assert(soloPed.items.filter((i) => i.kind === "add").length === 2, "only next-gen + papa/mama");
console.log("pedigree.selftest: OK", { items: ped.items.length, edges: ped.edges.length, soloH: soloPed.height });
