import type { jsPDF } from "jspdf";
import type { Person, TreeMeta } from "../types";
import type { Snapshot } from "../types";
import { pdfT, type PdfLocale } from "../i18n/pdf";
import { ancestorGenerations, yearSpan } from "./lineage";
import { ensurePdfFont, setPdfFont } from "./font";

async function loadJsPdf() {
  const mod = await import("jspdf");
  return mod.jsPDF;
}

function fitText(doc: jsPDF, text: string, maxWidth: number, fontSize: number) {
  doc.setFontSize(fontSize);
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t) > maxWidth) {
    t = `${t.slice(0, -2)}…`;
  }
  return t;
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
  doc.setDrawColor(60, 62, 68);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFillColor(...accent);
  doc.rect(x, y, 1.8, h, "F");

  doc.setTextColor(34, 35, 38);
  setPdfFont(doc, "bold");
  const name = fitText(doc, p.name || "Без имени", w - 6, 9);
  doc.text(name, x + 4, y + 6);

  setPdfFont(doc, "normal");
  doc.setTextColor(90, 92, 98);
  const life = yearSpan(p);
  if (life) {
    doc.setFontSize(7.5);
    doc.text(fitText(doc, life, w - 6, 7.5), x + 4, y + 11);
  }
  const place = (p.birthPlace || "").trim();
  if (place) {
    doc.setFontSize(7);
    doc.text(fitText(doc, place, w - 6, 7), x + 4, y + 15.5);
  }
}

/**
 * Classic family PDF: focus at the bottom, ancestors upward (roots down).
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
  const margin = 12;

  doc.setFillColor(252, 250, 245);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setTextColor(34, 35, 38);
  setPdfFont(doc, "bold");
  doc.setFontSize(16);
  doc.text(t.classicTitle, margin, 14);
  setPdfFont(doc, "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 102, 108);
  doc.text(`${opts.meta.title} · ${t.classicSubtitle}`, margin, 20);
  doc.text(`${t.focusLabel}: ${gens[0][0]?.name ?? ""}`, margin, 25);

  const cardW = 42;
  const cardH = 20;
  const topY = 32;
  const bottomY = pageH - 14;
  const usableH = bottomY - topY;
  const genCount = gens.length;
  const rowGap = genCount > 1 ? usableH / (genCount - 1) : 0;

  type Pos = { id: string; x: number; y: number; cx: number; cy: number };
  const positions = new Map<string, Pos>();

  for (let gi = 0; gi < genCount; gi += 1) {
    const people = gens[gi];
    const visualRow = genCount - 1 - gi;
    const y = topY + visualRow * rowGap;
    const totalW = people.length * cardW + Math.max(0, people.length - 1) * 6;
    let x0 = Math.max(margin, (pageW - totalW) / 2);
    for (const p of people) {
      const x = x0;
      positions.set(p.id, { id: p.id, x, y, cx: x + cardW / 2, cy: y + cardH / 2 });
      x0 += cardW + 6;
    }
  }

  doc.setDrawColor(160, 140, 110);
  doc.setLineWidth(0.35);
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
        p.sex === "F" ? [140, 90, 106] : p.sex === "M" ? [74, 109, 140] : [160, 160, 165];
      drawPersonCard(doc, p, pos.x, pos.y, cardW, cardH, accent);
    }
  }

  setPdfFont(doc, "normal");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 145);
  doc.text(`${t.exportedWith} · ${new Date().toLocaleDateString("ru-RU")}`, margin, pageH - 5);

  const safe = (opts.meta.title || "tree").replace(/[^\w\-а-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ ]+/g, "").trim() || "tree";
  doc.save(`sejire-tree-${safe}.pdf`);
}
