/**
 * `bun run assets` — генерация всей графики одной командой:
 * бандл страницы-генератора → headless Chromium (Playwright) → кадры → атлас PNG с палитрой + JSON,
 * плюс превью в docs/img. На Windows один раз нужен Chromium: `bunx playwright install chromium`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { paletteHex } from "../../src/data/palette";
import { encodeApng, encodeIndexedPng, hexToRgb, type Rgb } from "./lib/png";
import type { GenResult } from "./types";

const OUT_ASSETS = "assets";
const OUT_DOCS = join("docs", "img");

const bundle = await Bun.build({
  entrypoints: [join(import.meta.dir, "page", "main.ts")],
  target: "browser",
  format: "iife",
  minify: false,
});
if (!bundle.success || !bundle.outputs[0]) {
  for (const log of bundle.logs) console.error(log);
  process.exit(1);
}
const pageScript = await bundle.outputs[0].text();

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let result: GenResult;
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => {
    console.error("Ошибка на странице:", e.message);
  });
  page.on("console", (m) => {
    if (m.text().includes("GPU stall due to ReadPixels")) return; // шум программного GL, не ошибка
    if (m.type() === "error" || m.type() === "warning") console.error(`[страница] ${m.text()}`);
  });
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: pageScript });
  result = await page.evaluate(() => {
    const api = window.__assets;
    if (!api) throw new Error("Генератор не загрузился");
    return api.generate();
  });
} finally {
  await browser.close();
}

const palette: Rgb[] = [[0, 0, 0], ...paletteHex().map(hexToRgb)];
const decode = (b64: string): Uint8Array => new Uint8Array(Buffer.from(b64, "base64"));

await mkdir(OUT_ASSETS, { recursive: true });
await mkdir(OUT_DOCS, { recursive: true });

const atlasPng = encodeIndexedPng({
  width: result.atlas.w,
  height: result.atlas.h,
  data: decode(result.atlas.b64),
  palette,
  transparentIndex: 0,
});
await writeFile(join(OUT_ASSETS, "atlas.png"), atlasPng);

const atlasJson = JSON.stringify({
  image: "atlas.png",
  w: result.atlas.w,
  h: result.atlas.h,
  ppu: result.ppu,
  frames: result.frames,
  anims: result.anims,
});
await writeFile(join(OUT_ASSETS, "atlas.json"), atlasJson + "\n");

const sheetPng = encodeIndexedPng({
  width: result.sheet.w,
  height: result.sheet.h,
  data: decode(result.sheet.b64),
  palette,
  transparentIndex: 0,
});
await writeFile(join(OUT_DOCS, "phase4-sheet.png"), sheetPng);

const animPng = encodeIndexedPng({
  width: result.animSheet.w,
  height: result.animSheet.h,
  data: decode(result.animSheet.b64),
  palette,
  transparentIndex: 0,
});
await writeFile(join(OUT_DOCS, "phase4-anims.png"), animPng);

const officePng = encodeApng({
  width: result.office.w,
  height: result.office.h,
  frames: result.office.frames.map(decode),
  delayMs: result.office.delayMs,
  palette,
  transparentIndex: 0,
});
await writeFile(join(OUT_DOCS, "phase4-office.png"), officePng);

const kb = (n: number): string => (n / 1024).toFixed(1).padStart(7) + " КБ";
const gz = (b: Uint8Array<ArrayBuffer> | string): number => Bun.gzipSync(typeof b === "string" ? new TextEncoder().encode(b) : b).byteLength;
console.log(`Кадров: ${result.stats.frameCount}, рендер ${result.stats.renderMs} мс`);
console.log(`Атлас ${result.atlas.w}×${result.atlas.h}, палитра ${palette.length} цветов`);
console.log(`assets/atlas.png  ${kb(atlasPng.byteLength)}   (gzip ${kb(gz(atlasPng))})`);
console.log(`assets/atlas.json ${kb(atlasJson.length)}   (gzip ${kb(gz(atlasJson))})`);
console.log(`docs/img/phase4-sheet.png  ${kb(sheetPng.byteLength)}`);
console.log(`docs/img/phase4-office.png ${kb(officePng.byteLength)} (APNG, ${result.office.frames.length} кадров)`);
