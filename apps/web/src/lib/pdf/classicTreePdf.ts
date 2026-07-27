import type { jsPDF } from "jspdf";
import type { Person, Snapshot, TreeMeta } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { splitParents } from "../pedigree";
import { ancestorSlotLayout, lifeDatesLine, slotCenterFraction } from "./lineage";
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

  const padX = Math.max(1.1, 2.8 * scale);
  const padY = Math.max(2.2, 3.4 * scale);
  const textW = Math.max(6, w - padX * 2 - 1);
  const compact = w < 28;
  const life = lifeDatesLine(p, compact);
  const place = (p.birthPlace || "").trim();

  // Reserve bottom band for dates first — never drop birth/death if known
  const metaSize = Math.max(3.8, Math.min(6.4, 6.4 * scale));
  const lifeBand = life ? metaSize * 0.85 + 1.4 : 0;
  const placeBand = place && h - padY * 2 - lifeBand > 8 ? metaSize * 0.75 + 0.8 : 0;
  const nameBottom = y + h - padY - lifeBand - placeBand;
  const nameTop = y + padY;
  const nameBoxH = Math.max(4, nameBottom - nameTop);

  const maxName = Math.max(4.0, Math.min(8.0, 8.0 * scale));
  const minName = Math.max(3.2, Math.min(5.0, 5.0 * scale));
  // Prefer full FIO: allow more name lines when no dates, else keep room for dates
  const nameMaxLines = life ? (compact ? 2 : 3) : compact ? 3 : 4;

  setPdfFont(doc, "bold");
  doc.setTextColor(34, 35, 38);
  const { lines: nameLines, fontSize } = wrapName(
    doc,
    p.name || "—",
    textW,
    nameMaxLines,
    maxName,
    minName
  );
  const lineH = fontSize * 0.42;
  const nameBlockH = nameLines.length * (lineH + Math.max(0.2, 0.4 * scale));
  let ty = nameTop + Math.max(0, (nameBoxH - nameBlockH) / 2) + lineH * 0.85;
  doc.setFontSize(fontSize);
  for (const line of nameLines) {
    if (ty > nameBottom + 0.5) break;
    doc.text(line, x + padX + 0.5, ty);
    ty += lineH + Math.max(0.2, 0.4 * scale);
  }

  setPdfFont(doc, "normal");
  doc.setTextColor(95, 90, 82);
  let metaY = y + h - padY + 0.2;
  if (placeBand > 0) {
    doc.setFontSize(Math.max(3.4, metaSize - 0.5));
    doc.text(fitText(doc, place, textW, Math.max(3.4, metaSize - 0.5)), x + padX + 0.5, metaY);
    metaY -= placeBand;
  }
  if (life) {
    doc.setFontSize(metaSize);
    doc.setTextColor(70, 55, 40);
    doc.text(fitText(doc, life, textW, metaSize), x + padX + 0.5, metaY);
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
  let cardW = Math.min(42, Math.max(10, cellW - 0.9));
  // Keep enough height for FIO + birth/death line
  let cardH = Math.min(cardW * 0.68, boxH / depth - 1.0);
  cardH = Math.max(12, Math.min(24, cardH));
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
