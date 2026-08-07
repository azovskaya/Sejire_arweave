/**
 * Client config for fiat-sponsored publish.
 *
 * VITE_PUBLISH_MODE:
 *   - self     — user funds derived AR address (default / fallback)
 *   - sponsor  — cashier (Kaspi later; mock now)
 *
 * VITE_SPONSOR_URL — Worker origin, e.g. http://127.0.0.1:8787
 */

export type PublishMode = "self" | "sponsor";

export function getPublishMode(): PublishMode {
  const raw = (import.meta.env.VITE_PUBLISH_MODE as string | undefined)?.toLowerCase();
  if (raw === "sponsor") return "sponsor";
  return "self";
}

export function getSponsorUrl(): string | null {
  const url = (import.meta.env.VITE_SPONSOR_URL as string | undefined)?.trim();
  if (!url) return null;
  return url.replace(/\/$/, "");
}

export function isSponsorPublishEnabled(): boolean {
  return getPublishMode() === "sponsor" && Boolean(getSponsorUrl());
}
