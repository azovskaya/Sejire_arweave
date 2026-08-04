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

/**
 * Detailed қосқар мүйіз — multi-stroke ram-horn curl (ancient мүйіз family).
 * Used on ceremonial шежіре posters.
 */
export function drawKoshkarMuyiz(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number,
  ink: Rgb,
  lineW = 0.32
) {
  doc.setDrawColor(...ink);
  const s = size;
  // Outer left horn (3 parallel strokes for density)
  for (const o of [0, 0.45, 0.9]) {
    doc.setLineWidth(lineW * (o === 0 ? 1.15 : 0.7));
    const dx = o * 0.15;
    doc.line(cx - dx, cy, cx - s * 0.42 - dx, cy - s * 0.08);
    doc.line(cx - s * 0.42 - dx, cy - s * 0.08, cx - s * 0.78 - dx, cy - s * 0.42);
    doc.line(cx - s * 0.78 - dx, cy - s * 0.42, cx - s * 0.92 - dx, cy - s * 0.78);
    doc.line(cx - s * 0.92 - dx, cy - s * 0.78, cx - s * 0.55 - dx, cy - s * 0.95);
    doc.line(cx - s * 0.55 - dx, cy - s * 0.95, cx - s * 0.28 - dx, cy - s * 0.72);
  }
  // Outer right horn
  for (const o of [0, 0.45, 0.9]) {
    doc.setLineWidth(lineW * (o === 0 ? 1.15 : 0.7));
    const dx = o * 0.15;
    doc.line(cx + dx, cy, cx + s * 0.42 + dx, cy - s * 0.08);
    doc.line(cx + s * 0.42 + dx, cy - s * 0.08, cx + s * 0.78 + dx, cy - s * 0.42);
    doc.line(cx + s * 0.78 + dx, cy - s * 0.42, cx + s * 0.92 + dx, cy - s * 0.78);
    doc.line(cx + s * 0.92 + dx, cy - s * 0.78, cx + s * 0.55 + dx, cy - s * 0.95);
    doc.line(cx + s * 0.55 + dx, cy - s * 0.95, cx + s * 0.28 + dx, cy - s * 0.72);
  }
  // Center knot (түйін)
  doc.setFillColor(...ink);
  doc.circle(cx, cy, s * 0.12, "F");
  doc.setLineWidth(lineW * 0.8);
  doc.circle(cx, cy, s * 0.22, "S");
}

/** Corner block with layered қосқар мүйіз for manuscript frames. */
export function drawKoshkarCorner(
  doc: jsPDF,
  x: number,
  y: number,
  facing: "tl" | "tr" | "bl" | "br",
  ink: Rgb,
  size = 11
) {
  const sx = facing === "tl" || facing === "bl" ? 1 : -1;
  const sy = facing === "tl" || facing === "tr" ? 1 : -1;
  doc.setDrawColor(...ink);

  // Outer L-frame
  doc.setLineWidth(0.7);
  doc.line(x, y, x + sx * size, y);
  doc.line(x, y, x, y + sy * size);
  doc.setLineWidth(0.28);
  doc.line(x + sx * 1.6, y + sy * 1.6, x + sx * (size - 1.2), y + sy * 1.6);
  doc.line(x + sx * 1.6, y + sy * 1.6, x + sx * 1.6, y + sy * (size - 1.2));

  // Inner stepped bands
  doc.setLineWidth(0.35);
  doc.line(x + sx * 2.4, y + sy * 2.4, x + sx * size * 0.72, y + sy * 2.4);
  doc.line(x + sx * 2.4, y + sy * 2.4, x + sx * 2.4, y + sy * size * 0.72);

  // Horn curl into the corner
  const hx = x + sx * size * 0.42;
  const hy = y + sy * size * 0.42;
  doc.setLineWidth(0.4);
  doc.line(hx, hy, hx + sx * size * 0.28, hy + sy * size * 0.06);
  doc.line(hx + sx * size * 0.28, hy + sy * size * 0.06, hx + sx * size * 0.48, hy + sy * size * 0.32);
  doc.line(hx + sx * size * 0.48, hy + sy * size * 0.32, hx + sx * size * 0.22, hy + sy * size * 0.48);
  doc.line(hx, hy, hx + sx * size * 0.06, hy + sy * size * 0.28);
  doc.line(hx + sx * size * 0.06, hy + sy * size * 0.28, hx + sx * size * 0.32, hy + sy * size * 0.48);

  // Tiny diamond at corner origin
  const d = 1.4;
  doc.setFillColor(...ink);
  doc.triangle(x + sx * d, y, x, y + sy * d, x + sx * d, y + sy * 2 * d, "F");
}

/**
 * Full ceremonial border for Тізім: triple frame, corners, mid-side and mid-edge horns.
 */
