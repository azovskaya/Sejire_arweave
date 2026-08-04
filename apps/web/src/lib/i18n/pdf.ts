/**
 * PDF / export copy. Keep keyed messages so UI can switch locales later.
 */
export type PdfLocale = "ru";

type PdfMessages = {
  classicTitle: string;
  shezhireTitle: string;
  shezhireSubtitle: string;
  /** Labels by distance from focus: 0 = self, 1 = father, … (supports 13+) */
  jetiAtaLabel: (distanceFromFocus: number) => string;
  clanLabel: string;
  zhuzLabel: string;
  colNumber: string;
  colGeneration: string;
  colName: string;
  colDates: string;
  noPeople: string;
  noMaleLine: string;
  exportedWith: string;
};

/** Classic names for the first seven from self; further gens use numbered ата. */
const JETI_ATA_FROM_SELF = [
  "Өзі",
  "Әке",
  "Ата",
  "Арғы ата",
  "Баба",
  "Тек ата",
  "Түп ата",
] as const;

const ru: PdfMessages = {
  classicTitle: "Генеалогическое древо",
  shezhireTitle: "Жеті ата",
  shezhireSubtitle: "Шежіре",
  jetiAtaLabel: (d) => {
    const i = Math.max(0, d);
    if (i < JETI_ATA_FROM_SELF.length) return JETI_ATA_FROM_SELF[i];
    return `${i + 1}-ші ата`;
  },
  clanLabel: "Ру",
  zhuzLabel: "Жүз",
  colNumber: "№",
  colGeneration: "Буын",
  colName: "Есімі",
  colDates: "Жылдары",
  noPeople: "В древе нет людей для экспорта",
  noMaleLine: "Нет мужской линии для шежіре (нужен отец или выбран мужчина)",
  exportedWith: "SEJIRE",
};

const catalogs: Record<PdfLocale, PdfMessages> = { ru };

export function pdfT(locale: PdfLocale = "ru"): PdfMessages {
  return catalogs[locale] ?? catalogs.ru;
}

/** Soft cap for male-line posters (7 classic жеті ата, up to 13 for deep lines). */
export const SHEZHIRE_MAX_GENERATIONS = 13;
