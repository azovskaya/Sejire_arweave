import ArweaveImport from "arweave";
import type Arweave from "arweave";

type ArweaveStatic = {
  init: (config: {
    host: string;
    port: number;
    protocol: string;
  }) => Arweave;
};

/**
 * Vite can double-wrap the CJS `arweave` default export so `.init` is not on
 * the value that `import Arweave from "arweave"` yields. Resolve the real API.
 */
function resolveArweaveStatic(): ArweaveStatic {
  const root = ArweaveImport as unknown as ArweaveStatic & {
    default?: ArweaveStatic & { default?: ArweaveStatic };
  };
  if (typeof root?.init === "function") return root;
  if (typeof root?.default?.init === "function") return root.default;
  if (typeof root?.default?.default?.init === "function") return root.default.default;
  throw new Error("Не удалось загрузить Arweave-клиент (Arweave.init недоступен).");
}

const ArweaveApi = resolveArweaveStatic();

/** Shared gateway client for publish / address helpers. */
export function createArweaveClient(): Arweave {
  return ArweaveApi.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });
}
