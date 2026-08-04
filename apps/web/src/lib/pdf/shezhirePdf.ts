import { jsPDF } from "jspdf";
import type { Person, Snapshot, TreeMeta } from "../types";
import { pdfT, SHEZHIRE_MAX_GENERATIONS, type PdfLocale } from "../i18n/pdf";
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
  /** Shown in picker — page orientation */
  format: string;
};

/** Three distinct presentation styles for жеті ата / deep male line. */
export const SHEZHIRE_TEMPLATES: ShezhireTemplateInfo[] = [
  {
    id: "manuscript",
    title: "Қолжазба",
    blurb: "Пергамент, орнамент, вертикальный свиток",
    format: "A4 книжный",
  },
  {
    id: "registry",
    title: "Тізім",
    blurb: "Торжественный список в широкой рамке, до 13 колен",
    format: "A4 книжный",
  },
  {
    id: "cascade",
    title: "Баспалдақ",
    blurb: "Горизонтальная линия предков — для широкой рамы",
    format: "A4 альбомный",
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

function drawAffiliationBlock(
  doc: jsPDF,
  pageW: number,
  y: number,
  meta: TreeMeta,
  locale: PdfLocale,
  ink: Rgb,
  mute: Rgb,
  maxTextW = pageW - 56
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
  const { lines } = wrapName(doc, affiliation, maxTextW, 2, 11, 8);
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
  doc.setFontSize(line.length > 9 ? 20 : 24);
  doc.text(t.shezhireTitle, pageW / 2, 22, { align: "center" });
  if (t.shezhireSubtitle) {
    setPdfFont(doc, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...mute);
    doc.text(t.shezhireSubtitle, pageW / 2, 27.5, { align: "center" });
    drawTitleOrnament(doc, pageW / 2, 31, pageW / 2 - 28, gold);
  } else {
    drawTitleOrnament(doc, pageW / 2, 27, pageW / 2 - 28, gold);
  }

  let contentTop = drawAffiliationBlock(doc, pageW, 34, meta, locale, ink, mute);
  contentTop += 3;

  const n = line.length;
  const bottomY = pageH - 14;
  const topY = contentTop + 1;
  const available = Math.max(36, bottomY - topY);
  const gap = n > 1 ? Math.min(3.2, available * 0.015) : 0;
  const cartoucheH = Math.min(22, Math.max(9.5, (available - gap * Math.max(0, n - 1)) / n));
  const block = cartoucheH + gap;
  const stackH = n * cartoucheH + Math.max(0, n - 1) * gap;
  const stackTop = topY + Math.max(0, (available - stackH) / 2);
  const spineX = n > 10 ? 42 : 48;
  const cartoucheX = n > 10 ? 52 : 58;
  const cartoucheW = pageW - cartoucheX - 16;
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

    drawDiamondKnot(doc, spineX, cy, Math.min(2.8, cartoucheH * 0.22), ink, parchment);
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.35);
    doc.line(spineX + 3, cy, cartoucheX - 4, cy);
    drawLabelPlaque(doc, spineX - 4.5, cy, label, ink, plaque, (bold) =>
      setPdfFont(doc, bold ? "bold" : "normal")
    );
    drawNameCartouche(doc, cartoucheX, y, cartoucheW, cartoucheH, ink, plaque, gold);

    const life = lifeDatesLine(person, false);
    const hasMeta = Boolean(life);
    const nameMaxLines = cartoucheH < 12 ? 1 : cartoucheH < 16 ? (hasMeta ? 1 : 2) : hasMeta ? 2 : 3;
    const prefer = cartoucheH >= 18 ? 11 : cartoucheH >= 13 ? 9 : 7.2;
    const { lines: nameLines, fontSize } = wrapName(
      doc,
      person.name || "—",
      nameMaxW,
      nameMaxLines,
      prefer,
      5.8
    );

    setPdfFont(doc, "bold");
    doc.setTextColor(...ink);
    doc.setFontSize(fontSize);
    const lineH = fontSize * 0.42 + 0.28;
    const metaSize = Math.min(6.2, fontSize * 0.78);
    const metaH = hasMeta && cartoucheH >= 12 ? metaSize + 1.2 : 0;
    const blockH = nameLines.length * lineH + metaH;
    let ty = cy - blockH / 2 + lineH * 0.72;

    for (const nl of nameLines) {
      doc.text(nl, cartoucheX + cartoucheW / 2, ty, { align: "center" });
      ty += lineH;
    }
    if (life && metaH > 0) {
      setPdfFont(doc, "normal");
      doc.setFontSize(metaSize);
      doc.setTextColor(...mute);
      doc.text(fitText(doc, life, nameMaxW, metaSize), cartoucheX + cartoucheW / 2, ty + 1, {
        align: "center",
      });
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [140, 105, 60]);
}

/**
 * Тізім — framed registry poster (portrait). Wall-ready ceremonial list.
 * Visually distinct from Қолжазба: no parchment side panels, no spine cartouches —
 * wide certificate frame + numbered generation rows.
 */
function renderRegistry(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const paper: Rgb = [248, 244, 235];
  const panel: Rgb = [255, 253, 248];
  const ink: Rgb = [36, 28, 20];
  const mute: Rgb = [98, 84, 66];
  const rule: Rgb = [160, 140, 110];
  const accent: Rgb = [120, 72, 36];
  const band: Rgb = [238, 228, 208];
  const gold: Rgb = [150, 110, 55];

  doc.setFillColor(...paper);
  doc.rect(0, 0, pageW, pageH, "F");

  // Wide ceremonial triple frame
  doc.setDrawColor(...ink);
  doc.setLineWidth(1.4);
  doc.rect(7, 7, pageW - 14, pageH - 14);
  doc.setLineWidth(0.35);
  doc.setDrawColor(...gold);
  doc.rect(9.5, 9.5, pageW - 19, pageH - 19);
  doc.setLineWidth(0.55);
  doc.setDrawColor(...ink);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // Corner squares
  const cs = 5;
  doc.setFillColor(...accent);
  for (const [x, y] of [
    [12, 12],
    [pageW - 12 - cs, 12],
    [12, pageH - 12 - cs],
    [pageW - 12 - cs, pageH - 12 - cs],
  ] as const) {
    doc.rect(x, y, cs, cs, "F");
  }

  const marginX = 20;
  const contentW = pageW - marginX * 2;

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(26);
  doc.text(t.shezhireTitle, pageW / 2, 28, { align: "center" });

  // Title underline with end caps
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.55);
  doc.line(pageW / 2 - 36, 32, pageW / 2 + 36, 32);
  doc.setFillColor(...accent);
  doc.circle(pageW / 2 - 36, 32, 1.2, "F");
  doc.circle(pageW / 2 + 36, 32, 1.2, "F");

  let y = drawAffiliationBlock(doc, pageW, 40, meta, locale, ink, mute, contentW - 8);
  y += 6;

  const n = line.length;
  const bottom = pageH - 18;
  const headerH = 9;
  const tableTop = y;
  const tableH = bottom - tableTop;
  const rowH = Math.min(17, Math.max(8, (tableH - headerH - 2) / Math.max(1, n)));

  doc.setFillColor(...panel);
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.45);
  doc.rect(marginX, tableTop, contentW, headerH + n * rowH + 3, "FD");

  doc.setFillColor(...accent);
  doc.rect(marginX, tableTop, contentW, headerH, "F");

  const colNo = marginX + 7;
  const colGen = marginX + 20;
  const colName = marginX + 52;
  const colDate = marginX + contentW - 7;
  const nameMaxW = contentW - 58 - 30;

  setPdfFont(doc, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 250, 242);
  const hy = tableTop + 6;
  doc.text(t.colNumber, colNo, hy);
  doc.text(t.colGeneration, colGen, hy);
  doc.text(t.colName, colName, hy);
  doc.text(t.colDates, colDate, hy, { align: "right" });

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    const distanceFromFocus = n - 1 - i;
    const label = t.jetiAtaLabel(distanceFromFocus);
    const life = lifeDatesLine(person, true);
    const rowY = tableTop + headerH + i * rowH;

    if (i % 2 === 1) {
      doc.setFillColor(...band);
      doc.rect(marginX + 0.5, rowY, contentW - 1, rowH, "F");
    }

    const baseline = rowY + rowH * 0.64;
    const fontName = rowH >= 13 ? 11 : rowH >= 10 ? 9.5 : 8;
    const fontMeta = Math.max(6.4, fontName * 0.7);

    // Number in circle
    const cx = colNo + 2.2;
    const cy = rowY + rowH / 2;
    const cr = Math.min(3.4, rowH * 0.32);
    doc.setFillColor(...(i === n - 1 ? accent : rule));
    doc.circle(cx, cy, cr, "F");
    setPdfFont(doc, "bold");
    doc.setFontSize(Math.max(5.5, cr * 1.4));
    doc.setTextColor(255, 252, 246);
    doc.text(String(i + 1), cx, cy + cr * 0.35, { align: "center" });

    setPdfFont(doc, "normal");
    doc.setFontSize(fontMeta);
    doc.setTextColor(...mute);
    doc.text(fitText(doc, label, 30, fontMeta), colGen, baseline);

    setPdfFont(doc, "bold");
    doc.setFontSize(fontName);
    doc.setTextColor(...ink);
    doc.text(fitText(doc, person.name || "—", nameMaxW, fontName), colName, baseline);

    if (life) {
      setPdfFont(doc, "normal");
      doc.setFontSize(fontMeta);
      doc.setTextColor(...mute);
      doc.text(life, colDate, baseline, { align: "right" });
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [120, 100, 75]);
}

