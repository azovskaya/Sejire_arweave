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
};

/** Three distinct presentation styles for жеті ата / deep male line. */
export const SHEZHIRE_TEMPLATES: ShezhireTemplateInfo[] = [
  {
    id: "manuscript",
    title: "Қолжазба",
    blurb: "Пергамент и орнамент — настенный свиток",
  },
  {
    id: "registry",
    title: "Тізім",
    blurb: "Книжный постер в рамке — список до 13 колен",
  },
  {
    id: "cascade",
    title: "Баспалдақ",
    blurb: "Альбомный формат — линия от түп ата к себе",
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

/** Elegant double frame for wall posters (no horn overlay). */
function drawPosterFrame(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  inset: number,
  ink: Rgb,
  accent: Rgb
) {
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.7);
  doc.rect(inset, inset, pageW - inset * 2, pageH - inset * 2);
  doc.setLineWidth(0.25);
  doc.setDrawColor(...accent);
  doc.rect(inset + 2.4, inset + 2.4, pageW - (inset + 2.4) * 2, pageH - (inset + 2.4) * 2);

  const c = 4.5;
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.45);
  // corner ticks
  for (const [x, y, sx, sy] of [
    [inset + 3.2, inset + 3.2, 1, 1],
    [pageW - inset - 3.2, inset + 3.2, -1, 1],
    [inset + 3.2, pageH - inset - 3.2, 1, -1],
    [pageW - inset - 3.2, pageH - inset - 3.2, -1, -1],
  ] as const) {
    doc.line(x, y, x + sx * c, y);
    doc.line(x, y, x, y + sy * c);
  }
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
  doc.text(t.shezhireTitle, pageW / 2, 20, { align: "center" });
  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 25.5, { align: "center" });
  drawTitleOrnament(doc, pageW / 2, 29, pageW / 2 - 28, gold);

  let contentTop = drawAffiliationBlock(doc, pageW, 35, meta, locale, ink, mute);
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
 * Тізім — framed registry poster (portrait). Wall-ready book of generations.
 */
function renderRegistry(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const paper: Rgb = [250, 246, 238];
  const panel: Rgb = [255, 252, 246];
  const ink: Rgb = [42, 32, 22];
  const mute: Rgb = [105, 90, 72];
  const rule: Rgb = [168, 148, 118];
  const accent: Rgb = [138, 98, 52];
  const band: Rgb = [244, 236, 220];

  doc.setFillColor(...paper);
  doc.rect(0, 0, pageW, pageH, "F");
  drawPosterFrame(doc, pageW, pageH, 10, ink, accent);

  const marginX = 18;
  const contentW = pageW - marginX * 2;

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(22);
  doc.text(t.shezhireTitle, pageW / 2, 24, { align: "center" });

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.35);
  doc.line(pageW / 2 - 28, 27.5, pageW / 2 - 6, 27.5);
  doc.line(pageW / 2 + 6, 27.5, pageW / 2 + 28, 27.5);
  doc.setFillColor(...accent);
  doc.circle(pageW / 2, 27.5, 1.05, "F");

  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 32.5, { align: "center" });

  let y = drawAffiliationBlock(doc, pageW, 38, meta, locale, ink, mute, contentW - 8);
  y += 5;

  const n = line.length;
  const bottom = pageH - 16;
  const headerH = 8;
  const tableTop = y;
  const tableH = bottom - tableTop;
  const rowH = Math.min(16.5, Math.max(8.2, (tableH - headerH) / Math.max(1, n)));

  // table panel
  doc.setFillColor(...panel);
  doc.setDrawColor(...rule);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, tableTop, contentW, headerH + n * rowH + 2, 1.4, 1.4, "FD");

  // header
  doc.setFillColor(...band);
  doc.roundedRect(marginX, tableTop, contentW, headerH, 1.4, 1.4, "F");
  doc.rect(marginX, tableTop + headerH - 1.4, contentW, 1.4, "F");

  const colNo = marginX + 6;
  const colGen = marginX + 18;
  const colName = marginX + 48;
  const colDate = marginX + contentW - 6;
  const nameMaxW = contentW - 54 - 28;

  setPdfFont(doc, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...mute);
  const hy = tableTop + 5.4;
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
      doc.rect(marginX + 0.6, rowY, contentW - 1.2, rowH, "F");
    }

    const baseline = rowY + rowH * 0.62;
    const fontName = rowH >= 12 ? 10.5 : rowH >= 10 ? 9.2 : 8;
    const fontMeta = Math.max(6.2, fontName * 0.72);

    setPdfFont(doc, "normal");
    doc.setFontSize(fontMeta);
    doc.setTextColor(...mute);
    doc.text(String(i + 1), colNo, baseline);
    doc.text(fitText(doc, label, 28, fontMeta), colGen, baseline);

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

    if (i < n - 1) {
      doc.setDrawColor(...rule);
      doc.setLineWidth(0.12);
      doc.line(marginX + 4, rowY + rowH, marginX + contentW - 4, rowY + rowH);
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [130, 110, 85]);
}

/**
 * Баспалдақ — landscape wall chart: oldest → self along a horizontal spine.
 */
