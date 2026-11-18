// 마스코트 시트(1254x1254, 흰 배경)를 포즈별 투명 PNG로 잘라 public/mascot 에 저장한다.
// usage: node scripts/cut-mascot.mjs <sheet.png>
import sharp from "sharp";
import path from "node:path";

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/cut-mascot.mjs <sheet.png>"); process.exit(1); }

const BOXES = {
  hero: [55, 0, 1215, 626, 1100],
  cheer: [55, 630, 392, 945, 520],
  phone: [440, 635, 760, 945, 520],
  run: [820, 636, 1175, 945, 560],
  rest: [40, 955, 375, 1235, 520],
  concert: [415, 955, 712, 1235, 520],
  peek: [895, 955, 1215, 1235, 520],
};

for (const [name, [x1, y1, x2, y2, outW]] of Object.entries(BOXES)) {
  const w = x2 - x1, h = y2 - y1;
  const { data } = await sharp(src).extract({ left: x1, top: y1, width: w, height: h }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = new Uint8Array(w * h);
  const near = (i) => { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; return Math.min(r, g, b) >= 243 && Math.max(r, g, b) - Math.min(r, g, b) <= 10; };
  const stack = [];
  const push = (x, y) => { const i = y * w + x; if (!bg[i] && near(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < w * h; i++) if (bg[i]) data[i * 4 + 3] = 0;
  // 가장자리 한 겹은 반투명으로 부드럽게
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!bg[i] && (bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w])) data[i * 4 + 3] = Math.min(data[i * 4 + 3], 170);
  }
  const out = path.join("public", "mascot", `${name}.png`);
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).resize({ width: outW, withoutEnlargement: true }).png({ palette: true, quality: 92, compressionLevel: 9 }).toFile(out);
  const m = await sharp(out).metadata();
  console.log(name, `${m.width}x${m.height}`);
}
