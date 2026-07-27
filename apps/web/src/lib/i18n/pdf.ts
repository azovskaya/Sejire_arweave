/**
 * PDF / export copy. Keep keyed messages so UI can switch locales later.
 */
export type PdfLocale = "ru";

type PdfMessages = {
  classicTitle: string;
  classicSubtitle: string;
  shezhireTitle: string;
  shezhireSubtitle: string;
  generation: (n: number) => string;
  clanLabel: string;
  tamgaPlaceholder: string;
  noPeople: string;
  noMaleLine: string;
  years: string;
  birthPlace: string;
  exportedWith: string;
  focusLabel: string;
};

const ru: PdfMessages = {
  classicTitle: "Семейное древо",
  classicSubtitle: "Классическая схема: младшие внизу, предки выше",
  shezhireTitle: "Шежіре",
  shezhireSubtitle: "Мужская линия · жети ата",
  generation: (n) => `Поколение ${n}`,
  clanLabel: "Ру / род",
  tamgaPlaceholder: "Место для тамги",
  noPeople: "В древе нет людей для экспорта",
  noMaleLine: "Нет мужской линии для шежіре (нужен отец или выбран мужчина)",
  years: "Годы",
  birthPlace: "Место рождения",
  exportedWith: "SEJIRE",
  focusLabel: "От",
};

const catalogs: Record<PdfLocale, PdfMessages> = { ru };

export function pdfT(locale: PdfLocale = "ru"): PdfMessages {
  return catalogs[locale] ?? catalogs.ru;
}
