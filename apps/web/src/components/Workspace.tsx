import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Person, TreeStore } from "../lib/types";
import { saveDraftTree } from "../lib/draftStorage";
import { type GuideState, saveGuide } from "../lib/guide";
import { pickDefaultFocus, pickHomeFocus, splitParents, type AddMeSlot } from "../lib/pedigree";
import { PedigreeView } from "./PedigreeView";
import { PersonPanel, type PersonPanelHandle } from "./PersonPanel";
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
import { downloadShezhirePdf, type ShezhireTemplateId } from "../lib/pdf/shezhirePdf";
import { SHEZHIRE_MAX_GENERATIONS } from "../lib/i18n/pdf";
import { downloadTreeJson, readTreeJsonFile } from "../lib/treeJson";
import { formatShezhireAffiliation } from "../lib/zhuzRu";
import { ShezhireMetaModal } from "./ShezhireMetaModal";
import { ShezhireTemplateModal } from "./ShezhireTemplateModal";

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
  actionLabel?: string;
};

export function Workspace({ store, guide, onStoreChange, onGuideChange, onHome }: Props) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [publishStore, setPublishStore] = useState<TreeStore | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const moreRef = useRef<HTMLDetailsElement | null>(null);
  const panelRef = useRef<PersonPanelHandle | null>(null);
  const [ancestorsHint, setAncestorsHint] = useState(false);
  const [showShezhireMeta, setShowShezhireMeta] = useState(false);
  const [showShezhireTemplate, setShowShezhireTemplate] = useState(false);

  const shezhireLine = useMemo(
    () => formatShezhireAffiliation(store.meta.zhuz, store.meta.clanName),
    [store.meta.zhuz, store.meta.clanName]
  );

  function closeMoreMenu() {
    if (moreRef.current) moreRef.current.open = false;
  }

  function confirmReplaceDraft(action: string) {
    const count = Object.keys(store.draft.persons).length;
    if (count === 0) return true;
    return window.confirm(
      `Текущий черновик (${count} чел.) будет заменён: ${action}. Сначала можно выгрузить JSON в меню «Ещё». Продолжить?`
    );
  }

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

  useEffect(() => {
    if (!selectedId || !profileOpen) return;
    const mq = window.matchMedia("(max-width: 900px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedId, profileOpen]);

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

  function flash(message: string, undo?: () => void, actionLabel?: string) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, undo, actionLabel });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 7000 : 3200);
  }

  function openProfile(id: string) {
    setSelectedId(id);
    setProfileOpen(true);
    const showAncestors = Boolean(focusId && id !== focusId);
    if (showAncestors) {
      try {
        const key = "sejire.hint.ancestors.v1";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          setAncestorsHint(true);
          window.setTimeout(() => setAncestorsHint(false), 4000);
        }
      } catch {
        /* ignore */
      }
    }
  }

  function closeProfile() {
    panelRef.current?.flush();
    setProfileOpen(false);
    setSelectedId(null);
    setAncestorsHint(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // PublishSeedModal handles its own Escape (seed-safe).
      if (showPublish) return;
      if (pending) {
        setPending(null);
        return;
      }
      if (profileOpen) {
        closeProfile();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPublish, pending, profileOpen]);

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
      setProfileOpen(true);
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
      setProfileOpen(true);
      flash(pending.role === "mother" ? "Мама добавлена" : "Папа добавлен");
    } else if (pending.type === "child") {
      person.parents = [pending.parentId];
      next = setDraftPerson(store, person);
      setSelectedId(id);
      setProfileOpen(true);
      flash(
        "Ребёнок добавлен. На схеме видны предки — чтобы увидеть его карточку, откройте схему от него.",
        () => setFocus(id),
        "Показать от него"
      );
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
      next = commitDraft(store, "Снимок перед сохранением");
      persist(next);
    }
    setPublishStore(next);
    setShowPublish(true);
  }

  function setFocus(id: string) {
    panelRef.current?.flush();
    setFocusId(id);
    setSelectedId(id);
    setProfileOpen(false);
    setAncestorsHint(false);
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

  function openShezhirePdfPicker() {
    const id = selectedId ?? homeFocusId ?? focusId;
    if (!id || !people.length) {
      flash("Сначала добавьте человека на древо");
      return;
    }
    setShowShezhireTemplate(true);
  }

  async function exportShezhirePdf(template: ShezhireTemplateId) {
    const id = selectedId ?? homeFocusId ?? focusId;
    if (!id || !people.length) {
      flash("Сначала добавьте человека на древо");
      return;
    }
    setShowShezhireTemplate(false);
    try {
      await downloadShezhirePdf({
        snapshot: store.draft,
        startId: id,
        meta: store.meta,
        locale: "ru",
        maxGenerations: SHEZHIRE_MAX_GENERATIONS,
        template,
      });
      flash("Жеті ата PDF скачан");
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  }

  function exportJson() {
    try {
      downloadTreeJson(store, guide);
      flash("JSON скачан — все данные древа");
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  }

  async function importJsonFile(file: File | null) {
    if (!file) return;
    if (!confirmReplaceDraft("загрузка JSON")) return;
    const result = await readTreeJsonFile(file);
    if (!result.ok) {
      flash(result.error);
      return;
    }
    saveDraftTree(result.store);
    saveGuide(result.guide);
    onStoreChange(result.store);
    onGuideChange(result.guide);
    setFocusId(pickHomeFocus(result.store.draft, result.guide.selfId));
    setSelectedId(result.guide.selfId ?? pickDefaultFocus(result.store.draft, null));
    setProfileOpen(false);
    flash(`Загружено: ${Object.keys(result.store.draft.persons).length} чел.`);
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
            {shezhireLine ? (
              <button
                type="button"
                className="tree-shezhire is-set"
                onClick={() => setShowShezhireMeta(true)}
                title="Изменить жүз и ру"
              >
                {shezhireLine}
              </button>
            ) : null}
          </div>
        </div>
        <nav className="top-actions">
          <button type="button" className="btn" onClick={openPublish}>
            Сохранить
          </button>
          <details className="top-more" ref={moreRef}>
            <summary className="btn ghost" aria-label="Ещё">
              ⋯
            </summary>
            <div className="top-more-menu" role="menu">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  closeMoreMenu();
                  setShowShezhireMeta(true);
                }}
                title="Для казахского шежіре. Можно не заполнять"
              >
                Шежіре · жүз и ру
              </button>
              {people.length >= 1 && (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      closeMoreMenu();
                      void exportClassicPdf();
                    }}
                  >
                    Древо в PDF
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      closeMoreMenu();
                      openShezhirePdfPicker();
                    }}
                  >
                    Жеті ата PDF
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  closeMoreMenu();
                  exportJson();
                }}
                title="Скачать все данные древа в JSON"
              >
                Выгрузить JSON
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  closeMoreMenu();
                  jsonInputRef.current?.click();
                }}
                title="Загрузить древо из JSON-файла"
              >
                Загрузить JSON
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  closeMoreMenu();
                  onHome();
                }}
              >
                На главную
              </button>
            </div>
          </details>
          <input
            ref={jsonInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void importJsonFile(file);
              e.target.value = "";
            }}
          />
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
              {toast.actionLabel ?? "Вернуть"}
            </button>
          ) : null}
        </div>
      )}

      <div className={`workspace-main${profileOpen && selected ? " has-panel" : ""}`}>
        <PedigreeView
          snapshot={store.draft}
          focusId={focusId}
          homeFocusId={homeFocusId}
          selectedId={selectedId}
          onSelect={openProfile}
          onSetFocus={setFocus}
          onEmptyStart={() => setPending({ type: "self" })}
          onAddRelative={(slot: AddMeSlot) =>
            setPending({ type: "parent", childId: slot.childId, role: slot.role })
          }
        />

        {selected && profileOpen ? (
          <button
            type="button"
            className="person-sheet-backdrop"
            aria-label="Закрыть профиль"
            onClick={closeProfile}
          />
        ) : null}

        <PersonPanel
          ref={panelRef}
          person={selected}
          relatives={relatives}
          open={profileOpen}
          hasFather={Boolean(selected && relatives.some((r) => r.relation === "Папа"))}
          hasMother={Boolean(selected && relatives.some((r) => r.relation === "Мама"))}
          highlightAncestors={ancestorsHint}
          onClose={closeProfile}
          onChange={onPersonChange}
          showFocusAncestors={Boolean(selected && focusId && selected.id !== focusId)}
          onFocusAncestors={() => {
            if (!selected) return;
            setAncestorsHint(false);
            setFocus(selected.id);
          }}
          onSelectRelative={(id) => openProfile(id)}
          onDelete={() => {
            if (!selected) return;
            const removedId = selected.id;
            const removedName = selected.name;
            const wasFocus = focusId === removedId;
            const afterRemove = removeDraftPerson(store, removedId);
            persist(afterRemove);
            setSelectedId(null);
            setProfileOpen(false);
            if (wasFocus) {
              setFocusId(pickDefaultFocus(afterRemove.draft, homeFocusId));
            }
            flash(`«${removedName}» убран(а) с древа`, () => {
              const restored = restoreDraftPerson(afterRemove, removedId);
              persist(restored);
              setSelectedId(removedId);
              setProfileOpen(true);
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
          askSex={pending.type === "self" || pending.type === "child"}
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

      {showShezhireTemplate && (
        <ShezhireTemplateModal
          onClose={() => setShowShezhireTemplate(false)}
          onPick={(template) => void exportShezhirePdf(template)}
        />
      )}

      {showShezhireMeta && (
        <ShezhireMetaModal
          meta={store.meta}
          onClose={() => setShowShezhireMeta(false)}
          onSave={({ zhuz, clanName }) => {
            onStoreChange((prev) => ({
              ...prev,
              dirty: true,
              meta: {
                ...prev.meta,
                zhuz,
                clanName,
              },
            }));
            setShowShezhireMeta(false);
            flash(
              zhuz || clanName
                ? "Жүз и ру сохранены для этого древа"
                : "Жүз и ру очищены"
            );
          }}
        />
      )}
    </div>
  );
}