export function drawShezhireManuscriptBorder(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  inset: number,
  ink: Rgb,
  gold: Rgb
) {
  // Outer heavy frame
  doc.setDrawColor(...ink);
  doc.setLineWidth(1.35);
  doc.rect(inset, inset, pageW - inset * 2, pageH - inset * 2);
  // Gold middle
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.rect(inset + 2.2, inset + 2.2, pageW - (inset + 2.2) * 2, pageH - (inset + 2.2) * 2);
  // Inner hairline
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.55);
  doc.rect(inset + 4.2, inset + 4.2, pageW - (inset + 4.2) * 2, pageH - (inset + 4.2) * 2);

  // Thin ornamental band between outer and gold frame
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.18);
  const band = inset + 1.1;
  doc.rect(band, band, pageW - band * 2, pageH - band * 2);

  const c = inset + 5.5;
  drawKoshkarCorner(doc, c, c, "tl", ink, 12);
  drawKoshkarCorner(doc, pageW - c, c, "tr", ink, 12);
  drawKoshkarCorner(doc, c, pageH - c, "bl", ink, 12);
  drawKoshkarCorner(doc, pageW - c, pageH - c, "br", ink, 12);

  // Mid-edge қосқар мүйіз (top / bottom) — detailed
  drawKoshkarMuyiz(doc, pageW / 2, inset + 3.2, 7.5, gold, 0.28);
  drawKoshkarMuyiz(doc, pageW / 2, pageH - inset - 3.2, 7.5, gold, 0.28);

  // Quarter-edge diamond ticks along top/bottom (ancient қоршау rhythm)
  doc.setFillColor(...ink);
  const edgeYs = [inset + 2.8, pageH - inset - 2.8];
  for (const ey of edgeYs) {
    for (const frac of [0.22, 0.35, 0.65, 0.78]) {
      const ex = pageW * frac;
      doc.circle(ex, ey, 0.55, "F");
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.2);
      doc.line(ex - 2.2, ey, ex - 0.9, ey);
      doc.line(ex + 0.9, ey, ex + 2.2, ey);
    }
  }

  // Side mid motifs — vertical twin horns + diamond knot
  const midY = pageH / 2;
  for (const x of [inset + 2.8, pageW - inset - 2.8]) {
    doc.setDrawColor(...ink);
    doc.setLineWidth(0.35);
    doc.line(x, midY - 16, x, midY + 16);
    drawDiamondKnot(doc, x, midY, 2.4, ink, [242, 228, 198]);
    drawHornPair(doc, x, midY - 9, 4.4, gold, 0.25);
    drawHornPair(doc, x, midY + 9, 4.4, gold, 0.25);
    // Extra small knots above/below
    drawDiamondKnot(doc, x, midY - 16, 1.2, gold, [242, 228, 198]);
    drawDiamondKnot(doc, x, midY + 16, 1.2, gold, [242, 228, 198]);
  }
}

/** Ornamental horizontal row plaque for a generation entry. */
export function drawGenerationRowFrame(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  ink: Rgb,
  fill: Rgb,
  accent: Rgb,
  emphasize: boolean
) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...ink);
  doc.setLineWidth(emphasize ? 0.7 : 0.42);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");

  doc.setDrawColor(...accent);
  doc.setLineWidth(0.22);
  doc.roundedRect(x + 1.15, y + 1.15, w - 2.3, h - 2.3, 0.9, 0.9, "S");

  // Left accent bar (мүйіз-stripe)
  doc.setFillColor(...accent);
  doc.rect(x, y + 1.4, 1.6, h - 2.8, "F");
  if (emphasize) {
    doc.setFillColor(...ink);
    doc.rect(x + 1.6, y + 1.8, 0.45, h - 3.6, "F");
  }

  // Corner micro-ticks inside plaque
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.28);
  const t = Math.min(2.6, h * 0.28);
  doc.line(x + 3.2, y + 2, x + 3.2 + t, y + 2);
  doc.line(x + 3.2, y + 2, x + 3.2, y + 2 + t);
  doc.line(x + w - 2.2, y + 2, x + w - 2.2 - t, y + 2);
  doc.line(x + w - 2.2, y + 2, x + w - 2.2, y + 2 + t);
  doc.line(x + 3.2, y + h - 2, x + 3.2 + t, y + h - 2);
  doc.line(x + 3.2, y + h - 2, x + 3.2, y + h - 2 - t);
  doc.line(x + w - 2.2, y + h - 2, x + w - 2.2 - t, y + h - 2);
  doc.line(x + w - 2.2, y + h - 2, x + w - 2.2, y + h - 2 - t);

  // Side mini-horns (қосқар tip flourishes)
  const mid = y + h / 2;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.28);
  doc.line(x - 0.3, mid, x - 2.8, mid - 2);
  doc.line(x - 2.8, mid - 2, x - 3.6, mid);
  doc.line(x - 0.3, mid, x - 2.8, mid + 2);
  doc.line(x - 2.8, mid + 2, x - 3.6, mid);
  doc.line(x + w + 0.3, mid, x + w + 2.8, mid - 2);
  doc.line(x + w + 2.8, mid - 2, x + w + 3.6, mid);
  doc.line(x + w + 0.3, mid, x + w + 2.8, mid + 2);
  doc.line(x + w + 2.8, mid + 2, x + w + 3.6, mid);
}
