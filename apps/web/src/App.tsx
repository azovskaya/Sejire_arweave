import { useState } from "react";
import { Onboarding } from "./components/Onboarding";
import { Workspace } from "./components/Workspace";
import type { SejireKeys } from "./lib/crypto/keys";
import type { VaultV1 } from "./lib/crypto/vault";

export default function App() {
  const [session, setSession] = useState<{ keys: SejireKeys; vault: VaultV1 } | null>(null);

  return (
    <div className="app-shell">
      {!session ? (
        <Onboarding onUnlocked={(keys, vault) => setSession({ keys, vault })} />
      ) : (
        <Workspace
          keys={session.keys}
          vault={session.vault}
          onVaultChange={(vault) => setSession({ keys: session.keys, vault })}
          onLock={() => setSession(null)}
        />
      )}
      {!session && (
        <p className="footer-note">
          Протокол SEJIRE · доступ по BIP-39 · шифрование AES-GCM на устройстве · вечность на Arweave.
          Документация: docs/security/SEED_ACCESS.md
        </p>
      )}
    </div>
  );
}
