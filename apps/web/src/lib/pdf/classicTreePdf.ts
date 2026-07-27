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
  doc.setDrawColor(120, 110, 95);
  doc.setFillColor(255, 253, 248);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
  doc.setFillColor(...accent);
  doc.rect(x, y, 1.5, h, "F");

  const padX = 3.4;
  const textW = w - padX * 2 - 1.2;
  const life = yearSpan(p);
  const place = (p.birthPlace || "").trim();
  const metaLines = [life, place].filter(Boolean).length;
  const nameMaxLines = metaLines >= 2 ? 2 : metaLines === 1 ? 3 : 4;

  setPdfFont(doc, "bold");
  doc.setTextColor(34, 35, 38);
  const { lines: nameLines, fontSize } = wrapName(doc, p.name || "—", textW, nameMaxLines, 8.4, 5.8);
  const lineH = fontSize * 0.42;
  let ty = y + 4.6;
  doc.setFontSize(fontSize);
  for (const line of nameLines) {
    doc.text(line, x + padX + 1, ty);
    ty += lineH + 0.6;
  }

  setPdfFont(doc, "normal");
  doc.setTextColor(95, 90, 82);
  ty += 0.8;
  if (life && ty < y + h - 2) {
    doc.setFontSize(6.4);
    doc.text(fitText(doc, life, textW, 6.4), x + padX + 1, ty);
    ty += 3.6;
  }
  if (place && ty < y + h - 2) {
    doc.setFontSize(6);
    doc.text(fitText(doc, place, textW, 6), x + padX + 1, ty);
  }
}

/**
 * Wall-ready classic family poster: quiet header, roots-down layout.
 * Names wrap fully — never clipped to «Азовский Владими…».
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

  const marginX = 12;
  const topY = 26;
  // Reserve bottom band for SEJIRE mark (no overlap with cards/frame)
  const bottomY = pageH - 16;
  const genCount = gens.length;
  const maxInRow = Math.max(...gens.map((g) => g.length), 1);
  const gap = maxInRow >= 6 ? 3.2 : 4.5;
  const usableW = pageW - marginX * 2;
  const cardW = Math.min(52, Math.max(34, (usableW - gap * (maxInRow - 1)) / maxInRow));
  const cardH = cardW >= 44 ? 26 : 24;
  const usableH = bottomY - topY - cardH;
  const rowGap = genCount > 1 ? usableH / (genCount - 1) : 0;

  type Pos = { id: string; x: number; y: number; cx: number };
  const positions = new Map<string, Pos>();

  for (let gi = 0; gi < genCount; gi += 1) {
    const people = gens[gi];
    const visualRow = genCount - 1 - gi;
    const y = topY + visualRow * rowGap;
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

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [155, 135, 105]);

  doc.save(`sejire-tree-${safeFilename(opts.meta.title || title, "tree")}.pdf`);
}
