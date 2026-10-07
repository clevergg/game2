/**
 * `bun run promo:video` — горизонтальное геймплейное видео для страницы игры в Яндекс Играх:
 * MP4 (H.264), 1920×1080, 16:9, 30 кадров/с, 26 с (лимит Яндекса — 28 с и 100 МБ).
 *
 * Запись детерминированная: часы страницы подменены (Playwright clock), игровое время шагает
 * ровно на 1/30 с между снимками, поэтому кадры не теряются даже на медленной машине.
 * CSS-анимации интерфейса синхронизируются с теми же часами. Кадры уходят в ffmpeg (ffmpeg-static,
 * инструмент разработки, в игру не попадает). Сценарий — тапы, слияния, найм, записка Хозяина,
 * лифт по трём этажам, отдел квадров.
 */
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { chromium, type Page } from "playwright";
import atlas from "../assets/atlas.json";
import { startDay } from "../src/core/live";
import { toSave } from "../src/core/save";
import { createState, recomputeIncome } from "../src/core/state";
import { BALANCE } from "../src/data/balance";
import { computeLayout, HUD_TOP, type Layout } from "../src/game/layout";

const OUT = join("release", "promo");
const FPS = 30;
const SECONDS = 26;
const VIEW = { width: 1280, height: 720 };
const SCALE = 1.5; // 1280×720 × 1,5 = 1920×1080
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = normalize(new URL(req.url).pathname).replace(/^[/\\]+/, "") || "index.html";
    const file = join("dist", path);
    try {
      if (!(await stat(file)).isFile()) return new Response("not found", { status: 404 });
      return new Response(await readFile(file), {
        headers: { "content-type": TYPES[extname(file)] ?? "application/octet-stream" },
      });
    } catch {
      return new Response("not found", { status: 404 });
    }
  },
});

const MSK_OFFSET_MIN = -180;

/** Сохранение для ролика: три этажа, на каждом есть пары для слияния и свободные столы. */
function videoSave(now: number): string {
  const s = createState();
  s.floorsUnlocked = 3;
  s.seniority = 6;
  s.stamps = 4;
  const ranks = [
    [6, 6, 5, 5, 4, 4, 7, 3, 3, 8],
    [5, 5, 4, 4, 6, 3, 3, 7, 2, 2],
    [4, 4, 3, 3, 5, 2, 2, 6, 1, 1],
  ];
  for (let fi = 0; fi < 3; fi++) {
    const f = s.floors[fi];
    if (!f) continue;
    f.deskCount = 12;
    ranks[fi]?.forEach((r, i) => (f.desks[i] = r));
    f.rare[6] = 1;
    f.qual = 2;
    f.equip = 3;
    s.cards[fi] = (1 << 7) - 1;
  }
  recomputeIncome(s);
  s.kukishi = 5e9;
  const day = Math.floor((now - MSK_OFFSET_MIN * 60_000) / 86_400_000);
  startDay(s, day);
  s.live.avansDay = day;
  s.live.avansStreak = 3;
  return JSON.stringify(toSave(s, now));
}

interface SaveView {
  floors: { desks: number[]; deskCount: number }[];
}

/** Состояние этажей из сохранения (pagehide сохраняет текущее состояние в localStorage). */
async function desksOf(page: Page, floor: number): Promise<number[]> {
  const raw = await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    return localStorage.getItem("kontorka.save");
  });
  if (!raw) return [];
  const s = JSON.parse(raw) as SaveView;
  const f = s.floors[floor];
  return f ? f.desks.slice(0, f.deskCount) : [];
}

function layout(deskCount: number): Layout {
  const desk = atlas.frames.f0_desk;
  return computeLayout(VIEW.width, VIEW.height, deskCount, BALANCE.desksMax, {
    deskW: desk[2] ?? 129,
    deskTop: desk[5] ?? 91,
    charTop: atlas.frames.f0_b5_idle_0[5] ?? 150,
  });
}

const body = (L: Layout, d: number): [number, number] => [
  L.deskX[d] ?? 0,
  (L.deskY[d] ?? 0) - 105 * L.scale,
];

// ——— Сценарий: действие на кадре ———

type Step =
  | { kind: "tap"; desks: number[] }
  | { kind: "merge" }
  | { kind: "hire" }
  | { kind: "note" }
  | { kind: "lift"; dir: 1 | -1 }
  | { kind: "click"; selector: string };

const SCRIPT: [number, Step][] = [];
const at = (sec: number, step: Step): void => {
  SCRIPT.push([Math.round(sec * FPS), step]);
};
// Бухгалтерия: колупаем, сливаем, нанимаем
for (let t = 0.2; t < 1.6; t += 0.2) at(t, { kind: "tap", desks: [0, 2, 4, 6] });
at(1.7, { kind: "merge" });
at(2.8, { kind: "merge" });
at(3.9, { kind: "hire" });
at(4.3, { kind: "hire" });
at(4.9, { kind: "merge" });
for (let t = 5.9; t < 6.9; t += 0.2) at(t, { kind: "tap", desks: [1, 3, 5] });
at(7.0, { kind: "note" });
for (let t = 7.6; t < 8.8; t += 0.2) at(t, { kind: "tap", desks: [0, 2, 6] });
// Склад
at(9.0, { kind: "lift", dir: 1 });
for (let t = 9.8; t < 10.8; t += 0.2) at(t, { kind: "tap", desks: [0, 4, 7] });
at(10.9, { kind: "merge" });
at(12.0, { kind: "merge" });
// Конторка дизайнеров
at(13.2, { kind: "lift", dir: 1 });
for (let t = 14.0; t < 15.0; t += 0.2) at(t, { kind: "tap", desks: [0, 4, 7] });
at(15.1, { kind: "merge" });
at(16.2, { kind: "merge" });
// Отдел квадров: Кудесница Алеся
at(17.4, { kind: "click", selector: ".side-btn >> nth=0" });
at(18.0, { kind: "click", selector: ".tab >> nth=1" });
at(20.2, { kind: "click", selector: ".close-btn" });
// Обратно в Бухгалтерию: финальные слияния
at(20.8, { kind: "lift", dir: -1 });
at(21.3, { kind: "lift", dir: -1 });
for (let t = 21.9; t < 22.9; t += 0.2) at(t, { kind: "tap", desks: [0, 2, 6] });
at(23.0, { kind: "merge" });
at(24.1, { kind: "merge" });
for (let t = 25.0; t < 25.9; t += 0.2) at(t, { kind: "tap", desks: [1, 3, 5] });

