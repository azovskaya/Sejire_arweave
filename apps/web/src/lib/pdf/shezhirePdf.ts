import { jsPDF } from "jspdf";
import type { Person, Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { maleLineUp, lifeDatesLine } from "./lineage";
import { ensurePdfFont, setPdfFont } from "./font";
import { drawBrandMark, fitText, safeFilename, wrapName } from "./poster";
import { formatShezhireAffiliation, zhuzFullLabel } from "../zhuzRu";
import {
  drawDiamondKnot,
  drawLabelPlaque,
  drawNameCartouche,
  drawOrnamentBorder,
  drawTitleOrnament,
  type Rgb,
} from "./ornaments";

export type ShezhireTemplateId = "manuscript" | "registry" | "cascade";

export type ShezhireTemplateInfo = {
  id: ShezhireTemplateId;
  title: string;
  blurb: string;
};

/** Three distinct traditional presentation styles for жеті ата. */
export const SHEZHIRE_TEMPLATES: ShezhireTemplateInfo[] = [
  {
    id: "manuscript",
    title: "Қолжазба",
    blurb: "Пергамент и орнамент — как настенный свиток шежіре",
  },
  {
    id: "registry",
    title: "Тізім",
    blurb: "Книжный список колен: номер, имя, даты",
  },
  {
    id: "cascade",
    title: "Баспалдақ",
    blurb: "Ступени от түп ата вниз к себе",
  },
];

type RenderCtx = {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  line: Person[];
  meta: TreeMeta;
  locale: PdfLocale;
};

function buildLine(snapshot: Snapshot, startId: string, maxGenerations: number): Person[] {
  const youngFirst = maleLineUp(snapshot, startId);
  if (!youngFirst.length) return [];
  const ascending = youngFirst.slice(0, maxGenerations);
  return [...ascending].reverse();
}

/** Affiliation text only — no ornamental overlay on жүз / ру. */
function drawAffiliationBlock(
  doc: jsPDF,
  pageW: number,
  y: number,
  meta: TreeMeta,
  locale: PdfLocale,
  ink: Rgb,
  mute: Rgb
): number {
  const t = pdfT(locale);
  const clan = (meta.clanName || "").trim();
  const zhuz = zhuzFullLabel(meta.zhuz);
  const affiliation = formatShezhireAffiliation(meta.zhuz, meta.clanName);
  if (!affiliation) return y;

  setPdfFont(doc, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...mute);
  const label =
    zhuz && clan ? `${t.zhuzLabel} · ${t.clanLabel}` : zhuz ? t.zhuzLabel : t.clanLabel;
  doc.text(label, pageW / 2, y, { align: "center" });
  setPdfFont(doc, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  const { lines } = wrapName(doc, affiliation, pageW - 56, 2, 11, 8);
  doc.text(lines[0], pageW / 2, y + 5, { align: "center" });
  if (lines[1]) {
    doc.setFontSize(9);
    doc.text(lines[1], pageW / 2, y + 9, { align: "center" });
    return y + 14;
  }
  return y + 10;
}

function renderManuscript(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const parchment: Rgb = [242, 228, 198];
  const parchmentDeep: Rgb = [232, 212, 172];
  const ink: Rgb = [72, 38, 18];
  const gold: Rgb = [148, 98, 42];
  const goldSoft: Rgb = [176, 132, 68];
  const plaque: Rgb = [252, 243, 220];
  const mute: Rgb = [110, 78, 42];

  doc.setFillColor(...parchment);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...parchmentDeep);
  doc.rect(0, 0, 14, pageH, "F");
  doc.rect(pageW - 14, 0, 14, pageH, "F");
  drawOrnamentBorder(doc, pageW, pageH, 8, ink);

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(24);
  doc.text(t.shezhireTitle, pageW / 2, 22, { align: "center" });
  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 27.8, { align: "center" });
  drawTitleOrnament(doc, pageW / 2, 31.5, pageW / 2 - 28, gold);

  let contentTop = drawAffiliationBlock(doc, pageW, 38, meta, locale, ink, mute);
  contentTop += 4;

  const n = line.length;
  const bottomY = pageH - 16;
  const topY = contentTop + 2;
  const available = Math.max(40, bottomY - topY);
  const gap = n > 1 ? Math.min(4.5, available * 0.02) : 0;
  const cartoucheH = Math.min(22, (available - gap * Math.max(0, n - 1)) / n);
  const block = cartoucheH + gap;
  const stackH = n * cartoucheH + Math.max(0, n - 1) * gap;
  const stackTop = topY + Math.max(0, (available - stackH) / 2);
  const spineX = 48;
  const cartoucheX = 58;
  const cartoucheW = pageW - cartoucheX - 18;
  const nameMaxW = cartoucheW - 11;

  if (n > 1) {
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.85);
    const y0 = stackTop + cartoucheH / 2;
    const y1 = stackTop + (n - 1) * block + cartoucheH / 2;
    doc.line(spineX, y0, spineX, y1);
    doc.setLineWidth(0.25);
    doc.setDrawColor(...goldSoft);
    doc.line(spineX - 1.1, y0, spineX - 1.1, y1);
    doc.line(spineX + 1.1, y0, spineX + 1.1, y1);
  }

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    const distanceFromFocus = n - 1 - i;
    const y = stackTop + i * block;
    const cy = y + cartoucheH / 2;
    const label = t.jetiAtaLabel(distanceFromFocus);

    drawDiamondKnot(doc, spineX, cy, Math.min(3.2, cartoucheH * 0.22), ink, parchment);
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.35);
    doc.line(spineX + 3.2, cy, cartoucheX - 4.6, cy);
    drawLabelPlaque(doc, spineX - 5, cy, label, ink, plaque, (bold) =>
      setPdfFont(doc, bold ? "bold" : "normal")
    );
    drawNameCartouche(doc, cartoucheX, y, cartoucheW, cartoucheH, ink, plaque, gold);

    const life = lifeDatesLine(person, false);
    const hasMeta = Boolean(life);
    const nameMaxLines = cartoucheH < 16 ? (hasMeta ? 1 : 2) : hasMeta ? 2 : 3;
    const prefer = cartoucheH >= 20 ? 11 : cartoucheH >= 16 ? 9.5 : 8;
    const { lines: nameLines, fontSize } = wrapName(
      doc,
      person.name || "—",
      nameMaxW,
      nameMaxLines,
      prefer,
      6.2
    );

    setPdfFont(doc, "bold");
    doc.setTextColor(...ink);
    doc.setFontSize(fontSize);
    const lineH = fontSize * 0.42 + 0.35;
    const metaSize = Math.min(6.6, fontSize * 0.78);
    const metaH = hasMeta ? metaSize + 1.6 : 0;
    const blockH = nameLines.length * lineH + metaH;
    let ty = cy - blockH / 2 + lineH * 0.72;

    for (const nl of nameLines) {
      doc.text(nl, cartoucheX + cartoucheW / 2, ty, { align: "center" });
      ty += lineH;
    }
    if (life) {
      setPdfFont(doc, "normal");
      doc.setFontSize(metaSize);
      doc.setTextColor(...mute);
      doc.text(fitText(doc, life, nameMaxW, metaSize), cartoucheX + cartoucheW / 2, ty + 1.2, {
        align: "center",
      });
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [140, 105, 60]);
}

