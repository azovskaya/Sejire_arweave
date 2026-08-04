import { jsPDF } from "jspdf";
import type { Person, Snapshot, TreeMeta } from "../types";
import { pdfT, SHEZHIRE_MAX_GENERATIONS, type PdfLocale } from "../i18n/pdf";
import { maleLineUp, lifeDatesLine } from "./lineage";
import { ensurePdfFont, setPdfFont } from "./font";
import { drawBrandMark, fitText, safeFilename, wrapName } from "./poster";
import { formatShezhireAffiliation, zhuzFullLabel } from "../zhuzRu";
import {
  drawDiamondKnot,
  drawGenerationRowFrame,
  drawHornPair,
  drawKoshkarMuyiz,
  drawLabelPlaque,
  drawNameCartouche,
  drawOrnamentBorder,
  drawShezhireManuscriptBorder,
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
    blurb: "Древний шежіре-список: қосқар мүйіз, рукописная рамка",
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
 * Тізім — classical shezhire manuscript list in ancient Kazakh ornament.
 * Triple frame, қосқар мүйіз corners, ornamental generation plaques, lineage spine.
 */
function renderRegistry(ctx: RenderCtx) {
  const { doc, pageW, pageH, line, meta, locale } = ctx;
  const t = pdfT(locale);
  const parchment: Rgb = [236, 222, 196];
  const parchmentDeep: Rgb = [224, 206, 172];
  const plaque: Rgb = [250, 240, 218];
  const plaqueSelf: Rgb = [246, 228, 190];
  const ink: Rgb = [58, 32, 14];
  const mute: Rgb = [108, 78, 44];
  const gold: Rgb = [138, 92, 38];
  const goldSoft: Rgb = [168, 124, 62];

  // Deep parchment field
  doc.setFillColor(...parchmentDeep);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...parchment);
  doc.roundedRect(5, 5, pageW - 10, pageH - 10, 1.5, 1.5, "F");

  // Full traditional manuscript border
  drawShezhireManuscriptBorder(doc, pageW, pageH, 7, ink, gold);

  // Title with detailed қосқар мүйіз
  drawKoshkarMuyiz(doc, pageW / 2, 18, 10, ink, 0.34);
  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(line.length > 10 ? 18 : 22);
  doc.text(t.shezhireTitle, pageW / 2, 32, { align: "center" });

  // Double ornamental underline
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.55);
  doc.line(pageW / 2 - 38, 35.5, pageW / 2 + 38, 35.5);
  doc.setDrawColor(...goldSoft);
  doc.setLineWidth(0.22);
  doc.line(pageW / 2 - 28, 37, pageW / 2 + 28, 37);
  drawDiamondKnot(doc, pageW / 2, 36.2, 2, ink, parchment);
  drawHornPair(doc, pageW / 2 - 42, 36, 5, gold, 0.28);
  drawHornPair(doc, pageW / 2 + 42, 36, 5, gold, 0.28);

  let y = drawAffiliationBlock(doc, pageW, 42, meta, locale, ink, mute, pageW - 48);
  y += 5;

  const n = line.length;
  const bottom = pageH - 16;
  const listTop = y;
  const listH = Math.max(40, bottom - listTop);
  const gap = n > 10 ? 1.1 : n > 7 ? 1.6 : 2.2;
  const rowH = Math.min(16, Math.max(7.2, (listH - gap * Math.max(0, n - 1)) / Math.max(1, n)));
  const block = rowH + gap;
  const stackH = n * rowH + Math.max(0, n - 1) * gap;
  const stackTop = listTop + Math.max(0, (listH - stackH) / 2);

  const spineX = 28;
  const plaqueX = 38;
  const plaqueW = pageW - plaqueX - 22;

  // Vertical genealogical axis (double hand-ruled line)
  if (n > 1) {
    const y0 = stackTop + rowH / 2;
    const y1 = stackTop + (n - 1) * block + rowH / 2;
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.7);
    doc.line(spineX, y0, spineX, y1);
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.2);
    doc.line(spineX - 1.1, y0, spineX - 1.1, y1);
    doc.line(spineX + 1.1, y0, spineX + 1.1, y1);
  }

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    const distanceFromFocus = n - 1 - i;
    const isSelf = distanceFromFocus === 0;
    const label = t.jetiAtaLabel(distanceFromFocus);
    const life = lifeDatesLine(person, rowH < 11);
    const ry = stackTop + i * block;
    const cy = ry + rowH / 2;

    drawDiamondKnot(doc, spineX, cy, isSelf ? 2.4 : 1.7, ink, parchment);
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.3);
    doc.line(spineX + 2.8, cy, plaqueX - 3.5, cy);

    drawGenerationRowFrame(
      doc,
      plaqueX,
      ry,
      plaqueW,
      rowH,
      ink,
      isSelf ? plaqueSelf : plaque,
      gold,
      isSelf
    );

    const labelW = Math.min(34, plaqueW * 0.28);
    const nameX = plaqueX + labelW + 6;
    const dateReserve = life && rowH >= 10 ? 28 : 8;
    const nameMaxW = plaqueW - labelW - dateReserve - 10;
    const fontName = rowH >= 13 ? 11 : rowH >= 10 ? 9.2 : 7.4;
    const fontMeta = Math.max(5.8, fontName * 0.68);

    // Generation label (left column inside plaque)
    setPdfFont(doc, "normal");
    doc.setFontSize(fontMeta);
    doc.setTextColor(...mute);
    doc.text(fitText(doc, label, labelW - 4, fontMeta), plaqueX + 5, cy + fontMeta * 0.28);

    // Vertical separator
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.18);
    doc.line(plaqueX + labelW, ry + 2, plaqueX + labelW, ry + rowH - 2);

    // Name
    setPdfFont(doc, "bold");
    doc.setFontSize(fontName);
    doc.setTextColor(...ink);
    const { lines: nameLines, fontSize } = wrapName(
      doc,
      person.name || "—",
      nameMaxW,
      rowH >= 13 && !life ? 2 : 1,
      fontName,
      5.6
    );
    const lineH = fontSize * 0.42 + 0.2;
    const nameBlockH = nameLines.length * lineH + (life && rowH >= 11 ? fontMeta + 0.8 : 0);
    let ty = cy - nameBlockH / 2 + lineH * 0.75;
    for (const nl of nameLines) {
      doc.text(nl, nameX, ty);
      ty += lineH;
    }

    if (life && rowH >= 10) {
      setPdfFont(doc, "normal");
      doc.setFontSize(fontMeta);
      doc.setTextColor(...mute);
      if (rowH >= 12 && nameLines.length === 1) {
        doc.text(fitText(doc, life, nameMaxW, fontMeta), nameX, ty + 0.6);
      } else {
        doc.text(fitText(doc, life, 26, fontMeta), plaqueX + plaqueW - 5, cy + fontMeta * 0.28, {
          align: "right",
        });
      }
    }

    // Tiny trailing horn on self row
    if (isSelf) {
      drawHornPair(doc, plaqueX + plaqueW - 6, cy - 0.5, Math.min(4, rowH * 0.4), gold, 0.25);
    }
  }

  // Footer seal with side horns
  const fy = pageH - 11;
  doc.setDrawColor(...goldSoft);
  doc.setLineWidth(0.25);
  doc.line(pageW / 2 - 36, fy - 4.5, pageW / 2 + 36, fy - 4.5);
  drawDiamondKnot(doc, pageW / 2, fy - 4.5, 1.6, ink, parchment);
  drawHornPair(doc, pageW / 2 - 44, fy - 5.5, 4.2, gold, 0.25);
  drawHornPair(doc, pageW / 2 + 44, fy - 5.5, 4.2, gold, 0.25);

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [130, 95, 55]);
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
