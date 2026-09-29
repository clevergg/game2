/**
 * `bun run audio:preview` — рендерит все звуки игры в WAV для прослушивания.
 * В сборку игры WAV не попадают: там звук синтезируется на лету тем же кодом.
 * Результат: .cache/audio-preview/*.wav и sfx-all.wav (все эффекты подряд).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import type { AudioClip } from "./audio-page";

const OUT = join(".cache", "audio-preview");

const bundle = await Bun.build({ entrypoints: [join(import.meta.dir, "audio-page.ts")], target: "browser", format: "iife" });
if (!bundle.success || !bundle.outputs[0]) {
  for (const log of bundle.logs) console.error(log);
  process.exit(1);
}
const script = await bundle.outputs[0].text();

const browser = await chromium.launch();
let clips: AudioClip[];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => {
    console.error("Ошибка на странице:", e.message);
  });
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: script });
  clips = await page.evaluate(async () => {
    const api = window.__audio;
    if (!api) throw new Error("Страница звука не загрузилась");
    return api.renderAll();
  });
} finally {
  await browser.close();
}

/** 16-битный PCM WAV, моно. */
function wav(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) out.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  out.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, sampleRate, true);
  out.setUint32(28, sampleRate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  str(36, "data");
  out.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => {
    out.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, v)) * 32767), true);
  });
  return new Uint8Array(out.buffer);
}

const toSamples = (b64: string): Float32Array => {
  const bytes = Buffer.from(b64, "base64");
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
};

await mkdir(OUT, { recursive: true });
const sfxParts: Float32Array[] = [];
let rate = 22050;
for (const c of clips) {
  const samples = toSamples(c.b64);
  rate = c.sampleRate;
  await writeFile(join(OUT, `${c.name}.wav`), wav(samples, c.sampleRate));
  const clip = c.peak > 1 ? " ⚠️ клиппинг" : "";
  console.log(`${c.name.padEnd(16)} ${(samples.length / c.sampleRate).toFixed(2)} с  пик ${c.peak.toFixed(2)}${clip}`);
  if (!c.name.startsWith("music")) sfxParts.push(samples, new Float32Array(Math.round(c.sampleRate * 0.35)));
}
const all = new Float32Array(sfxParts.reduce((s, p) => s + p.length, 0));
let off = 0;
for (const p of sfxParts) {
  all.set(p, off);
  off += p.length;
}
await writeFile(join(OUT, "sfx-all.wav"), wav(all, rate));
console.log(`\nWAV-файлы: ${OUT}`);
