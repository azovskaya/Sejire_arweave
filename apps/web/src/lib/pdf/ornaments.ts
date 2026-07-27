/**
 * Lightweight Kazakh-inspired geometric ornaments for PDF posters.
 * Motifs evoke қосқар мүйіз (ram horns) with simple vector strokes — no images.
 */
import type { jsPDF } from "jspdf";

export type Rgb = [number, number, number];

/** Symmetric ram-horn curl from a center point. */
export function drawHornPair(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number,
  ink: Rgb,
  lineW = 0.35
) {
  doc.setDrawColor(...ink);
  doc.setLineWidth(lineW);
  // left horn
  doc.line(cx, cy, cx - size * 0.55, cy - size * 0.15);
  doc.line(cx - size * 0.55, cy - size * 0.15, cx - size * 0.85, cy - size * 0.55);
  doc.line(cx - size * 0.85, cy - size * 0.55, cx - size * 0.45, cy - size * 0.75);
  // right horn
  doc.line(cx, cy, cx + size * 0.55, cy - size * 0.15);
  doc.line(cx + size * 0.55, cy - size * 0.15, cx + size * 0.85, cy - size * 0.55);
  doc.line(cx + size * 0.85, cy - size * 0.55, cx + size * 0.45, cy - size * 0.75);
}

/** Diamond knot used on the vertical lineage spine. */
export function drawDiamondKnot(doc: jsPDF, cx: number, cy: number, r: number, ink: Rgb, fill: Rgb) {
  doc.setDrawColor(...ink);
  doc.setFillColor(...fill);
  doc.setLineWidth(0.55);
  doc.triangle(cx, cy - r, cx + r, cy, cx, cy + r, "FD");
  doc.triangle(cx, cy - r, cx - r, cy, cx, cy + r, "FD");
  doc.setFillColor(...ink);
  doc.circle(cx, cy, r * 0.28, "F");
}

/** Corner қосқар мүйіз block for poster margins. */
export function drawOrnamentCorner(
  doc: jsPDF,
  x: number,
  y: number,
  facing: "tl" | "tr" | "bl" | "br",
  ink: Rgb,
  size = 8
) {
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.4);
  const sx = facing === "tl" || facing === "bl" ? 1 : -1;
  const sy = facing === "tl" || facing === "tr" ? 1 : -1;
  const x2 = x + sx * size;
  const y2 = y + sy * size;
  doc.line(x, y, x2, y);
  doc.line(x, y, x, y2);
  doc.line(x + sx * size * 0.35, y, x + sx * size * 0.35, y + sy * size * 0.55);
  doc.line(x, y + sy * size * 0.35, x + sx * size * 0.55, y + sy * size * 0.35);
  // inner horn curl
  doc.line(x + sx * 2.2, y + sy * 2.2, x + sx * 5.2, y + sy * 2.8);
  doc.line(x + sx * 5.2, y + sy * 2.8, x + sx * 6.2, y + sy * 5.5);
  doc.line(x + sx * 2.2, y + sy * 2.2, x + sx * 2.8, y + sy * 5.2);
  doc.line(x + sx * 2.8, y + sy * 5.2, x + sx * 5.5, y + sy * 6.2);
}

/** Repeating wave / horn border along an edge. */
export function drawOrnamentBorder(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  inset: number,
  ink: Rgb
) {
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.55);
  doc.rect(inset, inset, pageW - inset * 2, pageH - inset * 2);
  doc.setLineWidth(0.22);
  doc.rect(inset + 2.2, inset + 2.2, pageW - (inset + 2.2) * 2, pageH - (inset + 2.2) * 2);

  drawOrnamentCorner(doc, inset + 3.5, inset + 3.5, "tl", ink, 9);
  drawOrnamentCorner(doc, pageW - inset - 3.5, inset + 3.5, "tr", ink, 9);
  drawOrnamentCorner(doc, inset + 3.5, pageH - inset - 3.5, "bl", ink, 9);
  drawOrnamentCorner(doc, pageW - inset - 3.5, pageH - inset - 3.5, "br", ink, 9);

  // side motif ticks
  doc.setLineWidth(0.3);
  const midY = pageH / 2;
  for (const x of [inset + 1.1, pageW - inset - 1.1]) {
    doc.line(x, midY - 10, x, midY + 10);
    doc.circle(x, midY, 0.7, "S");
  }
}

