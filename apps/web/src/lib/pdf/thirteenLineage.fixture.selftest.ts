import { splitParents } from "../pedigree";
import { ancestorSlotLayout, maleLineUp, pedigreeChartRoots, planClassicTreeBooklet } from "./lineage";
import {
  QA_13_FOCUS_ID,
  QA_13_GENERATIONS,
  QA_13_PERSON_COUNT,
  qaThirteenGenerationSnapshot,
} from "./thirteenLineage.fixture";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const snapshot = qaThirteenGenerationSnapshot();
const ids = Object.keys(snapshot.persons);
assert(ids.length === QA_13_PERSON_COUNT, `count ${ids.length} != ${QA_13_PERSON_COUNT}`);

const self = snapshot.persons[QA_13_FOCUS_ID];
assert(self?.name.includes("Ерлан"), "self name");
const { fatherId, motherId } = splitParents(snapshot, QA_13_FOCUS_ID);
assert(fatherId === "a2" && motherId === "a3", "self parents");
assert(snapshot.persons.a2.sex === "M" && snapshot.persons.a3.sex === "F", "parent sexes");

let missingPair = 0;
for (const id of ids) {
  const { fatherId: f, motherId: m } = splitParents(snapshot, id);
  const n = Number(id.slice(1));
  const gen = Math.floor(Math.log2(n));
  if (gen < QA_13_GENERATIONS - 1 && (!f || !m)) missingPair += 1;
}
assert(missingPair === 0, `every non-root has father and mother (${missingPair} missing)`);

const oldest = ids.filter((id) => {
  const n = Number(id.slice(1));
  return Math.floor(Math.log2(n)) === QA_13_GENERATIONS - 1;
});
assert(oldest.length === 2 ** (QA_13_GENERATIONS - 1), "oldest knee size");
for (const id of oldest) {
  const { fatherId: f, motherId: m } = splitParents(snapshot, id);
  assert(!f && !m, `${id} should be a root`);
}

const male = maleLineUp(snapshot, QA_13_FOCUS_ID);
assert(male.length === QA_13_GENERATIONS, `male line ${male.length}`);
assert(male.every((p) => p.sex === "M"), "male line sexes");

const slots = ancestorSlotLayout(snapshot, QA_13_FOCUS_ID, QA_13_GENERATIONS);
assert(slots.length === QA_13_PERSON_COUNT, `layout ${slots.length}`);

const charts = pedigreeChartRoots(snapshot, QA_13_FOCUS_ID, QA_13_GENERATIONS, 5);
assert(charts.length === 1 + 16 + 256, `booklet pages ${charts.length}`);
const booklet = planClassicTreeBooklet(snapshot, QA_13_FOCUS_ID, QA_13_GENERATIONS, 5);
assert(booklet.pages.length === charts.length, `13-knee stays one chart per page (${booklet.pages.length})`);
assert(
  booklet.pages.every((p) => p.kind === "full"),
  "13-knee has no leftover 2-gen sheets to pack"
);

console.log("thirteenLineage.fixture.selftest: OK", {
  people: ids.length,
  maleLine: male.length,
  charts: charts.length,
});
