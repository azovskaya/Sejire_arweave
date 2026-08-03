import { jsPDF } from "jspdf";
import type { Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { maleLineUp, lifeDatesLine } from "./lineage";
import { ensurePdfFont, setPdfFont } from "./font";
import { drawBrandMark, fitText, safeFilename, wrapName } from "./poster";
import {
  drawDiamondKnot,
  drawHornPair,
  drawLabelPlaque,
  drawNameCartouche,
  drawOrnamentBorder,
  drawTitleOrnament,
  type Rgb,
} from "./ornaments";

/**
 * Wall poster «Жеті ата»: vertical male line in Kazakh ornamental cartouches.
 */
export async function downloadShezhirePdf(opts: {
  snapshot: Snapshot;
  startId: string;
  meta: TreeMeta;
  locale?: PdfLocale;
  maxGenerations?: number;
}) {
  const t = pdfT(opts.locale ?? "ru");
  const maxGen = Math.min(opts.maxGenerations ?? 7, 7);
  const youngFirst = maleLineUp(opts.snapshot, opts.startId);
  if (!youngFirst.length) throw new Error(t.noPeople);

  const ascending = youngFirst.slice(0, maxGen);
  const line = [...ascending].reverse(); // oldest at top
  if (!line.length) throw new Error(t.noMaleLine);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await ensurePdfFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Deep parchment + ink (manuscript shezhire, not flat UI)
  const parchment: Rgb = [242, 228, 198];
  const parchmentDeep: Rgb = [232, 212, 172];
  const ink: Rgb = [72, 38, 18];
  const gold: Rgb = [148, 98, 42];
  const goldSoft: Rgb = [176, 132, 68];
  const plaque: Rgb = [252, 243, 220];
  const mute: Rgb = [110, 78, 42];

  doc.setFillColor(...parchment);
  doc.rect(0, 0, pageW, pageH, "F");
  // soft side panels
  doc.setFillColor(...parchmentDeep);
  doc.rect(0, 0, 14, pageH, "F");
  doc.rect(pageW - 14, 0, 14, pageH, "F");

  drawOrnamentBorder(doc, pageW, pageH, 8, ink);

  // Title
  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(24);
  doc.text(t.shezhireTitle, pageW / 2, 22, { align: "center" });
  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 27.8, { align: "center" });
  drawTitleOrnament(doc, pageW / 2, 31.5, pageW / 2 - 28, gold);

  const clan = (opts.meta.clanName || "").trim();
  let contentTop = 38;

  if (clan) {
    setPdfFont(doc, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...mute);
    doc.text(t.clanLabel, pageW / 2, contentTop, { align: "center" });
    setPdfFont(doc, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    const { lines } = wrapName(doc, clan, pageW - 56, 2, 11, 8);
    doc.text(lines[0], pageW / 2, contentTop + 5.2, { align: "center" });
    drawHornPair(doc, pageW / 2, contentTop + 8.5, 5.5, goldSoft, 0.28);
    contentTop += 14;
  }

  const n = line.length;
  const bottomY = pageH - 16;
  const topY = contentTop + 2;
  const available = Math.max(40, bottomY - topY);
  // cartouche height scales with count so all 7 fit
  const gap = n > 1 ? Math.min(4.5, available * 0.02) : 0;
  const cartoucheH = Math.min(22, (available - gap * Math.max(0, n - 1)) / n);
  const block = cartoucheH + gap;
  const stackH = n * cartoucheH + Math.max(0, n - 1) * gap;
  const stackTop = topY + Math.max(0, (available - stackH) / 2);

  const spineX = 48;
  const cartoucheX = 58;
  const cartoucheW = pageW - cartoucheX - 18;
  const namePadX = 5.5;
  const nameMaxW = cartoucheW - namePadX * 2;

  // Vertical ornamental spine
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

    // connector to cartouche
    doc.setDrawColor(...goldSoft);
    doc.setLineWidth(0.35);
    doc.line(spineX + 3.2, cy, cartoucheX - 4.6, cy);

    drawLabelPlaque(doc, spineX - 5, cy, label, ink, plaque, (bold) => setPdfFont(doc, bold ? "bold" : "normal"));

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

  const safe = safeFilename(opts.meta.title || "jeti-ata", "jeti-ata");
  doc.save(`sejire-jeti-ata-${safe}.pdf`);
}
