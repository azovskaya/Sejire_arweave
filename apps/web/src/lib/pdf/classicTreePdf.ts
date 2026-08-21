import { jsPDF } from "jspdf";
import type { Person, Snapshot, TreeMeta } from "../types";
import { pdfT, SHEZHIRE_MAX_GENERATIONS, type PdfLocale } from "../i18n/pdf";
import { splitParents } from "../pedigree";
import {
  ancestorSlotLayout,
  computePedigreeLayout,
  lifeDatesLine,
  planClassicTreeBooklet,
  PEDIGREE_CHART_WINDOW,
  type AncestorSlot,
  type ClassicBookletPage,
  type PedigreeCardPos,
  type PedigreeChartRoot,
  type PedigreeLayoutBox,
} from "./lineage";
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

const INK: [number, number, number] = [95, 70, 40];

function drawPersonCard(
  doc: jsPDF,
  p: Person,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: [number, number, number],
  roomy: boolean
) {
  const scale = Math.min(1, w / 40);
  const radius = Math.max(0.4, 1.2 * scale);
  doc.setDrawColor(120, 110, 95);
  doc.setFillColor(255, 253, 248);
  doc.setLineWidth(Math.max(0.15, 0.3 * scale));
  doc.roundedRect(x, y, w, h, radius, radius, "FD");
  doc.setFillColor(...accent);
  doc.rect(x, y, Math.max(0.8, 1.5 * scale), h, "F");

  const tight = !roomy && (h < 17 || w < 26);
  const padX = Math.max(1.0, (tight ? 2.0 : 2.8) * scale);
  const padY = Math.max(tight ? 1.15 : 2.2, (tight ? 1.7 : 3.4) * scale);
  const textW = Math.max(6, w - padX * 2 - 1);
  const compact = !roomy && (tight || w < 28);
  const life = lifeDatesLine(p, compact);
  const place = (p.birthPlace || "").trim();

  const metaSize = tight
    ? Math.max(3.3, Math.min(5.0, 5.0 * scale))
    : Math.max(3.8, Math.min(roomy ? 7.2 : 6.4, (roomy ? 7.2 : 6.4) * scale));
  const lifeBand = life ? metaSize * (tight ? 0.62 : 0.85) + (tight ? 0.55 : 1.4) : 0;
  const placeBand =
    !tight && place && h - padY * 2 - lifeBand > 8 ? metaSize * 0.75 + 0.8 : 0;
  const nameBottom = y + h - padY - lifeBand - placeBand;
  const nameTop = y + padY;
  const nameBoxH = Math.max(3.2, nameBottom - nameTop);

  const maxName = roomy
    ? Math.max(9, Math.min(13, w * 0.26))
    : Math.max(tight ? 3.8 : 4.0, Math.min(tight ? 6.4 : 8.0, (tight ? 6.4 : 8.0) * scale));
  const minName = roomy
    ? 8
    : Math.max(tight ? 3.0 : 3.2, Math.min(tight ? 4.4 : 5.0, (tight ? 4.4 : 5.0) * scale));
  const nameMaxLines = tight ? (life ? 1 : 2) : life ? (compact ? 2 : 3) : compact ? 3 : 4;

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
  const lineH = fontSize * (tight ? 0.38 : 0.42);
  const nameBlockH = nameLines.length * (lineH + Math.max(0.15, 0.35 * scale));
  let ty = nameTop + Math.max(0, (nameBoxH - nameBlockH) / 2) + lineH * 0.85;
  if (ty > nameBottom) ty = Math.max(nameTop + lineH * 0.8, nameBottom - 0.15);
  doc.setFontSize(fontSize);
  for (const line of nameLines) {
    if (ty > nameBottom + 0.8 && line !== nameLines[0]) break;
    doc.text(line, x + padX + 0.5, ty);
    ty += lineH + Math.max(0.15, 0.35 * scale);
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

function paintConnectors(
  doc: jsPDF,
  snapshot: Snapshot,
  slots: AncestorSlot[],
  positions: Map<string, PedigreeCardPos>,
  cardH: number,
  depth: number
) {
  doc.setDrawColor(150, 130, 100);
  doc.setLineWidth(0.28);
  for (const s of slots) {
    if (s.generation + 1 >= depth) continue;
    const childPos = positions.get(s.person.id);
    if (!childPos) continue;
    const { fatherId, motherId } = splitParents(snapshot, s.person.id);
    const parentCenters = [fatherId, motherId]
      .filter((id): id is string => Boolean(id))
      .map((id) => positions.get(id))
      .filter((p): p is PedigreeCardPos => Boolean(p));
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
}

function paintCards(
  doc: jsPDF,
  snapshot: Snapshot,
  slots: AncestorSlot[],
  box: PedigreeLayoutBox
) {
  const layout = computePedigreeLayout(slots, box);
  const depth = Math.max(...slots.map((s) => s.generation)) + 1;
  paintConnectors(doc, snapshot, slots, layout.positions, layout.cardH, depth);
  for (const s of slots) {
    const pos = layout.positions.get(s.person.id);
    if (!pos) continue;
    const accent: [number, number, number] =
      s.person.sex === "F"
        ? [150, 105, 115]
        : s.person.sex === "M"
          ? [85, 115, 140]
          : [150, 145, 135];
    drawPersonCard(
      doc,
      s.person,
      pos.x,
      pos.y,
      layout.cardW,
      layout.cardH,
      accent,
      layout.roomy
    );
  }
}

function paintPageChrome(
  doc: jsPDF,
  title: string,
  subtitle: string | undefined,
  footer: string | undefined
): PedigreeLayoutBox {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  setPdfFont(doc, "bold");
  doc.setFillColor(250, 246, 238);
  doc.rect(0, 0, pageW, pageH, "F");
  drawPosterFrame(doc, pageW, pageH, INK);
  drawCornerOrnaments(doc, pageW, pageH, [170, 120, 60]);

  doc.setTextColor(...INK);
  doc.setFontSize(subtitle ? 12.5 : 14);
  doc.text(title, pageW / 2, subtitle ? 14.2 : 16.2, { align: "center" });
  if (subtitle) {
    setPdfFont(doc, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 100, 80);
    doc.text(subtitle, pageW / 2, 19.2, { align: "center" });
  }
  drawTitleRule(doc, pageW, subtitle ? 22.2 : 20.2, [175, 140, 90]);

  if (footer) {
    setPdfFont(doc, "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 115, 95);
    doc.text(footer, pageW / 2, pageH - 5.2, { align: "center" });
  }
  setPdfFont(doc, "bold");
  drawBrandMark(doc, pageW, pageH, pdfT().exportedWith, [155, 135, 105]);

  const marginX = 12;
  const topY = subtitle ? 28 : 26;
  const bottomY = pageH - 14;
  return { x: marginX, y: topY, w: pageW - marginX * 2, h: bottomY - topY };
}

function windowForRoot(depth: number, root: PedigreeChartRoot, bushy: boolean): number {
  if (!bushy) return SHEZHIRE_MAX_GENERATIONS;
  return Math.min(PEDIGREE_CHART_WINDOW, Math.max(1, depth - root.startGeneration));
}

function paintFullPageChart(
  doc: jsPDF,
  snapshot: Snapshot,
  slots: AncestorSlot[],
  title: string,
  subtitle: string | undefined,
  footer: string | undefined
) {
  const box = paintPageChrome(doc, title, subtitle, footer);
  paintCards(doc, snapshot, slots, box);
}

function gridShape(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  return { cols: 2, rows: 2 };
}

function paintGridPage(
  doc: jsPDF,
  snapshot: Snapshot,
  roots: PedigreeChartRoot[],
  depth: number,
  title: string,
  subtitle: string,
  footer: string,
  t: ReturnType<typeof pdfT>
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  paintPageChrome(doc, title, subtitle, footer);

  const { cols, rows } = gridShape(roots.length);
  const gridLeft = 12;
  const gridTop = 26;
  const gridRight = pageW - 12;
  const gridBottom = pageH - 12;
  const gapX = 5;
  const gapY = 5;
  const cellW = (gridRight - gridLeft - gapX * (cols - 1)) / cols;
  const cellH = (gridBottom - gridTop - gapY * (rows - 1)) / rows;

  roots.forEach((root, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridLeft + col * (cellW + gapX);
    const y = gridTop + row * (cellH + gapY);
    doc.setDrawColor(200, 185, 160);
    doc.setLineWidth(0.22);
    doc.setFillColor(252, 249, 243);
    doc.roundedRect(x, y, cellW, cellH, 1.4, 1.4, "FD");

    const win = windowForRoot(depth, root, true);
    const slots = ancestorSlotLayout(snapshot, root.id, win);
    const name = snapshot.persons[root.id]?.name || root.id;
    setPdfFont(doc, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(fitText(doc, t.ancestorsOf(name), cellW - 8, 8.5), x + cellW / 2, y + 6.2, {
      align: "center",
    });
    paintCards(doc, snapshot, slots, {
      x: x + 3.2,
      y: y + 9.5,
      w: cellW - 6.4,
      h: cellH - 13,
    });
  });
}

function pageCopy(
  t: ReturnType<typeof pdfT>,
  snapshot: Snapshot,
  page: ClassicBookletPage,
  pageIndex: number,
  total: number,
  depth: number,
  personCount: number,
  firstPage: boolean
): { title: string; subtitle: string; footer: string } {
  const footer = t.pageOf(pageIndex + 1, total);
  if (page.kind === "full") {
    const rootPerson = snapshot.persons[page.root.id];
    const win = windowForRoot(depth, page.root, true);
    const fromKnee = page.root.startGeneration + 1;
    const toKnee = page.root.startGeneration + win;
    const title = firstPage ? t.classicTitle : t.ancestorsOf(rootPerson?.name || page.root.id);
    const subtitle = firstPage
      ? `${personCount} чел. · ${t.kneeRange(1, depth)} · ${footer}`
      : `${t.kneeRange(fromKnee, toKnee)} · ${footer}`;
    return { title, subtitle, footer };
  }
  const fromKnee = Math.min(...page.roots.map((r) => r.startGeneration)) + 1;
  const toKnee = Math.max(
    ...page.roots.map((r) => Math.min(depth, r.startGeneration + PEDIGREE_CHART_WINDOW))
  );
  return {
    title: t.classicTitle,
    subtitle: `${t.kneeRange(fromKnee, toKnee)} · ${footer}`,
    footer,
  };
}

/**
 * Wall-ready classic family poster.
 * A narrow line stays on one page; a full 13-knee binary tree is a booklet of
 * 5-generation charts (A4 cannot hold 4096 people on one leaf row).
 * Leftover 2–3 generation families share a page so names stay readable.
 */
export async function renderClassicTreePdf(opts: {
  snapshot: Snapshot;
  focusId: string;
  meta: TreeMeta;
  locale?: PdfLocale;
}): Promise<jsPDF> {
  const t = pdfT(opts.locale ?? "ru");
  const allSlots = ancestorSlotLayout(opts.snapshot, opts.focusId, SHEZHIRE_MAX_GENERATIONS);
  if (!allSlots.length) throw new Error(t.noPeople);

  const plan = planClassicTreeBooklet(opts.snapshot, opts.focusId, SHEZHIRE_MAX_GENERATIONS);
  const orientation = !plan.bushy && plan.depth > 8 ? "portrait" : "landscape";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  await ensurePdfFont(doc);

  const total = plan.pages.length;
  const count = Object.keys(opts.snapshot.persons).length;

  for (let i = 0; i < plan.pages.length; i += 1) {
    if (i > 0) {
      doc.addPage("a4", orientation);
      setPdfFont(doc, "normal");
    }
    const page = plan.pages[i];
    const copy = pageCopy(t, opts.snapshot, page, i, total, plan.depth, count, i === 0);
    if (page.kind === "full") {
      const win = windowForRoot(plan.depth, page.root, plan.bushy);
      const slots = ancestorSlotLayout(opts.snapshot, page.root.id, win);
      paintFullPageChart(doc, opts.snapshot, slots, copy.title, copy.subtitle, copy.footer);
    } else {
      paintGridPage(
        doc,
        opts.snapshot,
        page.roots,
        plan.depth,
        copy.title,
        copy.subtitle,
        copy.footer,
        t
      );
    }
  }
  return doc;
}

export async function downloadClassicTreePdf(opts: {
  snapshot: Snapshot;
  focusId: string;
  meta: TreeMeta;
  locale?: PdfLocale;
}) {
  const t = pdfT(opts.locale ?? "ru");
  const doc = await renderClassicTreePdf(opts);
  doc.save(`sejire-tree-${safeFilename(opts.meta.title || t.classicTitle, "tree")}.pdf`);
}
