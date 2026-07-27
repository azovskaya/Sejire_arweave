import type { jsPDF } from "jspdf";
import type { Person, Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { ancestorGenerations, yearSpan } from "./lineage";
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

function drawPersonCard(
  doc: jsPDF,
  p: Person,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number]
) {
  const scale = Math.min(1, w / 40);
  const radius = Math.max(0.4, 1.2 * scale);
  doc.setDrawColor(120, 110, 95);
  doc.setFillColor(255, 253, 248);
  doc.setLineWidth(Math.max(0.15, 0.3 * scale));
  doc.roundedRect(x, y, w, h, radius, radius, "FD");
  doc.setFillColor(...accent);
  doc.rect(x, y, Math.max(0.8, 1.5 * scale), h, "F");

  const padX = Math.max(1.2, 3.2 * scale);
  const textW = Math.max(6, w - padX * 2 - 1);
  const life = yearSpan(p);
  const place = (p.birthPlace || "").trim();
  const metaLines = [life, place].filter(Boolean).length;
  const nameMaxLines = w < 22 ? 2 : metaLines >= 2 ? 2 : metaLines === 1 ? 3 : 4;
  const maxName = Math.max(4.2, 8.2 * scale);
  const minName = Math.max(3.4, 5.2 * scale);

  setPdfFont(doc, "bold");
  doc.setTextColor(34, 35, 38);
  const { lines: nameLines, fontSize } = wrapName(doc, p.name || "—", textW, nameMaxLines, maxName, minName);
  const lineH = fontSize * 0.42;
  let ty = y + Math.max(2.8, 4.2 * scale);
  doc.setFontSize(fontSize);
  for (const line of nameLines) {
    doc.text(line, x + padX + 0.6, ty);
    ty += lineH + Math.max(0.25, 0.5 * scale);
  }

  setPdfFont(doc, "normal");
  doc.setTextColor(95, 90, 82);
  ty += Math.max(0.3, 0.6 * scale);
  const metaSize = Math.max(3.6, 6.2 * scale);
  if (life && ty < y + h - 1.5) {
    doc.setFontSize(metaSize);
    doc.text(fitText(doc, life, textW, metaSize), x + padX + 0.6, ty);
    ty += metaSize * 0.55 + 0.8;
  }
  if (place && ty < y + h - 1.5) {
    doc.setFontSize(Math.max(3.4, metaSize - 0.4));
    doc.text(fitText(doc, place, textW, Math.max(3.4, metaSize - 0.4)), x + padX + 0.6, ty);
  }
}

/**
 * Wall-ready classic family poster: quiet header, roots-down layout.
 * Card size shrinks to keep every generation inside the poster frame.
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

  const title = t.classicTitle;
  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  doc.setFontSize(14);
  doc.text(title, pageW / 2, 16.2, { align: "center" });
  drawTitleRule(doc, pageW, 20.2, [175, 140, 90]);

  // Stay inside double frame (~9.4mm) + brand clearance at bottom
  const marginX = 12;
  const topY = 26;
  const bottomY = pageH - 14;
  const genCount = gens.length;
  const maxInRow = Math.max(...gens.map((g) => g.length), 1);
  const usableW = pageW - marginX * 2;
  const boxH = bottomY - topY;

  // Shrink width to fit the widest generation — no fixed 34mm floor
  const gap = Math.min(3.5, Math.max(0.6, usableW / (maxInRow * 12)));
  let cardW = (usableW - gap * Math.max(0, maxInRow - 1)) / maxInRow;
  cardW = Math.min(46, Math.max(11, cardW));
  // Height scales with width and available vertical room (no overlap)
  let cardH = Math.min(cardW * 0.62, boxH / genCount - 1.2);
  cardH = Math.max(10, Math.min(24, cardH));

  const rowPitch = genCount > 1 ? (boxH - cardH) / (genCount - 1) : 0;

  type Pos = { id: string; x: number; y: number; cx: number };
  const positions = new Map<string, Pos>();

  for (let gi = 0; gi < genCount; gi += 1) {
    const people = gens[gi];
    const visualRow = genCount - 1 - gi;
    const y = topY + visualRow * rowPitch;
    const totalW = people.length * cardW + Math.max(0, people.length - 1) * gap;
    let x0 = marginX + Math.max(0, (usableW - totalW) / 2);
    // Clamp row inside frame if still slightly over (rounding)
    if (x0 + totalW > pageW - marginX) {
      x0 = Math.max(marginX, pageW - marginX - totalW);
    }
    for (const p of people) {
      positions.set(p.id, { id: p.id, x: x0, y, cx: x0 + cardW / 2 });
      x0 += cardW + gap;
    }
  }

  doc.setDrawColor(170, 150, 120);
  doc.setLineWidth(0.22);
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

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [155, 135, 105]);

  doc.save(`sejire-tree-${safeFilename(opts.meta.title || title, "tree")}.pdf`);
}
