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
 * Wall-ready Шежіре poster: male line, parchment, full names wrapped.
 */
export async function downloadShezhirePdf(opts: {
  snapshot: Snapshot;
  startId: string;
  meta: TreeMeta;
  locale?: PdfLocale;
  maxGenerations?: number;
}) {
  const t = pdfT(opts.locale ?? "ru");
  const maxGen = opts.maxGenerations ?? 7;
  const youngFirst = maleLineUp(opts.snapshot, opts.startId);
  if (!youngFirst.length) throw new Error(t.noPeople);

  const line = youngFirst.slice(0, maxGen).reverse();
  if (!line.length) throw new Error(t.noMaleLine);

  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await ensurePdfFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ink: [number, number, number] = [110, 65, 28];
  const soft: [number, number, number] = [175, 125, 60];

  doc.setFillColor(245, 232, 205);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(238, 220, 180);
  doc.rect(0, 0, pageW, 18, "F");

  drawPosterFrame(doc, pageW, pageH, ink);
  drawCornerOrnaments(doc, pageW, pageH, soft);

  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(24);
  doc.text(t.shezhireTitle, pageW / 2, 24, { align: "center" });
  drawTitleRule(doc, pageW, 29, soft);

  const clan = (opts.meta.clanName || "").trim();
  const hasTamga = Boolean(opts.meta.tamgaUrl);
  let contentTop = 36;

  if (clan || hasTamga) {
    const slotY = 34;
    const slotH = 18;
    doc.setDrawColor(...soft);
    doc.setLineWidth(0.35);
    doc.setFillColor(250, 240, 215);
    doc.roundedRect(18, slotY, pageW - 36, slotH, 1.2, 1.2, "FD");

    if (clan) {
      setPdfFont(doc, "bold");
      doc.setFontSize(8);
      doc.setTextColor(130, 90, 40);
      doc.text(t.clanLabel, 22, slotY + 6);
      setPdfFont(doc, "normal");
      doc.setFontSize(11);
      doc.setTextColor(60, 40, 15);
      const { lines } = wrapName(doc, clan, pageW - 60, 2, 11, 8);
      doc.text(lines[0], 22, slotY + 13);
    }

    if (hasTamga) {
      const tamgaSize = 13;
      const tamgaX = pageW - 18 - tamgaSize - 3;
      const tamgaY = slotY + (slotH - tamgaSize) / 2;
      doc.setDrawColor(...soft);
      doc.setFillColor(248, 236, 205);
      doc.roundedRect(tamgaX, tamgaY, tamgaSize, tamgaSize, 1, 1, "FD");
      try {
        doc.addImage(opts.meta.tamgaUrl!, "PNG", tamgaX + 0.8, tamgaY + 0.8, tamgaSize - 1.6, tamgaSize - 1.6);
      } catch {
        // empty frame
      }
    }
    contentTop = slotY + slotH + 8;
  }

  const boxW = pageW - 40;
  const boxX = 20;
  const nameAreaW = boxW - 22;
  // Content stays inside the frame; SEJIRE sits outside at bottom-right
  const available = pageH - contentTop - 14;

  // Pre-measure row heights so long FIO get more vertical room
  const rowHeights = line.map((person) => {
    setPdfFont(doc, "bold");
    const { lines } = wrapName(doc, person.name || "—", nameAreaW, 3, 11, 7.5);
    const hasMeta = Boolean(yearSpan(person) || (person.birthPlace || "").trim());
    return Math.max(16, 6 + lines.length * 5 + (hasMeta ? 5 : 2));
  });
  const totalH = rowHeights.reduce((a, b) => a + b, 0);
  const gaps = Math.max(0, line.length - 1);
  const scale = totalH + gaps * 4 > available ? available / (totalH + gaps * 4) : 1;

  let y = contentTop;
  for (let i = 0; i < line.length; i += 1) {
    const person = line[i];
    const genNumber = line.length - i;
    const boxH = rowHeights[i] * scale;
    const boxY = y;

    doc.setFillColor(251, 243, 222);
    doc.setDrawColor(...soft);
    doc.setLineWidth(0.4);
    doc.roundedRect(boxX, boxY, boxW, boxH, 1.1, 1.1, "FD");

    doc.setFillColor(...ink);
    doc.circle(boxX + 8, boxY + Math.min(boxH / 2, 8), 3.8, "F");
    setPdfFont(doc, "bold");
    doc.setTextColor(255, 250, 240);
    doc.setFontSize(9);
    doc.text(String(genNumber), boxX + 8, boxY + Math.min(boxH / 2, 8) + 1.05, { align: "center" });

    setPdfFont(doc, "bold");
    doc.setTextColor(50, 32, 14);
    const { lines: nameLines, fontSize } = wrapName(doc, person.name || "—", nameAreaW, 3, 11, 7.5);
    doc.setFontSize(fontSize);
    let ty = boxY + 5.5;
    const lineH = fontSize * 0.42 + 0.55;
    for (const nl of nameLines) {
      doc.text(nl, boxX + 15, ty);
      ty += lineH;
    }

    const metaBits = [yearSpan(person), (person.birthPlace || "").trim()].filter(Boolean);
    if (metaBits.length) {
      setPdfFont(doc, "normal");
      doc.setFontSize(7);
      doc.setTextColor(115, 85, 45);
      doc.text(fitText(doc, metaBits.join("  ·  "), nameAreaW, 7), boxX + 15, Math.min(ty + 1.2, boxY + boxH - 2.5));
    }

    if (i < line.length - 1) {
      const connectorGap = 4 * scale;
      doc.setDrawColor(...soft);
      doc.setLineWidth(0.45);
      const cx = boxX + 8;
      doc.line(cx, boxY + boxH, cx, boxY + boxH + connectorGap);
      y += boxH + connectorGap;
    } else {
      y += boxH;
    }
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [150, 115, 70]);

  const safe = safeFilename(opts.meta.title || "shezhire", "shezhire");
  doc.save(`sejire-shezhire-${safe}.pdf`);
}