/** Драг занимает несколько кадров: держим его состояние между кадрами. */
interface Drag {
  from: [number, number];
  to: [number, number];
  frame: number;
}
const DRAG_FRAMES = 14;

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  await mkdir(OUT, { recursive: true });
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: SCALE,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  });
  const now = Date.now();
  await ctx.clock.install({ time: now });
  await ctx.addInitScript((data) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kontorka.save", data);
    localStorage.setItem("kontorka.pref.tutorial", "3");
    localStorage.setItem("kontorka.pref.muted", "1");
  }, videoSave(now));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${server.port}/?platform=local`);
  await page.waitForSelector("#loader", { state: "detached", timeout: 30_000 });
  // Разгон: записка Хозяина появляется на 60-й секунде игры — подводим время к ней
  await page.clock.runFor(55_000);

  const ff = ffmpegPath;
  if (!ff) throw new Error("ffmpeg-static не нашёл ffmpeg для этой системы");
  const outFile = join(OUT, "video-1920x1080-ru.mp4");
  const enc = Bun.spawn(
    [
      ff,
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-c:v",
      "mjpeg",
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outFile,
    ],
    { stdin: "pipe", stderr: "inherit" },
  );

  let floor = 0;
  let drag: Drag | null = null;
  let si = 0;
  const total = SECONDS * FPS;
  for (let frame = 0; frame < total; frame++) {
    // Действия сценария на этом кадре
    while (si < SCRIPT.length && (SCRIPT[si]?.[0] ?? Infinity) <= frame) {
      const step = SCRIPT[si]?.[1];
      si++;
      if (!step) continue;
      const desks = await desksOf(page, floor);
      const L = layout(desks.length);
      if (step.kind === "tap") {
        const d = step.desks.find((i) => (desks[i] ?? 0) > 0);
        if (d !== undefined) {
          const [x, y] = body(L, d);
          await page.mouse.click(x, y);
        }
      } else if (step.kind === "merge") {
        if (drag) continue;
        let pair: [number, number] | null = null;
        for (let i = 0; i < desks.length && !pair; i++) {
          for (let j = i + 1; j < desks.length; j++) {
            if ((desks[i] ?? 0) > 0 && desks[i] === desks[j] && (desks[i] ?? 0) < 10) {
              pair = [j, i];
              break;
            }
          }
        }
        if (pair) {
          drag = { from: body(L, pair[0]), to: body(L, pair[1]), frame: 0 };
          await page.mouse.move(drag.from[0], drag.from[1]);
          await page.mouse.down();
        }
      } else if (step.kind === "hire") {
        await page.click(".hire", { force: true });
      } else if (step.kind === "note") {
        await page.mouse.click(L.contentLeft + L.contentW - 46, HUD_TOP + 58);
      } else if (step.kind === "lift") {
        await page.click(`.lift-btn >> nth=${step.dir > 0 ? 1 : 0}`, { force: true });
        floor += step.dir;
      } else {
        await page.click(step.selector, { force: true });
      }
    }
    if (drag) {
      drag.frame++;
      const k = Math.min(1, drag.frame / DRAG_FRAMES);
      const e = k * k * (3 - 2 * k);
      await page.mouse.move(
        drag.from[0] + (drag.to[0] - drag.from[0]) * e,
        drag.from[1] + (drag.to[1] - drag.from[1]) * e - Math.sin(k * Math.PI) * 40,
      );
      if (k >= 1) {
        await page.mouse.up();
        drag = null;
      }
    }

    // Игровое время — ровно один кадр; CSS-анимации — по тем же часам
    await page.clock.runFor(1000 / FPS);
    await page.evaluate(() => {
      const t = performance.now();
      for (const a of document.getAnimations()) {
        const tagged = a as Animation & { t0?: number };
        if (tagged.t0 === undefined) {
          tagged.t0 = t;
          a.pause();
        }
        a.currentTime = t - tagged.t0;
      }
    });
    const jpeg = await page.screenshot({ type: "jpeg", quality: 92 });
    await enc.stdin.write(jpeg);
    if (frame % FPS === 0) process.stdout.write(`\rкадр ${frame}/${total}`);
  }
  await enc.stdin.end();
  const code = await enc.exited;
  process.stdout.write("\n");
  if (code !== 0) throw new Error(`ffmpeg завершился с кодом ${code}`);
  if (errors.length > 0) throw new Error(`ошибки на странице: ${errors.join("; ")}`);
  const size = (await stat(outFile)).size;
  console.log(`✅ ${outFile}: ${SECONDS} с, ${(size / 1024 / 1024).toFixed(1)} МБ`);
} finally {
  await browser.close();
  void server.stop(true);
}
