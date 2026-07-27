import type { jsPDF } from "jspdf";
import type { Person, Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { ancestorGenerations, yearSpan } from "./lineage";
import { ensurePdfFont, setPdfFont } from "./font";
import { drawCornerOrnaments, drawPosterFrame, drawTitleRule, fitText, safeFilename } from "./poster";

async function loadJsPdf() {
  const mod = await import("jspdf");
  return mod.jsPDF;
}

function drawPersonCard(
  doc: jsPDF,
  p: Person,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number]
) {
  doc.setDrawColor(120, 110, 95);
  doc.setFillColor(255, 253, 248);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
  doc.setFillColor(...accent);
  doc.rect(x, y, 1.5, h, "F");

  const pad = 3.2;
  doc.setTextColor(34, 35, 38);
  setPdfFont(doc, "bold");
  const name = fitText(doc, p.name || "—", w - pad * 2 - 1, 8.2);
  doc.text(name, x + pad + 1, y + 6.2);

  setPdfFont(doc, "normal");
  doc.setTextColor(95, 90, 82);
  const life = yearSpan(p);
  const place = (p.birthPlace || "").trim();
  let metaY = y + 11.2;
  if (life) {
    doc.setFontSize(6.8);
    doc.text(fitText(doc, life, w - pad * 2 - 1, 6.8), x + pad + 1, metaY);
    metaY += 4;
  }
  if (place && metaY < y + h - 2) {
    doc.setFontSize(6.4);
    doc.text(fitText(doc, place, w - pad * 2 - 1, 6.4), x + pad + 1, metaY);
  }
}

/**
 * Wall-ready classic family poster: quiet header, roots-down layout.
 */
export async function downloadClassicTreePdf(opts: {
  snapshot: Snapshot;
  focusId: string;
  meta: TreeMeta;
  locale?: PdfLocale;
}) {
  const t = pdfT(opts.locale ?? "ru");
  const gens = ancestorGenerations(opts.snapshot, opts.focusId, 5);
  if (!gens.length) throw new Error(t.noPeople);

  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await ensurePdfFont(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ink: [number, number, number] = [95, 70, 40];

  doc.setFillColor(250, 246, 238);
  doc.rect(0, 0, pageW, pageH, "F");
  drawPosterFrame(doc, pageW, pageH, ink);
  drawCornerOrnaments(doc, pageW, pageH, [170, 120, 60]);

  // Quiet centered title only — no layout instructions, no "От:"
  const title = (opts.meta.title || t.classicTitle).trim() || t.classicTitle;
  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(15);
  doc.text(title, pageW / 2, 16.5, { align: "center" });
  drawTitleRule(doc, pageW, 20.5, [175, 140, 90]);

  const marginX = 14;
  const cardW = 40;
  const cardH = 18;
  const topY = 27;
  const bottomY = pageH - 12;
  const usableH = bottomY - topY - cardH;
  const genCount = gens.length;
  const rowGap = genCount > 1 ? usableH / (genCount - 1) : 0;

  type Pos = { id: string; x: number; y: number; cx: number };
  const positions = new Map<string, Pos>();

  for (let gi = 0; gi < genCount; gi += 1) {
    const people = gens[gi];
    const visualRow = genCount - 1 - gi;
    const y = topY + visualRow * rowGap;
    const gap = 5;
    const totalW = people.length * cardW + Math.max(0, people.length - 1) * gap;
    let x0 = Math.max(marginX, (pageW - totalW) / 2);
    for (const p of people) {
      positions.set(p.id, { id: p.id, x: x0, y, cx: x0 + cardW / 2 });
      x0 += cardW + gap;
    }
  }

  doc.setDrawColor(170, 150, 120);
  doc.setLineWidth(0.28);
  for (let gi = 0; gi < genCount - 1; gi += 1) {
    for (const child of gens[gi]) {
      const childPos = positions.get(child.id);
      if (!childPos) continue;
      const parents = child.parents
        .map((id) => opts.snapshot.persons[id])
        .filter((p): p is Person => Boolean(p) && !p.tombstone);
      for (const parent of parents) {
        const parentPos = positions.get(parent.id);
        if (!parentPos) continue;
        const x1 = childPos.cx;
        const y1 = childPos.y;
        const x2 = parentPos.cx;
        const y2 = parentPos.y + cardH;
        const mid = (y1 + y2) / 2;
        doc.line(x1, y1, x1, mid);
        doc.line(x1, mid, x2, mid);
        doc.line(x2, mid, x2, y2);
      }
    }
  }

  for (const people of gens) {
    for (const p of people) {
      const pos = positions.get(p.id);
      if (!pos) continue;
      const accent: [number, number, number] =
        p.sex === "F" ? [150, 105, 115] : p.sex === "M" ? [85, 115, 140] : [150, 145, 135];
      drawPersonCard(doc, p, pos.x, pos.y, cardW, cardH, accent);
    }
  }

  setPdfFont(doc, "normal");
  doc.setFontSize(6);
  doc.setTextColor(160, 145, 120);
  doc.text(t.exportedWith, pageW - 12, pageH - 4.5, { align: "right" });

  doc.save(`sejire-tree-${safeFilename(title, "tree")}.pdf`);
}
