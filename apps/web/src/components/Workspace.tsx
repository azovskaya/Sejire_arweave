import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Person, TreeStore } from "../lib/types";
import { saveDraftTree } from "../lib/draftStorage";
import { type GuideState, defaultGuide, saveGuide } from "../lib/guide";
import { pickDefaultFocus, pickHomeFocus, splitParents, type AddMeSlot } from "../lib/pedigree";
import { PedigreeView } from "./PedigreeView";
import { PersonPanel, type PersonPanelHandle } from "./PersonPanel";
import { AddPersonModal, type AddPersonPayload } from "./AddPersonModal";
import { PublishSeedModal } from "./PublishSeedModal";
import { VaultVersionsModal, vaultPersonCount } from "./VaultVersionsModal";
import {
  activePersons,
  commitDraft,
  createTree,
  removeDraftPerson,
  restoreDraftPerson,
  setDraftPerson,
} from "../lib/treeEngine";
import { SHEZHIRE_MAX_GENERATIONS } from "../lib/i18n/pdf";
import type { ShezhireTemplateId } from "../lib/pdf/shezhireTemplates";
import { downloadTreeJson, readTreeJsonFile, coerceTreeStore } from "../lib/treeJson";
import { formatShezhireAffiliation } from "../lib/zhuzRu";
import { ShezhireMetaModal } from "./ShezhireMetaModal";
import { ShezhireTemplateModal } from "./ShezhireTemplateModal";
import {
  clearVaultSession,
  getSessionMnemonic,
  getVaultSession,
} from "../lib/vaultSession/session";
import type { VaultV1 } from "../lib/crypto/vault";
import { STORAGE_QUOTA_HINT } from "../lib/storageQuota";
import { isPagesTestMirror } from "../lib/siteMirror";
import { pickPdfRootId } from "../lib/pdfRoot";
import { mirrorStoreToProtocol } from "../lib/ao/protocolMirror";
import {
  queryPersonFromDraft,
  type PersonProtocolView,
} from "../lib/ao/protocolKinship";

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
  | { type: "parent"; childId: string; role: "father" | "mother" };

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
  const [showVersions, setShowVersions] = useState(false);
  const [protocolView, setProtocolView] = useState<PersonProtocolView | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(false);
  const vaultSession = getVaultSession();

  const shezhireLine = useMemo(
    () => formatShezhireAffiliation(store.meta?.zhuz, store.meta?.clanName),
    [store.meta?.zhuz, store.meta?.clanName]
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
    if (!saveDraftTree(store)) {
      setToast({ message: STORAGE_QUOTA_HINT });
    }
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

  useEffect(() => {
    if (!selectedId || !profileOpen) {
      setProtocolView(null);
      setProtocolLoading(false);
      return;
    }
    let cancelled = false;
    setProtocolLoading(true);
    const timer = window.setTimeout(() => {
      void queryPersonFromDraft(store, selectedId)
        .then((view) => {
          if (!cancelled) setProtocolView(view);
        })
        .catch(() => {
          if (!cancelled) setProtocolView(null);
        })
        .finally(() => {
          if (!cancelled) setProtocolLoading(false);
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedId, profileOpen, store]);

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
      // PublishSeedModal / VaultVersionsModal handle their own Escape (seed-safe).
      if (showPublish || showVersions) return;
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
  }, [showPublish, showVersions, pending, profileOpen]);

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
      setProfileOpen(false);
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
    void mirrorStoreToProtocol(next).catch(() => {
      /* локальное зеркало не должно ломать сохранение сейфа */
    });
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
    flash(name ? `На схеме предки «${name}»` : "Схема перестроена");
  }

  async function exportClassicPdf() {
    const id = pickPdfRootId({ selectedId: selectedId, focusId, homeId: homeFocusId });
    if (!id || !people.length) {
      flash("Сначала добавьте человека на древо");
      return;
    }
    try {
      const { downloadClassicTreePdf } = await import("../lib/pdf/classicTreePdf");
      const paper = await downloadClassicTreePdf({
        snapshot: store.draft,
        focusId: id,
        meta: store.meta,
        locale: "ru",
      });
      flash(`PDF древа скачан · ${paper}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : String(e));
    }
  }

  function openShezhirePdfPicker() {
    const id = pickPdfRootId({ selectedId: selectedId, focusId, homeId: homeFocusId });
    if (!id || !people.length) {
      flash("Сначала добавьте человека на древо");
      return;
    }
    setShowShezhireTemplate(true);
  }

  async function exportShezhirePdf(template: ShezhireTemplateId) {
    const id = pickPdfRootId({ selectedId: selectedId, focusId, homeId: homeFocusId });
    if (!id || !people.length) {
      flash("Сначала добавьте человека на древо");
      return;
    }
    setShowShezhireTemplate(false);
    try {
      const { downloadShezhirePdf } = await import("../lib/pdf/shezhirePdf");
      await downloadShezhirePdf({
        snapshot: store.draft,
        startId: id,
        meta: store.meta,
        locale: "ru",
        maxGenerations: SHEZHIRE_MAX_GENERATIONS,
        template,
      });
      flash("Шежіре PDF скачан");
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

  function applyVaultVersion(vault: VaultV1) {
    const treeId = vault.active_tree_id;
    const next = coerceTreeStore(treeId ? vault.trees[treeId] : Object.values(vault.trees)[0]);
    if (!next) {
      flash("В этой версии нет деревьев");
      return;
    }
    if (!confirmReplaceDraft("открытие другой версии сейфа")) return;
    const selfId = pickHomeFocus(next.draft, null);
    const nextGuide = { ...defaultGuide(), step: "done" as const, selfId };
    if (!saveDraftTree(next)) flash(STORAGE_QUOTA_HINT);
    saveGuide(nextGuide);
    onStoreChange(next);
    onGuideChange(nextGuide);
    setFocusId(selfId);
    setSelectedId(selfId);
    setProfileOpen(false);
    setShowVersions(false);
    flash(
      `Открыта версия · ${vaultPersonCount(vault)} чел. Можно править и снова сохранить (новая оплата).`
    );
  }

  function goHome() {
    clearVaultSession();
    onHome();
  }

  async function importJsonFile(file: File | null) {
    if (!file) return;
    if (!confirmReplaceDraft("загрузка JSON")) return;
    const result = await readTreeJsonFile(file);
    if (!result.ok) {
      flash(result.error);
      return;
    }
    if (!saveDraftTree(result.store)) flash(STORAGE_QUOTA_HINT);
    saveGuide(result.guide);
    onStoreChange(result.store);
    onGuideChange(result.guide);
    setFocusId(pickHomeFocus(result.store.draft, result.guide.selfId));
    setSelectedId(result.guide.selfId ?? pickDefaultFocus(result.store.draft, null));
    setProfileOpen(false);
    flash(`Загружено: ${Object.keys(result.store.draft.persons).length} чел.`);
  }

  async function loadDemoThirteen() {
    if (!confirmReplaceDraft("пример линии ата на 13 колен")) return;
    const {
      QA_13_FOCUS_ID,
      qaPaternalLineMeta,
      qaPaternalLinePersonCount,
      qaPaternalLineSnapshot,
    } = await import("../lib/pdf/thirteenLineage.fixture");
    const snapshot = qaPaternalLineSnapshot(13);
    const meta = qaPaternalLineMeta(13);
    const next = { ...createTree(meta.title), meta, draft: snapshot, dirty: true };
    const nextGuide = { ...defaultGuide(), step: "done" as const, selfId: QA_13_FOCUS_ID };
    if (!saveDraftTree(next)) flash(STORAGE_QUOTA_HINT);
    saveGuide(nextGuide);
    onStoreChange(next);
    onGuideChange(nextGuide);
    setFocusId(QA_13_FOCUS_ID);
    setSelectedId(QA_13_FOCUS_ID);
    setProfileOpen(false);
    flash(
      `Пример: линия ата на 13 колен · ${qaPaternalLinePersonCount(13)} чел. (полное двоичное на схему не грузим)`
    );
  }

  async function loadDemoSeven() {
    if (!confirmReplaceDraft("пример полного древа на 7 колен")) return;
    const { QA_13_FOCUS_ID, qaCompleteAncestryMeta, qaCompleteAncestrySnapshot } = await import(
      "../lib/pdf/thirteenLineage.fixture"
    );
    const snapshot = qaCompleteAncestrySnapshot(7);
    const meta = qaCompleteAncestryMeta(7);
    const next = { ...createTree(meta.title), meta, draft: snapshot, dirty: true };
    const nextGuide = { ...defaultGuide(), step: "done" as const, selfId: QA_13_FOCUS_ID };
    if (!saveDraftTree(next)) flash(STORAGE_QUOTA_HINT);
    saveGuide(nextGuide);
    onStoreChange(next);
    onGuideChange(nextGuide);
    setFocusId(QA_13_FOCUS_ID);
    setSelectedId(QA_13_FOCUS_ID);
    setProfileOpen(false);
    flash("Пример: 127 чел., полное древо на 7 колен");
  }

  const modalTitle =
    pending?.type === "self"
      ? "Добавить себя"
      : pending?.type === "parent"
        ? pending.role === "mother"
          ? "Добавить маму"
          : "Добавить папу"
        : "";

  return (
    <div className="app-frame">
      <header className="app-topbar">
        <div className="brand">
          <span className="brand-glyph" aria-hidden />
          <div>
            <strong>SEJIRE</strong>
            {isPagesTestMirror() ? (
              <span className="brand-mirror">Тестовое зеркало · sejire.ar.io пока старый пак</span>
            ) : null}
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
                Жүз и ру
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
                    Шежіре PDF
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
              {import.meta.env.VITE_QA_TOOLS === "1" ? (
                <>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      closeMoreMenu();
                      void loadDemoSeven();
                    }}
                    title="Полное двоичное древо: отец и мать у каждого до 7-го колена"
                  >
                    Пример: 7 колен
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      closeMoreMenu();
                      void loadDemoThirteen();
                    }}
                    title="Мужская линия и жёны на 13 колен. Полные 8191 карточек на схему не грузим — телефон не выдержит."
                  >
                    Пример: 13 колен (линия ата)
                  </button>
                </>
              ) : null}
              {vaultSession?.vaultId ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    closeMoreMenu();
                    setShowVersions(true);
                  }}
                  title="Все сохранения под теми же 12 словами"
                >
                  Версии сейфа
                </button>
              ) : null}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  closeMoreMenu();
                  goHome();
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
          protocolView={protocolView}
          protocolLoading={protocolLoading}
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
            setPending({ type: "parent", childId: selected.id, role });
          }}
        />
      </div>

      {pending && (
        <AddPersonModal
          title={modalTitle}
          defaultSex={
            pending.type === "parent" ? (pending.role === "mother" ? "F" : "M") : "U"
          }
          askSex={pending.type === "self"}
          onCancel={() => setPending(null)}
          onSave={completeAdd}
        />
      )}

      {showPublish && publishStore && (
        <PublishSeedModal
          store={publishStore}
          parentTxId={getVaultSession()?.headTxId ?? null}
          knownMnemonic={getSessionMnemonic()}
          onClose={() => {
            setShowPublish(false);
            setPublishStore(null);
          }}
          onPublished={({ mode, txId, mock, isNewVersion }) => {
            setShowPublish(false);
            setPublishStore(null);
            const ver = isNewVersion ? " Новая версия; прошлые — в «Версии сейфа»." : "";
            if (mode === "demo") {
              flash(
                `Демо-версия сохранена в этом браузере (${txId?.slice(0, 10)}…). Храните 12 слов.${ver}`
              );
            } else if (mode === "sponsor") {
              flash(
                mock
                  ? `Mock-кассир: сейф принят (${txId?.slice(0, 10)}…). Когда будет Turbo — это станет реальным TX. Храните 12 слов.${ver}`
                  : `Навсегда в Arweave (${txId?.slice(0, 8)}…). Храните 12 слов.${ver}`
              );
            } else if (mode === "arweave") {
              flash(`Сохранено в Arweave (${txId?.slice(0, 8)}…). Храните 12 слов.${ver}`);
            } else {
              flash(`Файл сейфа скачан${txId ? ` · версия ${txId.slice(0, 10)}…` : ""}. Храните 12 слов.${ver}`);
            }
          }}
        />
      )}

      {showVersions && (
        <VaultVersionsModal
          onClose={() => setShowVersions(false)}
          onOpenVersion={applyVaultVersion}
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
