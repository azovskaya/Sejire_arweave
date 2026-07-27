import type { jsPDF } from "jspdf";
import type { Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { splitParents } from "../pedigree";
import { ancestorSlotLayout, slotCenterFraction, yearSpan } from "./lineage";
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
 * Wall-ready classic family poster: roots-down, binary pedigree slots
 * so father/mother sit above their child and connector lines do not cross.
 */
export async function downloadClassicTreePdf(opts: {
  snapshot: Snapshot;
  focusId: string;
  meta: TreeMeta;
  locale?: PdfLocale;
}) {
  const t = pdfT(opts.locale ?? "ru");
  const slots = ancestorSlotLayout(opts.snapshot, opts.focusId, 5);
  if (!slots.length) throw new Error(t.noPeople);

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
  const bottomY = pageH - 14;
  const usableW = pageW - marginX * 2;
  const boxH = bottomY - topY;

  const depth = Math.max(...slots.map((s) => s.generation)) + 1;
  const leafSlots = 2 ** Math.max(0, depth - 1);
  const cellW = usableW / leafSlots;
  let cardW = Math.min(42, Math.max(9, cellW - 0.9));
  let cardH = Math.min(cardW * 0.62, boxH / depth - 1.2);
  cardH = Math.max(9, Math.min(22, cardH));
  const rowPitch = depth > 1 ? (boxH - cardH) / (depth - 1) : 0;

  type Pos = { id: string; x: number; y: number; cx: number; generation: number; slot: number };
  const positions = new Map<string, Pos>();

  for (const s of slots) {
    const visualRow = depth - 1 - s.generation; // oldest on top
    const y = topY + visualRow * rowPitch;
    const frac = slotCenterFraction(s.generation, s.slot, depth);
    const cx = marginX + frac * usableW;
    const x = Math.min(pageW - marginX - cardW, Math.max(marginX, cx - cardW / 2));
    positions.set(s.person.id, {
      id: s.person.id,
      x,
      y,
      cx: x + cardW / 2,
      generation: s.generation,
      slot: s.slot,
    });
  }

  // Family bars: one horizontal per child, parents drop onto it — no crossed diagonals
  doc.setDrawColor(150, 130, 100);
  doc.setLineWidth(0.28);
  for (const s of slots) {
    if (s.generation + 1 >= depth) continue;
    const childPos = positions.get(s.person.id);
    if (!childPos) continue;

    const { fatherId, motherId } = splitParents(opts.snapshot, s.person.id);
    const parentCenters = [fatherId, motherId]
      .filter((id): id is string => Boolean(id))
      .map((id) => positions.get(id))
      .filter((p): p is Pos => Boolean(p));
    if (!parentCenters.length) continue;

    const parentBottom = Math.max(...parentCenters.map((p) => p.y + cardH));
    const midY = (parentBottom + childPos.y) / 2;
    const barLeft = Math.min(childPos.cx, ...parentCenters.map((p) => p.cx));
    const barRight = Math.max(childPos.cx, ...parentCenters.map((p) => p.cx));

    doc.line(childPos.cx, childPos.y, childPos.cx, midY);
    if (Math.abs(barRight - barLeft) > 0.4) {
      doc.line(barLeft, midY, barRight, midY);
    }
    for (const p of parentCenters) {
      doc.line(p.cx, midY, p.cx, p.y + cardH);
    }
  }

  for (const s of slots) {
    const pos = positions.get(s.person.id);
    if (!pos) continue;
    const accent: [number, number, number] =
      s.person.sex === "F"
        ? [150, 105, 115]
        : s.person.sex === "M"
          ? [85, 115, 140]
          : [150, 145, 135];
    drawPersonCard(doc, s.person, pos.x, pos.y, cardW, cardH, accent);
  }

  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, t.exportedWith, [155, 135, 105]);

  doc.save(`sejire-tree-${safeFilename(opts.meta.title || title, "tree")}.pdf`);
}
