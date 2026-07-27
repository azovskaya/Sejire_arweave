import type { Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { maleLineUp, yearSpan } from "./lineage";
import { ensurePdfFont, setPdfFont } from "./font";
import {
  drawBrandMark,
  drawCornerOrnaments,
  drawPosterFrame,
  drawTitleRule,
  fitText,
  safeFilename,
  wrapName,
} from "./poster";

async function loadJsPdf() {
  const mod = await import("jspdf");
  return mod.jsPDF;
}

/**
 * Wall-ready Жеті ата poster: strict vertical male line (up to 7),
 * one spine, generation labels, no cards.
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

  // Youngest → oldest, capped at 7; display oldest at top.
  const ascending = youngFirst.slice(0, maxGen);
  const line = [...ascending].reverse();
  if (!line.length) throw new Error(t.noMaleLine);

  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await ensurePdfFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ink: [number, number, number] = [95, 55, 22];
  const soft: [number, number, number] = [170, 120, 55];
  const mute: [number, number, number] = [130, 95, 55];

  doc.setFillColor(246, 234, 208);
  doc.rect(0, 0, pageW, pageH, "F");

  drawPosterFrame(doc, pageW, pageH, ink);
  drawCornerOrnaments(doc, pageW, pageH, soft);

  // Title band — brand-first Жеті ата
  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(26);
  doc.text(t.shezhireTitle, pageW / 2, 22, { align: "center" });
  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mute);
  doc.text(t.shezhireSubtitle, pageW / 2, 28.2, { align: "center" });
  drawTitleRule(doc, pageW, 31.5, soft);

  const clan = (opts.meta.clanName || "").trim();
  const hasTamga = Boolean(opts.meta.tamgaUrl);
  let contentTop = 38;

  if (clan || hasTamga) {
    const midY = 38;
    if (hasTamga) {
      const tamgaSize = 12;
      const tamgaX = pageW / 2 - tamgaSize / 2;
      doc.setDrawColor(...soft);
      doc.setFillColor(250, 240, 215);
      doc.setLineWidth(0.35);
      doc.roundedRect(tamgaX, midY, tamgaSize, tamgaSize, 1, 1, "FD");
      try {
        doc.addImage(
          opts.meta.tamgaUrl!,
          "PNG",
          tamgaX + 0.7,
          midY + 0.7,
          tamgaSize - 1.4,
          tamgaSize - 1.4
        );
      } catch {
        // empty frame
      }
      contentTop = midY + tamgaSize + 4;
    }
    if (clan) {
      setPdfFont(doc, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...mute);
      doc.text(t.clanLabel, pageW / 2, contentTop, { align: "center" });
      setPdfFont(doc, "normal");
      doc.setFontSize(11);
      doc.setTextColor(55, 35, 12);
      const { lines } = wrapName(doc, clan, pageW - 48, 2, 11, 8);
      doc.text(lines[0], pageW / 2, contentTop + 5.5, { align: "center" });
      contentTop += 12;
    } else if (hasTamga) {
      contentTop += 2;
    }
  }

  // Layout: left labels | spine | names — strict vertical, equal steps
  const n = line.length;
  const bottomY = pageH - 14;
  const topY = contentTop + 4;
  const span = Math.max(1, bottomY - topY);
  const step = n > 1 ? span / (n - 1) : 0;

  const spineX = 52;
  const labelRight = spineX - 7;
  const nameX = spineX + 10;
  const nameMaxW = pageW - nameX - 16;

  // Continuous spine behind nodes
  if (n > 1) {
    doc.setDrawColor(...soft);
    doc.setLineWidth(0.7);
    doc.line(spineX, topY, spineX, bottomY);
  }

  for (let i = 0; i < n; i += 1) {
    const person = line[i];
    // distance from focus (youngest): oldest has highest index in ascending
    const distanceFromFocus = n - 1 - i;
    const cy = n === 1 ? (topY + bottomY) / 2 : topY + i * step;
    const label = t.jetiAtaLabel(distanceFromFocus);

    // Node on spine
    doc.setFillColor(246, 234, 208);
    doc.setDrawColor(...ink);
    doc.setLineWidth(0.85);
    doc.circle(spineX, cy, 2.6, "FD");
    doc.setFillColor(...ink);
    doc.circle(spineX, cy, 1.15, "F");

    // Generation label (left of spine)
    setPdfFont(doc, "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...mute);
    doc.text(label, labelRight, cy + 0.9, { align: "right" });

    // Full name (right of spine) — wrap, never ellipsis on FIO
    setPdfFont(doc, "bold");
    doc.setTextColor(40, 28, 12);
    const meta = yearSpan(person);
    const place = (person.birthPlace || "").trim();
    const hasMeta = Boolean(meta || place);
    const nameMaxLines = hasMeta ? 2 : 3;
    const { lines: nameLines, fontSize } = wrapName(
      doc,
      person.name || "—",
      nameMaxW,
      nameMaxLines,
      12,
      7.5
    );
    doc.setFontSize(fontSize);
    const lineH = fontSize * 0.42 + 0.45;
    const blockH = nameLines.length * lineH + (hasMeta ? 3.6 : 0);
    let ty = cy - blockH / 2 + lineH * 0.75;
    for (const nl of nameLines) {
      doc.text(nl, nameX, ty);
      ty += lineH;
    }

    if (hasMeta) {
      setPdfFont(doc, "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...mute);
      const bits = [meta, place].filter(Boolean).join("  ·  ");
      doc.text(fitText(doc, bits, nameMaxW, 6.8), nameX, ty + 1.2);
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [150, 115, 70]);

  const safe = safeFilename(opts.meta.title || "jeti-ata", "jeti-ata");
  doc.save(`sejire-jeti-ata-${safe}.pdf`);
}
