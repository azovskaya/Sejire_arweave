/**
 * Lineage helpers self-test
 */
import { ancestorGenerations, ancestorSlotLayout, maleLineUp, slotCenterFraction } from "./lineage";
import type { Snapshot } from "../types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const snapshot: Snapshot = {
  persons: {
    me: { id: "me", name: "Me", sex: "M", parents: ["fa", "mo"], media: [] },
    fa: { id: "fa", name: "Father", sex: "M", parents: ["gf", "gm"], media: [] },
    mo: { id: "mo", name: "Mother", sex: "F", parents: ["mgf", "mgm"], media: [] },
    gf: { id: "gf", name: "GF", sex: "M", parents: [], media: [] },
    gm: { id: "gm", name: "GM", sex: "F", parents: [], media: [] },
    mgf: { id: "mgf", name: "MGF", sex: "M", parents: [], media: [] },
    mgm: { id: "mgm", name: "MGM", sex: "F", parents: [], media: [] },
  },
};

const male = maleLineUp(snapshot, "me");
assert(male.map((p) => p.id).join(",") === "me,fa,gf", `male line ${male.map((p) => p.id)}`);

const gens = ancestorGenerations(snapshot, "me", 4);
assert(gens[0][0].id === "me", "focus bottom gen");
assert(gens[1][0].id === "fa" && gens[1][1].id === "mo", "father left of mother");
assert(gens[2].map((p) => p.id).join(",") === "gf,gm,mgf,mgm", "grandparents slot order");

const slots = ancestorSlotLayout(snapshot, "me", 4);
const byId = Object.fromEntries(slots.map((s) => [s.person.id, s]));
assert(byId.fa.slot === 0 && byId.mo.slot === 1, "parent slots");
assert(byId.gf.slot === 0 && byId.gm.slot === 1, "paternal gp slots");
assert(byId.mgf.slot === 2 && byId.mgm.slot === 3, "maternal gp slots");

// Father center left of mother for same depth
const depth = 3;
assert(
  slotCenterFraction(1, 0, depth) < slotCenterFraction(1, 1, depth),
  "father fraction left of mother"
);
assert(
  slotCenterFraction(0, 0, depth) > slotCenterFraction(1, 0, depth) &&
    slotCenterFraction(0, 0, depth) < slotCenterFraction(1, 1, depth),
  "child centered between parents"
);

const deep: Snapshot = { persons: {} };
let prevId: string | null = null;
for (let i = 12; i >= 0; i -= 1) {
  const id = `g${String(i).padStart(2, "0")}`;
  deep.persons[id] = {
    id,
    name: `Gen ${i}`,
    sex: "M",
    parents: prevId ? [prevId] : [],
    media: [],
  };
  prevId = id;
}
const deepMale = maleLineUp(deep, "g00");
assert(deepMale.length === 13, `13-knee male line ${deepMale.length}`);
assert(ancestorSlotLayout(deep, "g00", 5).length === 5, "classic PDF used to silently drop gens 6–13");
assert(ancestorSlotLayout(deep, "g00", 13).length === 13, "13-knee layout keeps the full line");

console.log("lineage.selftest: OK", { male: male.length, gens: gens.length, slots: slots.length, deep: deepMale.length });
