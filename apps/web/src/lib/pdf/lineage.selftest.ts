/**
 * Lineage helpers self-test
 */
import { ancestorGenerations, maleLineUp } from "./lineage";
import type { Snapshot } from "../types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const snapshot: Snapshot = {
  persons: {
    me: { id: "me", name: "Me", sex: "M", parents: ["fa", "mo"], media: [] },
    fa: { id: "fa", name: "Father", sex: "M", parents: ["gf"], media: [] },
    mo: { id: "mo", name: "Mother", sex: "F", parents: [], media: [] },
    gf: { id: "gf", name: "Grandfather", sex: "M", parents: [], media: [] },
  },
};

const male = maleLineUp(snapshot, "me");
assert(male.map((p) => p.id).join(",") === "me,fa,gf", `male line ${male.map((p) => p.id)}`);

const gens = ancestorGenerations(snapshot, "me", 4);
assert(gens[0][0].id === "me", "focus bottom gen");
assert(gens[1].some((p) => p.id === "fa") && gens[1].some((p) => p.id === "mo"), "parents");
assert(gens[2].some((p) => p.id === "gf"), "grandfather");

console.log("lineage.selftest: OK", { male: male.length, gens: gens.length });