/** Title wings under Жеті ата. */
export function drawTitleOrnament(doc: jsPDF, cx: number, y: number, halfW: number, ink: Rgb) {
  doc.setDrawColor(...ink);
  doc.setFillColor(...ink);
  doc.setLineWidth(0.4);
  doc.line(cx - halfW, y, cx - 8, y);
  doc.line(cx + 8, y, cx + halfW, y);
  drawHornPair(doc, cx, y + 1.2, 7, ink, 0.4);
  doc.circle(cx, y, 1.1, "F");
}

/**
 * Ornamental name cartouche — each ancestor sits in a framed plaque.
 */
export function drawNameCartouche(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  ink: Rgb,
  fill: Rgb,
  accent: Rgb
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.55);
  doc.roundedRect(x, y, w, h, 1.6, 1.6, "FD");

  // inner hairline
  doc.setLineWidth(0.2);
  doc.setDrawColor(...accent);
  doc.roundedRect(x + 1.3, y + 1.3, w - 2.6, h - 2.6, 1.1, 1.1, "S");

  // corner ticks
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.35);
  const t = 3.2;
  // TL
  doc.line(x + 2, y + 2, x + 2 + t, y + 2);
  doc.line(x + 2, y + 2, x + 2, y + 2 + t);
  // TR
  doc.line(x + w - 2, y + 2, x + w - 2 - t, y + 2);
  doc.line(x + w - 2, y + 2, x + w - 2, y + 2 + t);
  // BL
  doc.line(x + 2, y + h - 2, x + 2 + t, y + h - 2);
  doc.line(x + 2, y + h - 2, x + 2, y + h - 2 - t);
  // BR
  doc.line(x + w - 2, y + h - 2, x + w - 2 - t, y + h - 2);
  doc.line(x + w - 2, y + h - 2, x + w - 2, y + h - 2 - t);

  // side horn flourishes (outside left/right center)
  const mid = y + h / 2;
  doc.setLineWidth(0.3);
  doc.setDrawColor(...accent);
  // left
  doc.line(x - 0.2, mid, x - 3.2, mid - 2.4);
  doc.line(x - 3.2, mid - 2.4, x - 4.4, mid);
  doc.line(x - 0.2, mid, x - 3.2, mid + 2.4);
  doc.line(x - 3.2, mid + 2.4, x - 4.4, mid);
  // right
  doc.line(x + w + 0.2, mid, x + w + 3.2, mid - 2.4);
  doc.line(x + w + 3.2, mid - 2.4, x + w + 4.4, mid);
  doc.line(x + w + 0.2, mid, x + w + 3.2, mid + 2.4);
  doc.line(x + w + 3.2, mid + 2.4, x + w + 4.4, mid);
}

/** Small label plaque for Өзі / Әке / Ата … */
export function drawLabelPlaque(
  doc: jsPDF,
  cx: number,
  cy: number,
  text: string,
  ink: Rgb,
  fill: Rgb,
  setFont: (bold: boolean) => void
) {
  setFont(false);
  doc.setFontSize(6.4);
  const tw = doc.getTextWidth(text);
  const w = tw + 5;
  const h = 6.2;
  const x = cx - w;
  const y = cy - h / 2;
  doc.setFillColor(...fill);
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 1, 1, "FD");
  doc.setTextColor(...ink);
  doc.text(text, x + w / 2, cy + 1.1, { align: "center" });
}
