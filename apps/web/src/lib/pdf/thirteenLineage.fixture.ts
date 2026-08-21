import type { Person, Snapshot, TreeMeta } from "../types";

/**
 * QA fixture: 13 paternal knees (өзі → 13-ші ата) plus wives on the first four.
 * Names are fictional — for PDF / import tests only.
 */
const MALE_LINE: { id: string; name: string; born: string; died: string | null; place: string }[] = [
  { id: "g00", name: "Ерлан Бекжанулы Беков", born: "1998", died: null, place: "Астана" },
  { id: "g01", name: "Бекжан Ерланулы Беков", born: "1972", died: null, place: "Астана" },
  { id: "g02", name: "Ерлан Бекжанулы Беков", born: "1948", died: "2020", place: "Целиноград" },
  { id: "g03", name: "Бекжан Смагулулы Беков", born: "1924", died: "1999", place: "Акмолинск" },
  { id: "g04", name: "Смагул Алтынбекулы", born: "1901", died: "1978", place: "Акмолинский уезд" },
  { id: "g05", name: "Алтынбек Нурланулы", born: "1876", died: "1952", place: "Сарыарқа" },
  { id: "g06", name: "Нурлан Касымулы", born: "1852", died: "1931", place: "Сарыарқа" },
  { id: "g07", name: "Касым Толегенулы", born: "1828", died: "1905", place: "Сарыарқа" },
  { id: "g08", name: "Толеген Баймуратулы", born: "1804", died: "1882", place: "Сарыарқа" },
  { id: "g09", name: "Баймурат Кожакулулы", born: "1779", died: "1856", place: "Сарыарқа" },
  { id: "g10", name: "Кожакул Сарыбаюлы", born: "1755", died: "1833", place: "Сарыарқа" },
  { id: "g11", name: "Сарыбай Есенкулулы", born: "1731", died: "1808", place: "Сарыарқа" },
  { id: "g12", name: "Есенкул", born: "1705", died: "1780", place: "Сарыарқа" },
];

const WIVES: { childId: string; id: string; name: string; born: string; died: string | null }[] = [
  { childId: "g00", id: "w00", name: "Айгуль Сериковна Бекова", born: "1974", died: null },
  { childId: "g01", id: "w01", name: "Гульнара Касымовна Бекова", born: "1950", died: null },
  { childId: "g02", id: "w02", name: "Баян Смагуловна", born: "1926", died: "2004" },
  { childId: "g03", id: "w03", name: "Зейнеп Алтынбековна", born: "1904", died: "1981" },
];

function person(partial: Omit<Person, "media" | "parents" | "notes" | "tombstone"> & Partial<Person>): Person {
  return {
    media: [],
    notes: "",
    tombstone: false,
    parents: [],
    ...partial,
  };
}

export const QA_13_FOCUS_ID = "g00";

export function qaThirteenGenerationSnapshot(): Snapshot {
  const persons: Record<string, Person> = {};
  for (let i = 0; i < MALE_LINE.length; i += 1) {
    const row = MALE_LINE[i];
    const fatherId = MALE_LINE[i + 1]?.id;
    const wife = WIVES.find((w) => w.childId === row.id);
    persons[row.id] = person({
      id: row.id,
      name: row.name,
      sex: "M",
      born: row.born,
      died: row.died,
      birthPlace: row.place,
      parents: [fatherId, wife?.id].filter((id): id is string => Boolean(id)),
    });
  }
  for (const wife of WIVES) {
    persons[wife.id] = person({
      id: wife.id,
      name: wife.name,
      sex: "F",
      born: wife.born,
      died: wife.died,
      birthPlace: "Сарыарқа",
      parents: [],
    });
  }
  return { persons };
}

export function qaThirteenGenerationMeta(): TreeMeta {
  return {
    id: "tree_qa_13",
    title: "Беков — 13 колен",
    head: null,
    next_version: 1,
    created_at: "2026-08-21T00:00:00.000Z",
    author: "local:qa",
    zhuz: "orta",
    clanName: "Арғын · Беков",
    tamgaUrl: null,
  };
}
