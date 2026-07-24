import { useState } from "react";
import { Welcome } from "./components/Welcome";
import { Workspace } from "./components/Workspace";
import { RestoreSeed } from "./components/RestoreSeed";
import type { TreeStore } from "./lib/types";
import { clearDraftTree, loadDraftTree, saveDraftTree } from "./lib/draftStorage";
import {
  clearGuide,
  defaultGuide,
  loadGuide,
  saveGuide,
  startGuidedTree,
  type GuideState,
} from "./lib/guide";

type Screen = "welcome" | "work" | "restore";

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [store, setStore] = useState<TreeStore | null>(null);
  const [guide, setGuide] = useState<GuideState>(defaultGuide());

  function startNew(title: string) {
    clearDraftTree();
    clearGuide();
    const started = startGuidedTree(title);
    saveDraftTree(started.store);
    saveGuide(started.guide);
    setStore(started.store);
    setGuide(started.guide);
    setScreen("work");
  }

  function continueDraft() {
    const draft = loadDraftTree();
    if (!draft) return;
    setStore(draft);
    setGuide(loadGuide() ?? { ...defaultGuide(), step: "done" });
    setScreen("work");
  }

  return (
    <div className={screen === "work" ? "app-shell is-work" : "app-shell"}>
      {screen === "welcome" && (
        <>
          <Welcome
            onStartNew={startNew}
            onContinueDraft={continueDraft}
            onRestoreSeed={() => setScreen("restore")}
          />
          <p className="footer-note">
            Светлый интерфейс в духе Arweave. Pedigree + панель профиля. 12 слов — только при публикации.
          </p>
        </>
      )}

      {screen === "restore" && (
        <RestoreSeed onBack={() => setScreen("welcome")} onRestored={continueDraft} />
      )}

      {screen === "work" && store && (
        <Workspace
          store={store}
          guide={guide}
          onStoreChange={setStore}
          onGuideChange={setGuide}
          onHome={() => setScreen("welcome")}
        />
      )}
    </div>
  );
}