/** Book-style sequential list — traditional written shezhire register. */
function renderRegistry(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const paper: Rgb = [252, 250, 245];
  const ink: Rgb = [28, 28, 28];
  const mute: Rgb = [100, 100, 100];
  const rule: Rgb = [180, 175, 165];

  doc.setFillColor(...paper);
  doc.rect(0, 0, pageW, pageH, "F");

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(20);
  doc.text(t.shezhireTitle, pageW / 2, 22, { align: "center" });
  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 28, { align: "center" });

  let y = drawAffiliationBlock(doc, pageW, 36, meta, locale, ink, mute);
  y += 6;

  doc.setDrawColor(...rule);
  doc.setLineWidth(0.3);
  doc.line(22, y, pageW - 22, y);
  y += 8;

  const n = line.length;
  const bottom = pageH - 18;
  const rowH = Math.min(18, (bottom - y) / Math.max(1, n));

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    const distanceFromFocus = n - 1 - i;
    const label = t.jetiAtaLabel(distanceFromFocus);
    const life = lifeDatesLine(person, false);
    const rowY = y + i * rowH;

    setPdfFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...mute);
    doc.text(`${i + 1}.`, 24, rowY + 5);
    doc.text(label, 34, rowY + 5);

    setPdfFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    const name = fitText(doc, person.name || "—", pageW - 90, 11);
    doc.text(name, 62, rowY + 5);

    if (life) {
      setPdfFont(doc, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...mute);
      doc.text(life, pageW - 24, rowY + 5, { align: "right" });
    }

    doc.setDrawColor(...rule);
    doc.setLineWidth(0.18);
    doc.line(22, rowY + rowH - 2, pageW - 22, rowY + rowH - 2);
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [120, 120, 120]);
}

