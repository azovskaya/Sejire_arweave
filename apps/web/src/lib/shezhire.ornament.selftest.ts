import { writeFileSync, mkdirSync } from "fs";
import { createTree, setDraftPerson } from "./treeEngine";
import { maleLineUp, yearSpan } from "./pdf/lineage";
import { ensurePdfFont, setPdfFont } from "./pdf/font";
import { drawBrandMark, wrapName } from "./pdf/poster";
import {
  drawDiamondKnot,
  drawLabelPlaque,
  drawNameCartouche,
  drawOrnamentBorder,
  drawTitleOrnament,
} from "./pdf/ornaments";
import { pdfT } from "./i18n/pdf";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let store = createTree("Мой род");
const people: { id: string; name: string; parents: string[]; sex: "M" | "F" | "U" }[] = [
  { id: "me", name: "Азовский Владимир Алексеевич", parents: ["f"], sex: "M" },
  { id: "f", name: "Азвоский Алексей Викторович", parents: ["gf"], sex: "M" },
  { id: "gf", name: "Гапченко Петр Григорьевич", parents: ["ggf"], sex: "M" },
  { id: "ggf", name: "Алексеев Николай Тимофеевич", parents: ["gggf"], sex: "M" },
  { id: "gggf", name: "Алексеев Тимофей Яковлевич", parents: [], sex: "M" },
];

for (const p of people) {
  store = setDraftPerson(store, {
    id: p.id,
    name: p.name,
    sex: p.sex,
    born: null,
    died: null,
    parents: p.parents,
    media: [],
    notes: "",
    tombstone: false,
  });
}

const line = maleLineUp(store.draft, "me");
assert(line.length === 5, "male line length");
assert(yearSpan({ ...store.draft.persons.me, born: "1998-03-15" }).includes("1998"), "year span");

const { jsPDF } = await import("jspdf");
const t = pdfT("ru");
const names = [...line.slice(0, 7)].reverse();
const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
await ensurePdfFont(doc);

const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();
const parchment: [number, number, number] = [242, 228, 198];
const parchmentDeep: [number, number, number] = [232, 212, 172];
const ink: [number, number, number] = [72, 38, 18];
const gold: [number, number, number] = [148, 98, 42];
const goldSoft: [number, number, number] = [176, 132, 68];
const plaque: [number, number, number] = [252, 243, 220];
const mute: [number, number, number] = [110, 78, 42];

doc.setFillColor(...parchment);
doc.rect(0, 0, pageW, pageH, "F");
doc.setFillColor(...parchmentDeep);
doc.rect(0, 0, 14, pageH, "F");
doc.rect(pageW - 14, 0, 14, pageH, "F");
drawOrnamentBorder(doc, pageW, pageH, 8, ink);
setPdfFont(doc, "bold");
doc.setTextColor(...ink);
doc.setFontSize(24);
doc.text(t.shezhireTitle, pageW / 2, 22, { align: "center" });
setPdfFont(doc, "normal");
doc.setFontSize(9);
doc.setTextColor(...mute);
doc.text(t.shezhireSubtitle, pageW / 2, 27.8, { align: "center" });
drawTitleOrnament(doc, pageW / 2, 31.5, pageW / 2 - 28, gold);

const n = names.length;
const bottomY = pageH - 16;
const topY = 40;
const available = bottomY - topY;
const gap = 3;
const cartoucheH = Math.min(22, (available - gap * (n - 1)) / n);
const block = cartoucheH + gap;
const stackH = n * cartoucheH + (n - 1) * gap;
const stackTop = topY + (available - stackH) / 2;
const spineX = 48;
const cartoucheX = 58;
const cartoucheW = pageW - cartoucheX - 18;

doc.setDrawColor(...gold);
doc.setLineWidth(0.85);
doc.line(spineX, stackTop + cartoucheH / 2, spineX, stackTop + (n - 1) * block + cartoucheH / 2);

for (let i = 0; i < n; i += 1) {
  const person = names[i];
  const y = stackTop + i * block;
  const cy = y + cartoucheH / 2;
  const label = t.jetiAtaLabel(n - 1 - i);
  drawDiamondKnot(doc, spineX, cy, 2.8, ink, parchment);
  doc.setDrawColor(...goldSoft);
  doc.setLineWidth(0.35);
  doc.line(spineX + 3.2, cy, cartoucheX - 4.6, cy);
  drawLabelPlaque(doc, spineX - 5, cy, label, ink, plaque, (bold) =>
    setPdfFont(doc, bold ? "bold" : "normal")
  );
  drawNameCartouche(doc, cartoucheX, y, cartoucheW, cartoucheH, ink, plaque, gold);
  setPdfFont(doc, "bold");
  doc.setTextColor(...ink);
  const { lines, fontSize } = wrapName(doc, person.name, cartoucheW - 11, 2, 10, 6.5);
  doc.setFontSize(fontSize);
  const lineH = fontSize * 0.42 + 0.35;
  let ty = cy - (lines.length * lineH) / 2 + lineH * 0.7;
  for (const nl of lines) {
    doc.text(nl, cartoucheX + cartoucheW / 2, ty, { align: "center" });
    ty += lineH;
  }
}

setPdfFont(doc, "bold");
drawBrandMark(doc, pageW, pageH, "SEJIRE", [140, 105, 60]);

mkdirSync("/opt/cursor/artifacts", { recursive: true });
const buf = Buffer.from(doc.output("arraybuffer"));
writeFileSync("/opt/cursor/artifacts/sejire-jeti-ata-sample.pdf", buf);
assert(buf.length > 5000, "pdf bytes");
console.log("shezhire.ornament.selftest: OK", { bytes: buf.length, n });
