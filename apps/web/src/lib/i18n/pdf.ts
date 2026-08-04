/**
 * PDF / export copy. Keep keyed messages so UI can switch locales later.
 */
export type PdfLocale = "ru";

type PdfMessages = {
  classicTitle: string;
  shezhireTitle: string;
  shezhireSubtitle: string;
  /** Labels by distance from focus: 0 = self, 1 = father, … */
  jetiAtaLabel: (distanceFromFocus: number) => string;
  clanLabel: string;
  zhuzLabel: string;
  noPeople: string;
  noMaleLine: string;
  exportedWith: string;
};

/** Classic жеті ата names counting from self upward (өзі → түп ата). */
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
  jetiAtaLabel: (d) => JETI_ATA_FROM_SELF[Math.min(Math.max(0, d), JETI_ATA_FROM_SELF.length - 1)] ?? `${d + 1}`,
  clanLabel: "Ру",
  zhuzLabel: "Жүз",
  noPeople: "В древе нет людей для экспорта",
  noMaleLine: "Нет мужской линии для шежіре (нужен отец или выбран мужчина)",
  exportedWith: "SEJIRE",
};

const catalogs: Record<PdfLocale, PdfMessages> = { ru };

export function pdfT(locale: PdfLocale = "ru"): PdfMessages {
  return catalogs[locale] ?? catalogs.ru;
}