/**
 * Баспалдақ — A4 landscape wall chart (album). Unmistakably wide format.
 * Oldest left → self right on a horizontal spine.
 */
function renderCascade(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const bg: Rgb = [236, 228, 214];
  const ink: Rgb = [40, 28, 18];
  const mute: Rgb = [100, 82, 62];
  const accent: Rgb = [110, 62, 28];
  const goldSoft: Rgb = [168, 128, 72];
  const fill: Rgb = [255, 250, 242];
  const fillSelf: Rgb = [248, 228, 196];

  doc.setFillColor(...bg);
  doc.rect(0, 0, pageW, pageH, "F");

  // Landscape frame — thicker, clearly a wall plaque
  doc.setDrawColor(...ink);
  doc.setLineWidth(1.6);
  doc.rect(6, 6, pageW - 12, pageH - 12);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...goldSoft);
  doc.rect(9, 9, pageW - 18, pageH - 18);

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(22);
  doc.text(t.shezhireTitle, pageW / 2, 20, { align: "center" });

  doc.setFillColor(...accent);
  doc.rect(pageW / 2 - 40, 23.5, 80, 0.7, "F");

  let headerBottom = drawAffiliationBlock(doc, pageW, 30, meta, locale, ink, mute, pageW - 36);
  headerBottom += 4;

  const n = line.length;
  const marginX = 12;
  const bottom = pageH - 11;
  const top = headerBottom;
  const areaH = Math.max(36, bottom - top);
  const areaW = pageW - marginX * 2;

  const gap = n > 10 ? 1.8 : n > 7 ? 2.8 : 4;
  const cardW = Math.min(46, Math.max(15, (areaW - gap * Math.max(0, n - 1)) / n));
  const cardH = Math.min(areaH * 0.78, Math.max(32, areaH * 0.88));
  const totalW = n * cardW + Math.max(0, n - 1) * gap;
  const startX = marginX + Math.max(0, (areaW - totalW) / 2);
  const cardY = top + Math.max(0, (areaH - cardH) / 2);
  const spineY = cardY - 4;

  // Spine above cards
  if (n > 1) {
    doc.setDrawColor(...accent);
    doc.setLineWidth(1.4);
    doc.line(startX + cardW / 2, spineY, startX + totalW - cardW / 2, spineY);
  }

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    const distanceFromFocus = n - 1 - i;
    const isSelf = distanceFromFocus === 0;
    const label = t.jetiAtaLabel(distanceFromFocus);
    const life = lifeDatesLine(person, cardW < 26);
    const x = startX + i * (cardW + gap);

    doc.setFillColor(...accent);
    doc.circle(x + cardW / 2, spineY, 2.1, "F");
    doc.setDrawColor(...ink);
    doc.setLineWidth(0.35);
    doc.line(x + cardW / 2, spineY + 2.1, x + cardW / 2, cardY);

    doc.setFillColor(...(isSelf ? fillSelf : fill));
    doc.setDrawColor(...ink);
    doc.setLineWidth(isSelf ? 0.85 : 0.45);
    doc.roundedRect(x, cardY, cardW, cardH, 1.5, 1.5, "FD");

    doc.setFillColor(...accent);
    doc.roundedRect(x, cardY, cardW, 8.5, 1.5, 1.5, "F");
    doc.rect(x, cardY + 6, cardW, 2.5, "F");

    setPdfFont(doc, "bold");
    doc.setFontSize(cardW < 18 ? 5.2 : 6.2);
    doc.setTextColor(255, 250, 242);
    doc.text(fitText(doc, label, cardW - 3, cardW < 18 ? 5.2 : 6.2), x + cardW / 2, cardY + 5.5, {
      align: "center",
    });

    const nameMaxW = cardW - 4;
    const hasMeta = Boolean(life);
    const prefer = cardW >= 34 ? 10.5 : cardW >= 26 ? 9 : cardW >= 20 ? 7.5 : 6.2;
    const { lines: nameLines, fontSize } = wrapName(
      doc,
      person.name || "—",
      nameMaxW,
      hasMeta ? 2 : 3,
      prefer,
      5.4
    );

    setPdfFont(doc, "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(...ink);
    const lineH = fontSize * 0.42 + 0.25;
    const metaSize = Math.min(6.2, fontSize * 0.72);
    const metaH = hasMeta ? metaSize + 2.2 : 0;
    const blockH = nameLines.length * lineH + metaH;
    let ty = cardY + 12 + Math.max(0, (cardH - 14 - blockH) / 2) + lineH * 0.8;

    for (const nl of nameLines) {
      doc.text(nl, x + cardW / 2, ty, { align: "center" });
      ty += lineH;
    }
    if (life) {
      setPdfFont(doc, "normal");
      doc.setFontSize(metaSize);
      doc.setTextColor(...mute);
      doc.text(fitText(doc, life, nameMaxW, metaSize), x + cardW / 2, ty + 1.6, {
        align: "center",
      });
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [120, 95, 70]);
}

/**
 * Wall / print «Жеті ата» PDF with selectable layout template.
 * Supports 1–13 generations on the male line.
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
  const maxGen = Math.min(
    Math.max(1, opts.maxGenerations ?? SHEZHIRE_MAX_GENERATIONS),
    SHEZHIRE_MAX_GENERATIONS
  );
  const line = buildLine(opts.snapshot, opts.startId, maxGen);
  if (!line.length) throw new Error(t.noMaleLine);

  const landscape = template === "cascade";
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
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