function renderCascade(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const bg: Rgb = [245, 240, 230];
  const ink: Rgb = [48, 34, 22];
  const mute: Rgb = [108, 90, 70];
  const accent: Rgb = [132, 86, 42];
  const goldSoft: Rgb = [170, 130, 78];
  const fill: Rgb = [255, 251, 244];
  const fillSelf: Rgb = [252, 240, 220];

  doc.setFillColor(...bg);
  doc.rect(0, 0, pageW, pageH, "F");
  drawPosterFrame(doc, pageW, pageH, 8, ink, accent);

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(20);
  doc.text(t.shezhireTitle, pageW / 2, 18, { align: "center" });
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.35);
  doc.line(pageW / 2 - 32, 21, pageW / 2 - 7, 21);
  doc.line(pageW / 2 + 7, 21, pageW / 2 + 32, 21);
  doc.setFillColor(...accent);
  doc.circle(pageW / 2, 21, 1, "F");

  setPdfFont(doc, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 26, { align: "center" });

  let headerBottom = drawAffiliationBlock(doc, pageW, 31, meta, locale, ink, mute, pageW - 40);
  headerBottom += 4;

  const n = line.length;
  const marginX = 14;
  const bottom = pageH - 12;
  const top = headerBottom;
  const areaH = Math.max(40, bottom - top);
  const areaW = pageW - marginX * 2;

  const gap = n > 10 ? 2.2 : n > 7 ? 3.2 : 4.5;
  const cardW = Math.min(42, Math.max(16, (areaW - gap * Math.max(0, n - 1)) / n));
  const cardH = Math.min(areaH * 0.72, Math.max(28, areaH * 0.82));
  const totalW = n * cardW + Math.max(0, n - 1) * gap;
  const startX = marginX + Math.max(0, (areaW - totalW) / 2);
  const cardY = top + Math.max(0, (areaH - cardH) / 2);
  const spineY = cardY + cardH / 2;

  // horizontal spine behind cards
  if (n > 1) {
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(1.1);
    doc.line(startX + cardW / 2, spineY, startX + totalW - cardW / 2, spineY);
    doc.setLineWidth(0.3);
    doc.setDrawColor(...accent);
    doc.line(startX + cardW / 2, spineY - 1.2, startX + totalW - cardW / 2, spineY - 1.2);
    doc.line(startX + cardW / 2, spineY + 1.2, startX + totalW - cardW / 2, spineY + 1.2);
  }

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    const distanceFromFocus = n - 1 - i;
    const isSelf = distanceFromFocus === 0;
    const label = t.jetiAtaLabel(distanceFromFocus);
    const life = lifeDatesLine(person, cardW < 24);
    const x = startX + i * (cardW + gap);

    // diamond on spine
    drawDiamondKnot(doc, x + cardW / 2, spineY, Math.min(2.6, cardW * 0.08), ink, bg);

    doc.setFillColor(...(isSelf ? fillSelf : fill));
    doc.setDrawColor(...ink);
    doc.setLineWidth(isSelf ? 0.65 : 0.4);
    doc.roundedRect(x, cardY, cardW, cardH, 1.3, 1.3, "FD");
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.2);
    doc.roundedRect(x + 1.2, cardY + 1.2, cardW - 2.4, cardH - 2.4, 0.9, 0.9, "S");
    doc.setFillColor(...accent);
    doc.rect(x, cardY, cardW, 1.35, "F");

    setPdfFont(doc, "normal");
    doc.setFontSize(cardW < 20 ? 5.4 : 6.4);
    doc.setTextColor(...mute);
    doc.text(fitText(doc, label, cardW - 4, cardW < 20 ? 5.4 : 6.4), x + cardW / 2, cardY + 6.2, {
      align: "center",
    });

    const nameMaxW = cardW - 5;
    const hasMeta = Boolean(life);
    const prefer = cardW >= 32 ? 10 : cardW >= 24 ? 8.5 : cardW >= 18 ? 7.2 : 6.2;
    const { lines: nameLines, fontSize } = wrapName(
      doc,
      person.name || "—",
      nameMaxW,
      hasMeta ? (cardH > 40 ? 3 : 2) : cardH > 40 ? 4 : 3,
      prefer,
      5.5
    );

    setPdfFont(doc, "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(...ink);
    const lineH = fontSize * 0.42 + 0.25;
    const metaSize = Math.min(6.4, fontSize * 0.75);
    const metaH = hasMeta ? metaSize + 2 : 0;
    const blockH = nameLines.length * lineH + metaH;
    let ty = cardY + (cardH - blockH) / 2 + lineH * 0.85 + 1.5;

    for (const nl of nameLines) {
      doc.text(nl, x + cardW / 2, ty, { align: "center" });
      ty += lineH;
    }
    if (life) {
      setPdfFont(doc, "normal");
      doc.setFontSize(metaSize);
      doc.setTextColor(...mute);
      doc.text(fitText(doc, life, nameMaxW, metaSize), x + cardW / 2, ty + 1.4, {
        align: "center",
      });
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [130, 105, 75]);
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
