import type { jsPDF } from "jspdf";
import type { Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { maleLineUp, yearSpan } from "./lineage";

async function loadJsPdf() {
  const mod = await import("jspdf");
  return mod.jsPDF;
}

function drawOrnamentBorder(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(140, 90, 40);
  doc.setLineWidth(1.1);
  doc.rect(x, y, w, h);
  doc.setLineWidth(0.35);
  doc.rect(x + 2.2, y + 2.2, w - 4.4, h - 4.4);

  // corner diamonds
  const corners = [
    [x + 6, y + 6],
    [x + w - 6, y + 6],
    [x + 6, y + h - 6],
    [x + w - 6, y + h - 6],
  ] as const;
  doc.setFillColor(180, 110, 45);
  for (const [cx, cy] of corners) {
    doc.triangle(cx, cy - 2.2, cx + 2.2, cy, cx, cy + 2.2, "F");
    doc.triangle(cx, cy - 2.2, cx - 2.2, cy, cx, cy + 2.2, "F");
  }

  // top ornamental band
  const bandY = y + 8;
  doc.setDrawColor(160, 100, 45);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 18; i += 1) {
    const bx = x + 14 + i * ((w - 28) / 17);
    doc.line(bx, bandY, bx + 3, bandY + 3);
    doc.line(bx + 3, bandY + 3, bx + 6, bandY);
  }
}

/**
 * Шежіре PDF: male line only, parchment + ornament, generation numbers.
 * Header reserved for optional clan name / tamga (meta.clanName, meta.tamgaUrl).
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

  // Keep up to maxGen; display oldest → youngest
  const line = youngFirst.slice(0, maxGen).reverse();
  if (!line.length) throw new Error(t.noMaleLine);

  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // warm parchment
  doc.setFillColor(243, 230, 200);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(236, 214, 170);
  doc.rect(0, 0, pageW, 28, "F");

  drawOrnamentBorder(doc, 8, 8, pageW - 16, pageH - 16);

  // Header
  doc.setTextColor(90, 50, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(t.shezhireTitle, pageW / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 75, 35);
  doc.text(t.shezhireSubtitle, pageW / 2, 28, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(70, 45, 20);
  doc.text(opts.meta.title, pageW / 2, 35, { align: "center" });

  // Clan / tamga slot (technical placeholder if empty)
  const slotY = 40;
  const slotH = 22;
  doc.setDrawColor(160, 110, 55);
  doc.setLineWidth(0.4);
  doc.setFillColor(250, 240, 215);
  doc.roundedRect(18, slotY, pageW - 36, slotH, 1.5, 1.5, "FD");

  const clan = (opts.meta.clanName || "").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(130, 90, 40);
  doc.text(t.clanLabel, 22, slotY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 40, 15);
  doc.text(clan || "—", 22, slotY + 13);

  // Tamga box on the right of the slot
  const tamgaSize = 16;
  const tamgaX = pageW - 18 - tamgaSize - 4;
  const tamgaY = slotY + (slotH - tamgaSize) / 2;
  doc.setDrawColor(150, 100, 50);
  doc.setFillColor(248, 236, 205);
  doc.roundedRect(tamgaX, tamgaY, tamgaSize, tamgaSize, 1, 1, "FD");
  doc.setFontSize(6.5);
  doc.setTextColor(150, 115, 70);
  if (opts.meta.tamgaUrl) {
    try {
      doc.addImage(opts.meta.tamgaUrl, "PNG", tamgaX + 1, tamgaY + 1, tamgaSize - 2, tamgaSize - 2);
    } catch {
      doc.text(t.tamgaPlaceholder, tamgaX + tamgaSize / 2, tamgaY + tamgaSize / 2 + 1, {
        align: "center",
      });
    }
  } else {
    doc.text(t.tamgaPlaceholder, tamgaX + tamgaSize / 2, tamgaY + tamgaSize / 2 + 1, {
      align: "center",
    });
  }

  // Male line: generation numbers from youngest=1 at bottom of numbering scheme
  // Display oldest at top: generation number = distance from start + 1 when reversed
  // youngFirst[0] is gen 1; after reverse, last item is gen 1
  let y = slotY + slotH + 12;
  const boxH = 18;
  const boxW = pageW - 40;
  const boxX = 20;
  const step = Math.min(26, (pageH - y - 20) / Math.max(line.length, 1));

  for (let i = 0; i < line.length; i += 1) {
    const person = line[i];
    // generation: 1 = start person (youngest in export), higher = older ancestors
    const genNumber = line.length - i;
    const boxY = y;

    doc.setFillColor(250, 242, 220);
    doc.setDrawColor(150, 105, 55);
    doc.setLineWidth(0.45);
    doc.roundedRect(boxX, boxY, boxW, boxH, 1.2, 1.2, "FD");

    // gen badge
    doc.setFillColor(180, 110, 45);
    doc.circle(boxX + 8, boxY + boxH / 2, 4.2, "F");
    doc.setTextColor(255, 252, 245);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(String(genNumber), boxX + 8, boxY + boxH / 2 + 1.1, { align: "center" });

    doc.setTextColor(55, 35, 15);
    doc.setFontSize(11);
    doc.text(person.name || "Без имени", boxX + 16, boxY + 7.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 80, 40);
    doc.text(t.generation(genNumber), boxX + 16, boxY + 13);

    const metaBits = [yearSpan(person), (person.birthPlace || "").trim()].filter(Boolean);
    if (metaBits.length) {
      doc.setFontSize(7.5);
      doc.text(metaBits.join(" · "), boxX + boxW - 4, boxY + 10.5, { align: "right" });
    }

    // connector to next (younger, below)
    if (i < line.length - 1) {
      doc.setDrawColor(160, 110, 55);
      doc.setLineWidth(0.5);
      const cx = boxX + 8;
      doc.line(cx, boxY + boxH, cx, boxY + step);
    }

    y += step;
  }

  doc.setFontSize(7);
  doc.setTextColor(130, 100, 60);
  doc.text(`${t.exportedWith} · ${new Date().toLocaleDateString("ru-RU")}`, pageW / 2, pageH - 11, {
    align: "center",
  });

  const safe = (opts.meta.title || "shezhire").replace(/[^\w\-а-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ ]+/g, "").trim() || "shezhire";
  doc.save(`sejire-shezhire-${safe}.pdf`);
}
