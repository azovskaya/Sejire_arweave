import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Person, TreeStore } from "../lib/types";
import { saveDraftTree } from "../lib/draftStorage";
import { type GuideState, saveGuide } from "../lib/guide";
import { pickDefaultFocus, pickHomeFocus, splitParents, type AddMeSlot } from "../lib/pedigree";
import { PedigreeView } from "./PedigreeView";
import { PersonPanel } from "./PersonPanel";
import { AddPersonModal, type AddPersonPayload } from "./AddPersonModal";
import { PublishSeedModal } from "./PublishSeedModal";
import {
  activePersons,
  commitDraft,
  removeDraftPerson,
  restoreDraftPerson,
  setDraftPerson,
} from "../lib/treeEngine";
import { downloadClassicTreePdf } from "../lib/pdf/classicTreePdf";
import { downloadShezhirePdf } from "../lib/pdf/shezhirePdf";

function uid() {
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  store: TreeStore;
  guide: GuideState;
  onStoreChange: (store: TreeStore | ((prev: TreeStore) => TreeStore)) => void;
  onGuideChange: (guide: GuideState) => void;
  onHome: () => void;
};

type PendingAdd =
  | { type: "self" }
  | { type: "parent"; childId: string; role: "father" | "mother" }
  | { type: "child"; parentId: string };

type ToastState = {
  message: string;
  undo?: () => void;
};

export function Workspace({ store, guide, onStoreChange, onGuideChange, onHome }: Props) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [publishStore, setPublishStore] = useState<TreeStore | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const people = activePersons(store.draft);
  const selected = selectedId ? store.draft.persons[selectedId] ?? null : null;
  const homeFocusId = pickHomeFocus(store.draft, guide.selfId);

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

  function flash(message: string, undo?: () => void) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 7000 : 3200);
  }

  const onPersonChange = useCallback(
    (person: Person) => {
      onStoreChange((prev) => setDraftPerson(prev, person));
    },
    [onStoreChange]
  );

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
      flash("Добавьте маму или папу карточками «+» на схеме");
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

  function openPublish() {
    if (!people.length) {
      flash("Сначала добавьте хотя бы одного человека");
      return;
    }
    let next = store;
    if (store.dirty) {
      next = commitDraft(store, "Снимок перед Arweave");
      persist(next);
    }
    setPublishStore(next);
    setShowPublish(true);
  }

  function setFocus(id: string) {
    setFocusId(id);
    setSelectedId(id);
    const name = store.draft.persons[id]?.name;
    flash(name ? `Смотрим предков от «${name}»` : "Схема перестроена");
  }

  async function exportClassicPdf() {
    const id = focusId ?? homeFocusId ?? selectedId;
    if (!id || !people.length) {
      flash("Сначала добавьте человека на древо");
      return;
    }
    try {
      await downloadClassicTreePdf({
        snapshot: store.draft,
        focusId: id,
        meta: store.meta,
        locale: "ru",
      });
      flash("PDF древа скачан");
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  }

  async function exportShezhirePdf() {
    const id = selectedId ?? homeFocusId ?? focusId;
    if (!id || !people.length) {
      flash("Сначала добавьте человека на древо");
      return;
    }
    try {
      await downloadShezhirePdf({
        snapshot: store.draft,
        startId: id,
        meta: store.meta,
        locale: "ru",
        maxGenerations: 7,
      });
      flash("Жеті ата PDF скачан");
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
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
          <span className="chip soft" title="Черновик хранится только в этом браузере">
            {people.length} чел. · в браузере
          </span>
          {people.length >= 1 && homeFocusId && focusId && homeFocusId !== focusId ? (
            <button
              type="button"
              className="btn"
              onClick={() => setFocus(homeFocusId)}
              title="Вернуть схему: вы → родители → деды"
            >
              К себе
            </button>
          ) : null}
          {people.length >= 1 && (
            <>
              <button type="button" className="btn ghost" onClick={() => void exportClassicPdf()}>
                Древо в PDF
              </button>
              <button type="button" className="btn ghost" onClick={() => void exportShezhirePdf()}>
                Жеті ата PDF
              </button>
            </>
          )}
          <button type="button" className="btn" onClick={openPublish}>
            В Arweave
          </button>
          <button type="button" className="btn ghost" onClick={onHome}>
            На главную
          </button>
        </nav>
      </header>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.undo ? (
            <button
              type="button"
              className="toast-undo"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Вернуть
            </button>
          ) : null}
        </div>
      )}

      <div className="workspace-main">
        <PedigreeView
          snapshot={store.draft}
          focusId={focusId}
          homeFocusId={homeFocusId}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            // Clicking yourself in the panel restores the pedigree rooted on you
            if (homeFocusId && id === homeFocusId && focusId && focusId !== homeFocusId) {
              setFocusId(homeFocusId);
              flash("Схема снова от вас");
            }
          }}
          onSetFocus={setFocus}
          onEmptyStart={() => setPending({ type: "self" })}
          onAddRelative={(slot: AddMeSlot) =>
            setPending({ type: "parent", childId: slot.childId, role: slot.role })
          }
        />

        <PersonPanel
          person={selected}
          relatives={relatives}
          onClose={() => setSelectedId(null)}
          onChange={onPersonChange}
          onSelectRelative={(id) => {
            setSelectedId(id);
            if (homeFocusId && id === homeFocusId && focusId && focusId !== homeFocusId) {
              setFocusId(homeFocusId);
              flash("Схема снова от вас");
            }
          }}
          onDelete={() => {
            if (!selected) return;
            const removedId = selected.id;
            const removedName = selected.name;
            const wasFocus = focusId === removedId;
            const afterRemove = removeDraftPerson(store, removedId);
            persist(afterRemove);
            setSelectedId(null);
            if (wasFocus) {
              setFocusId(pickDefaultFocus(afterRemove.draft, homeFocusId));
            }
            flash(`«${removedName}» убран(а) с древа`, () => {
              const restored = restoreDraftPerson(afterRemove, removedId);
              persist(restored);
              setSelectedId(removedId);
              if (wasFocus) setFocusId(removedId);
              flash("Человек возвращён на древо");
            });
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

      {showPublish && publishStore && (
        <PublishSeedModal
          store={publishStore}
          onClose={() => {
            setShowPublish(false);
            setPublishStore(null);
          }}
          onPublished={({ mode, txId }) => {
            setShowPublish(false);
            setPublishStore(null);
            flash(
              mode === "arweave"
                ? `Сохранено в Arweave (${txId?.slice(0, 8)}…). Храните 12 слов.`
                : "Файл сейфа скачан. Храните вместе с 12 словами."
            );
          }}
        />
      )}
    </div>
  );
}
