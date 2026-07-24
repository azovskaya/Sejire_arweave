import { useEffect, useMemo, useState } from "react";
import type { Person, TreeStore } from "../lib/types";
import { saveDraftTree } from "../lib/draftStorage";
import { type GuideState, saveGuide } from "../lib/guide";
import { pickDefaultFocus, splitParents, type AddMeSlot } from "../lib/pedigree";
import { PedigreeView } from "./PedigreeView";
import { PersonPanel } from "./PersonPanel";
import { AddPersonModal } from "./AddPersonModal";
import { PublishSeedModal } from "./PublishSeedModal";
import {
  activePersons,
  commitDraft,
  removeDraftPerson,
  setDraftPerson,
} from "../lib/treeEngine";
import type { AddPersonPayload } from "./AddPersonModal";

function uid() {
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  store: TreeStore;
  guide: GuideState;
  onStoreChange: (store: TreeStore) => void;
  onGuideChange: (guide: GuideState) => void;
  onHome: () => void;
};

type PendingAdd =
  | { type: "self" }
  | { type: "parent"; childId: string; role: "father" | "mother" }
  | { type: "child"; parentId: string };

export function Workspace({ store, guide, onStoreChange, onGuideChange, onHome }: Props) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveDraftTree(store);
  }, [store]);

  useEffect(() => {
    saveGuide(guide);
  }, [guide]);

  useEffect(() => {
    const id = pickDefaultFocus(store.draft, focusId ?? guide.selfId);
    setFocusId(id);
    if (!selectedId && id) setSelectedId(id);
  }, [store.draft, guide.selfId]); // eslint-disable-line react-hooks/exhaustive-deps

  const people = activePersons(store.draft);
  const selected = selectedId ? store.draft.persons[selectedId] ?? null : null;

  const relatives = useMemo(() => {
    if (!selected) return [];
    const list: { id: string; name: string; relation: string }[] = [];
    const { fatherId, motherId } = splitParents(store.draft, selected.id);
    if (fatherId) list.push({ id: fatherId, name: store.draft.persons[fatherId].name, relation: "Папа" });
    if (motherId) list.push({ id: motherId, name: store.draft.persons[motherId].name, relation: "Мама" });
    for (const p of people) {
      if (p.parents.includes(selected.id)) {
        list.push({ id: p.id, name: p.name, relation: "Ребёнок" });
      }
    }
    return list;
  }, [selected, store.draft, people]);

  function persist(next: TreeStore) {
    onStoreChange(next);
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }

  function onSavePerson(person: Person) {
    persist(setDraftPerson(store, person));
    flash("Сохранено");
  }

  function completeAdd(data: AddPersonPayload) {
    if (!pending) return;
    const id = uid();
    const person: Person = {
      id,
      name: data.name,
      sex: data.sex ?? "U",
      born: data.born || null,
      died: data.died || null,
      birthPlace: data.birthPlace.trim() || null,
      deathPlace: data.deathPlace.trim() || null,
      burialDate: data.burialDate || null,
      burialPlace: data.burialPlace.trim() || null,
      occupation: data.occupation.trim() || null,
      maidenName: data.maidenName.trim() || null,
      parents: [],
      media: [],
      notes: data.notes.trim() || "",
      tombstone: false,
    };

    let next = store;
    let nextGuide = { ...guide };

    if (pending.type === "self") {
      next = setDraftPerson(store, person);
      nextGuide = { ...guide, selfId: id, step: "mother" };
      setFocusId(id);
      setSelectedId(id);
      flash("Теперь добавьте маму или папу карточками на древе");
    } else if (pending.type === "parent") {
      person.sex = pending.role === "father" ? "M" : "F";
      next = setDraftPerson(store, person);
      const child = next.draft.persons[pending.childId];
      if (child) {
        const parents = [...child.parents];
        if (!parents.includes(id)) {
          if (pending.role === "mother") parents.unshift(id);
          else parents.push(id);
        }
        next = setDraftPerson(next, { ...child, parents });
      }
      if (pending.role === "mother") nextGuide.motherId = id;
      if (pending.role === "father") nextGuide.fatherId = id;
      setSelectedId(id);
      flash(pending.role === "mother" ? "Мама добавлена" : "Папа добавлен");
    } else if (pending.type === "child") {
      person.parents = [pending.parentId];
      next = setDraftPerson(store, person);
      setSelectedId(id);
      flash("Ребёнок добавлен");
    }

    persist(next);
    onGuideChange(nextGuide);
    setPending(null);
  }

  function onCommit() {
    const next = commitDraft(store, "Обновление древа");
    persist(next);
    flash(`Версия v${next.meta.next_version - 1} зафиксирована`);
  }

  const modalTitle =
    pending?.type === "self"
      ? "Добавить себя"
      : pending?.type === "parent"
        ? pending.role === "mother"
          ? "Добавить маму"
          : "Добавить папу"
        : pending?.type === "child"
          ? "Добавить ребёнка"
          : "";

  return (
    <div className="app-frame">
      <header className="app-topbar">
        <div className="brand">
          <span className="brand-glyph" aria-hidden />
          <div>
            <strong>SEJIRE</strong>
            <span className="tree-title">{store.meta.title}</span>
          </div>
        </div>
        <nav className="top-actions">
          <span className="chip soft">
            {people.length} чел. · v{Math.max(0, store.meta.next_version - 1)}
            {store.dirty ? " · черновик" : ""}
          </span>
          <button type="button" className="btn ghost" onClick={onCommit} disabled={!store.dirty && !people.length}>
            Сохранить версию
          </button>
          <button type="button" className="btn" onClick={() => setShowPublish(true)}>
            В Arweave
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            Выход
          </button>
        </nav>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <div className="workspace-main">
        <PedigreeView
          snapshot={store.draft}
          focusId={focusId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEmptyStart={() => setPending({ type: "self" })}
          onAddRelative={(slot: AddMeSlot) =>
            setPending({ type: "parent", childId: slot.childId, role: slot.role })
          }
        />

        <PersonPanel
          person={selected}
          relatives={relatives}
          onClose={() => setSelectedId(null)}
          onSave={onSavePerson}
          onFocus={() => selected && setFocusId(selected.id)}
          onRemove={() => {
            if (!selected) return;
            persist(removeDraftPerson(store, selected.id));
            setSelectedId(null);
            flash("Скрыто в этой версии (история сохраняется)");
          }}
          onAdd={(role) => {
            if (!selected) return;
            if (role === "child") setPending({ type: "child", parentId: selected.id });
            else setPending({ type: "parent", childId: selected.id, role });
          }}
        />
      </div>

      {pending && (
        <AddPersonModal
          title={modalTitle}
          defaultSex={
            pending.type === "parent" ? (pending.role === "mother" ? "F" : "M") : pending.type === "self" ? "U" : "U"
          }
          onCancel={() => setPending(null)}
          onSave={completeAdd}
        />
      )}

      {showPublish && (
        <PublishSeedModal
          store={store}
          onClose={() => setShowPublish(false)}
          onPublished={({ mode, txId }) => {
            setShowPublish(false);
            flash(
              mode === "arweave"
                ? `Опубликовано в Arweave (${txId?.slice(0, 8)}…). Храните 12 слов.`
                : "Файл сейфа скачан. Храните вместе с 12 словами."
            );
          }}
        />
      )}
    </div>
  );
}