/** Stepped cascade from oldest (top) down to self — geometric wall chart. */
function renderCascade(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const bg: Rgb = [246, 242, 236];
  const ink: Rgb = [40, 32, 24];
  const mute: Rgb = [110, 95, 80];
  const accent: Rgb = [130, 78, 42];
  const fill: Rgb = [255, 252, 247];

  doc.setFillColor(...bg);
  doc.rect(0, 0, pageW, pageH, "F");

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(18);
  doc.text(t.shezhireTitle, pageW / 2, 20, { align: "center" });
  setPdfFont(doc, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 26, { align: "center" });

  let y = drawAffiliationBlock(doc, pageW, 34, meta, locale, ink, mute);
  y += 5;

  const n = line.length;
  const bottom = pageH - 16;
  const available = Math.max(40, bottom - y);
  const gap = 2.2;
  const stepH = Math.min(20, (available - gap * Math.max(0, n - 1)) / n);
  const maxW = pageW - 36;
  const minW = pageW * 0.48;

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    const distanceFromFocus = n - 1 - i;
    const label = t.jetiAtaLabel(distanceFromFocus);
    const life = lifeDatesLine(person, false);
    const tFrac = n <= 1 ? 0 : i / (n - 1);
    const w = maxW - (maxW - minW) * tFrac;
    const x = (pageW - w) / 2;
    const rowY = y + i * (stepH + gap);

    if (i > 0) {
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.45);
      const prevW = maxW - (maxW - minW) * ((i - 1) / Math.max(1, n - 1));
      const prevX = (pageW - prevW) / 2;
      const prevBottom = y + (i - 1) * (stepH + gap) + stepH;
      doc.line(prevX + prevW / 2, prevBottom, x + w / 2, rowY);
    }

    doc.setFillColor(...fill);
    doc.setDrawColor(...ink);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, rowY, w, stepH, 1.2, 1.2, "FD");
    doc.setFillColor(...accent);
    doc.rect(x, rowY, 1.6, stepH, "F");

    setPdfFont(doc, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...mute);
    doc.text(label, x + 5, rowY + 4.2);

    const nameMaxW = w - 12;
    const hasMeta = Boolean(life);
    const { lines: nameLines, fontSize } = wrapName(
      doc,
      person.name || "—",
      nameMaxW,
      hasMeta ? 1 : 2,
      stepH >= 16 ? 10 : 8.5,
      6.5
    );
    setPdfFont(doc, "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(...ink);
    const lineH = fontSize * 0.4 + 0.3;
    let ty = rowY + (hasMeta ? 8.2 : stepH / 2 + lineH * 0.25);
    for (const nl of nameLines) {
      doc.text(nl, x + w / 2, ty, { align: "center" });
      ty += lineH;
    }
    if (life) {
      setPdfFont(doc, "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...mute);
      doc.text(fitText(doc, life, nameMaxW, 6.5), x + w / 2, rowY + stepH - 2.4, {
        align: "center",
      });
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [130, 110, 90]);
}

/**
 * Wall / print «Жеті ата» PDF with selectable layout template.
 */
export async function downloadShezhirePdf(opts: {
  snapshot: Snapshot;
  startId: string;
  meta: TreeMeta;
  locale?: PdfLocale;
  maxGenerations?: number;
  template?: ShezhireTemplateId;
}) {
  const locale = opts.locale ?? "ru";
  const t = pdfT(locale);
  const template = opts.template ?? "manuscript";
  const maxGen = Math.min(opts.maxGenerations ?? 7, 7);
  const line = buildLine(opts.snapshot, opts.startId, maxGen);
  if (!line.length) throw new Error(t.noMaleLine);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await ensurePdfFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ctx: RenderCtx = { doc, pageW, pageH, line, meta: opts.meta, locale };

  if (template === "registry") renderRegistry(ctx);
  else if (template === "cascade") renderCascade(ctx);
  else renderManuscript(ctx);

  const safe = safeFilename(opts.meta.title || "jeti-ata", "jeti-ata");
  doc.save(`sejire-jeti-ata-${template}-${safe}.pdf`);
}
