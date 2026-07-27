import type { Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { maleLineUp, yearSpan } from "./lineage";
import { ensurePdfFont, setPdfFont } from "./font";
import { drawCornerOrnaments, drawPosterFrame, drawTitleRule, fitText, safeFilename } from "./poster";

async function loadJsPdf() {
  const mod = await import("jspdf");
  return mod.jsPDF;
}

/**
 * Wall-ready Шежіре poster: male line, parchment, no overlapping ornament/title.
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

  // Parchment field
  doc.setFillColor(245, 232, 205);
  doc.rect(0, 0, pageW, pageH, "F");
  // Soft top wash (does not fight the title)
  doc.setFillColor(238, 220, 180);
  doc.rect(0, 0, pageW, 18, "F");

  drawPosterFrame(doc, pageW, pageH, ink);
  drawCornerOrnaments(doc, pageW, pageH, soft);

  // Title block in clear space — ornaments stay in corners only
  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(24);
  doc.text(t.shezhireTitle, pageW / 2, 24, { align: "center" });
  drawTitleRule(doc, pageW, 29, soft);

  const clan = (opts.meta.clanName || "").trim();
  const hasTamga = Boolean(opts.meta.tamgaUrl);
  let contentTop = 36;

  // Clan / tamga only when data exists — no empty "—" / placeholder noise
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
      doc.text(fitText(doc, clan, pageW - 60, 11), 22, slotY + 13);
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
        // leave empty frame if image fails
      }
    }
    contentTop = slotY + slotH + 8;
  }

  // Vertical male line — compact, numbered, no "Поколение N" labels
  const boxH = 16;
  const boxW = pageW - 40;
  const boxX = 20;
  const available = pageH - contentTop - 16;
  const step = Math.min(22, available / Math.max(line.length, 1));
  let y = contentTop;

  for (let i = 0; i < line.length; i += 1) {
    const person = line[i];
    const genNumber = line.length - i;
    const boxY = y;

    doc.setFillColor(251, 243, 222);
    doc.setDrawColor(...soft);
    doc.setLineWidth(0.4);
    doc.roundedRect(boxX, boxY, boxW, boxH, 1.1, 1.1, "FD");

    // generation disc
    doc.setFillColor(...ink);
    doc.circle(boxX + 8, boxY + boxH / 2, 3.8, "F");
    setPdfFont(doc, "bold");
    doc.setTextColor(255, 250, 240);
    doc.setFontSize(9);
    doc.text(String(genNumber), boxX + 8, boxY + boxH / 2 + 1.05, { align: "center" });

    setPdfFont(doc, "bold");
    doc.setTextColor(50, 32, 14);
    doc.setFontSize(11);
    doc.text(fitText(doc, person.name || "—", boxW - 55, 11), boxX + 15, boxY + 6.8);

    const metaBits = [yearSpan(person), (person.birthPlace || "").trim()].filter(Boolean);
    if (metaBits.length) {
      setPdfFont(doc, "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(115, 85, 45);
      doc.text(fitText(doc, metaBits.join("  ·  "), boxW - 55, 7.2), boxX + 15, boxY + 12.2);
    }

    if (i < line.length - 1) {
      doc.setDrawColor(...soft);
      doc.setLineWidth(0.45);
      const cx = boxX + 8;
      doc.line(cx, boxY + boxH, cx, boxY + step);
    }

    y += step;
  }

  setPdfFont(doc, "normal");
  doc.setFontSize(6);
  doc.setTextColor(155, 125, 80);
  doc.text(t.exportedWith, pageW / 2, pageH - 5, { align: "center" });

  const safe = safeFilename(opts.meta.title || "shezhire", "shezhire");
  doc.save(`sejire-shezhire-${safe}.pdf`);
}
