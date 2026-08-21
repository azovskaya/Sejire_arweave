/**
 * Pedigree layout self-test
 */
import {
  buildPedigree,
  generationFromFocus,
  parentAddNeedsFocusShift,
  splitParents,
  SCREEN_PEDIGREE_GENERATIONS,
} from "./pedigree";
import type { Person, Snapshot } from "./types";

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

function completeAncestry(gens: number): Snapshot {
  const count = 2 ** gens - 1;
  const persons: Record<string, Person> = {};
  for (let n = 1; n <= count; n += 1) {
    const father = 2 * n <= count ? `a${2 * n}` : null;
    const mother = 2 * n + 1 <= count ? `a${2 * n + 1}` : null;
    persons[`a${n}`] = {
      id: `a${n}`,
      name: `P${n}`,
      sex: n === 1 || n % 2 === 0 ? "M" : "F",
      parents: [father, mother].filter((id): id is string => Boolean(id)),
      media: [],
    };
  }
  return { persons };
}

const six = completeAncestry(6);
assert(generationFromFocus(six, "a1", "a1") === 0, "focus gen 0");
assert(generationFromFocus(six, "a1", "a2") === 1, "father gen 1");
assert(generationFromFocus(six, "a1", "a32") === 5, "oldest 6-knee person is gen 5");
assert(parentAddNeedsFocusShift(5), "adding a 7th knee must shift the window");
assert(!parentAddNeedsFocusShift(0), "adding parents of self does not shift");

const sixPed = buildPedigree(six, "a1", SCREEN_PEDIGREE_GENERATIONS);
const sixAdds = sixPed.items.filter((i) => i.kind === "add");
assert(sixAdds.length <= 8, `do not paint 64 plus-cards after a full 6th knee (${sixAdds.length})`);
assert(
  sixPed.items.some((i) => i.kind === "person" && i.id === "a32"),
  "oldest 6-knee people stay on the canvas"
);

const withSeventh: Snapshot = {
  persons: {
    ...six.persons,
    a64: { id: "a64", name: "NewFather", sex: "M", parents: [], media: [] },
  },
};
withSeventh.persons.a32 = { ...withSeventh.persons.a32, parents: ["a64"] };
const shifted = buildPedigree(withSeventh, "a32", SCREEN_PEDIGREE_GENERATIONS);
assert(
  shifted.items.some((i) => i.kind === "person" && i.id === "a64"),
  "after looking from the 6th-knee person, the 7th knee is visible"
);

console.log("pedigree.selftest: OK", {
  items: ped.items.length,
  edges: ped.edges.length,
  soloH: soloPed.height,
  sixAdds: sixAdds.length,
});
