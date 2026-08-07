import { buildTreeExport, parseTreeJson, TREE_JSON_SCHEMA } from "./treeJson";
import { createTree, setDraftPerson } from "./treeEngine";
import { defaultGuide } from "./guide";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let store = createTree("Тест");
store = setDraftPerson(store, {
  id: "me",
  name: "Иван",
  sex: "M",
  born: "1990-01-02",
  died: null,
  birthPlace: "Астана",
  deathPlace: null,
  burialDate: null,
  burialPlace: null,
  occupation: "инженер",
  maidenName: null,
  parents: ["fa"],
  media: [],
  notes: "заметка",
  tombstone: false,
});
store = setDraftPerson(store, {
  id: "fa",
  name: "Пётр",
  sex: "M",
  born: "1960",
  died: null,
  parents: [],
  media: [],
  notes: "",
  tombstone: false,
});

const guide = {
  ...defaultGuide(),
  step: "done" as const,
  selfId: "me",
  fatherId: "fa",
};

const exported = buildTreeExport(store, guide);
assert(exported.schema === TREE_JSON_SCHEMA, "schema");
assert(exported.store.draft.persons.me.birthPlace === "Астана", "birthPlace");
assert(exported.store.draft.persons.me.occupation === "инженер", "occupation");
assert(exported.guide.selfId === "me", "guide self");

const round = parseTreeJson(JSON.stringify(exported));
assert(round.ok, "parse ok");
if (round.ok) {
  assert(round.store.draft.persons.me.name === "Иван", "name");
  assert(round.store.draft.persons.fa.name === "Пётр", "father");
  assert(round.guide.fatherId === "fa", "guide father");
  assert(round.store.meta.title === "Тест", "title");
}

const bareSnap = parseTreeJson(JSON.stringify({ persons: { a: { id: "a", name: "A", parents: [] } } }));
assert(bareSnap.ok, "bare snapshot");

console.log("treeJson.selftest: OK");
