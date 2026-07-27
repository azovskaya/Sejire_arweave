/**
 * PDF / export copy. Keep keyed messages so UI can switch locales later.
 */
export type PdfLocale = "ru";

type PdfMessages = {
  classicTitle: string;
  shezhireTitle: string;
  generation: (n: number) => string;
  clanLabel: string;
  noPeople: string;
  noMaleLine: string;
  exportedWith: string;
};

const ru: PdfMessages = {
  classicTitle: "Семейное древо",
  shezhireTitle: "Шежіре",
  generation: (n) => `${n}`,
  clanLabel: "Ру",
  noPeople: "В древе нет людей для экспорта",
  noMaleLine: "Нет мужской линии для шежіре (нужен отец или выбран мужчина)",
  exportedWith: "SEJIRE",
};

const catalogs: Record<PdfLocale, PdfMessages> = { ru };

export function pdfT(locale: PdfLocale = "ru"): PdfMessages {
  return catalogs[locale] ?? catalogs.ru;
}
