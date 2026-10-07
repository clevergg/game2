/**
 * `bun run promo` — промо-материалы для страницы игры в Яндекс Играх, всё генерируется кодом:
 *  - иконка 512×512 PNG и обложки 800×470 PNG (ru/en) — рисуются на канвасе из настоящего атласа;
 *  - скриншоты настоящей игры (ru/en): телефон 1080×1920 (9:16) и ПК 1920×1080 (16:9), JPEG.
 * Требования к размерам — docs/publishing.md §2. Результат — в release/promo/ (не коммитится),
 * превью для документации — в docs/img/promo-*.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { chromium, type BrowserContextOptions, type Page } from "playwright";
import { startDay } from "../src/core/live";
import { toSave } from "../src/core/save";
import { addKukishi, createState, recomputeIncome } from "../src/core/state";
import { encodeRgbPng } from "./assets/lib/png";
import { zip } from "./pack/zip";

const OUT = join("release", "promo");
const DOCS = join("docs", "img");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".json": "application/json",
};

// Сервер: собранная игра в корне, атлас из assets/ — по /assets/
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = normalize(new URL(req.url).pathname).replace(/^[/\\]+/, "");
    const file = url.startsWith("assets") ? url : join("dist", url || "index.html");
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
const base = `http://localhost:${server.port}`;

// ——— Иконка и обложки ———

interface Art {
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly lang: "ru" | "en" | "";
}

const TITLES = {
  ru: ["КОНТОРКА:", "БАТРАКАНЫ", "Найми. Слей. Дорасти до Хозяина!"],
  en: ["KONTORKA:", "WORKROACHES", "Hire. Merge. Climb to the Boss!"],
} as const;

/** Рисует картинку в странице и возвращает RGBA (base64). Код выполняется в Chromium. */
async function drawArt(page: Page, art: Art): Promise<Uint8Array> {
  const title = art.lang === "" ? null : TITLES[art.lang];
  const b64 = await page.evaluate(
    async ({ art, title }) => {
      type Frame = [number, number, number, number, number, number, number];
      const json = (await (await fetch("/assets/atlas.json")).json()) as {
        sheets: { image: string }[];
        frames: Record<string, Frame>;
      };
      const sheets = await Promise.all(
        json.sheets.map(async (s) => {
          const img = new Image();
          img.src = `/assets/${s.image}`;
          await img.decode();
          return img;
        }),
      );
      const c = document.createElement("canvas");
      c.width = art.w;
      c.height = art.h;
      const g = c.getContext("2d");
      if (!g) throw new Error("нет 2d");
      g.imageSmoothingEnabled = false;
      const frame = (name: string): Frame => {
        const f = json.frames[name];
        if (!f) throw new Error(`нет кадра ${name}`);
        return f;
      };
      const sprite = (name: string, x: number, y: number, k: number): void => {
        const [fx, fy, fw, fh, ax, ay, sh] = frame(name);
        const img = sheets[sh];
        if (!img) return;
        g.drawImage(
          img,
          fx,
          fy,
          fw,
          fh,
          Math.round(x - ax * k),
          Math.round(y - ay * k),
          fw * k,
          fh * k,
        );
      };
      const tiles = (
        name: string,
        x0: number,
        y0: number,
        w: number,
        h: number,
        k: number,
      ): void => {
        const [, , fw, fh] = frame(name);
        for (let y = y0; y < y0 + h; y += fh * k) {
          for (let x = x0; x < x0 + w; x += fw * k) sprite(name, x, y, k);
        }
      };

      if (art.lang === "") {
        // Иконка: золотой батракан за столом на тёплом фоне, вокруг летят кукиши
        tiles("f0_floor", 0, 0, art.w, art.h, 2);
        const bg = g.createRadialGradient(
          art.w / 2,
          art.h * 0.45,
          40,
          art.w / 2,
          art.h / 2,
          art.w * 0.75,
        );
        bg.addColorStop(0, "rgba(255,240,160,0.95)");
        bg.addColorStop(0.55, "rgba(255,208,72,0.92)");
        bg.addColorStop(1, "rgba(240,127,42,0.95)");
        g.fillStyle = bg;
        g.fillRect(0, 0, art.w, art.h);
        // Батракан крупно: высота от якоря до макушки — 85% иконки
        const top = frame("f0_b10_joy_0")[5];
        const k = (art.h * 0.85) / top;
        const coins: [number, number, number][] = [
          [62, 120, 0.8],
          [452, 150, 0.9],
          [80, 330, 0.7],
          [440, 360, 0.75],
        ];
        for (const [x, y, s] of coins) sprite("icon_kukish", x, y, s);
        sprite("f0_desk", art.w / 2, art.h * 0.99, k);
        sprite("f0_b10_joy_0", art.w / 2, art.h * 0.99, k);
      } else if (title) {
        // Обложка: офис, справа батраканы трёх этажей, слева название
        tiles("f0_wall", 0, 0, art.w, 192, 2);
        tiles("f0_floor", 0, 180, art.w, art.h, 2);
        const shade = g.createLinearGradient(0, 0, art.w, 0);
        shade.addColorStop(0, "rgba(28,22,32,0.78)");
        shade.addColorStop(0.5, "rgba(28,22,32,0.35)");
        shade.addColorStop(0.75, "rgba(28,22,32,0)");
        g.fillStyle = shade;
        g.fillRect(0, 0, art.w, art.h);
        const row: [string, string, number][] = [
          ["f1_desk", "f1_b9_joy_0", art.w * 0.66],
          ["f2_desk", "f2_b8_work_0", art.w * 0.95],
          ["f0_desk", "f0_b10_joy_0", art.w * 0.8],
        ];
        for (const [desk, who, x] of row) {
          const y = who.startsWith("f0") ? art.h * 0.98 : art.h * 0.78;
          const k = who.startsWith("f0") ? 1.7 : 1.35;
          sprite(desk, x, y, k);
          sprite(who, x, y, k);
        }
        const font = (px: number): string =>
          `900 ${px}px "Arial Black", "Segoe UI Black", "DejaVu Sans", sans-serif`;
        const text = (s: string, x: number, y: number, px: number, fill: string): void => {
          g.font = font(px);
          g.lineJoin = "round";
          g.lineWidth = Math.max(4, px / 6);
          g.strokeStyle = "#1c1620";
          g.strokeText(s, x, y);
          g.fillStyle = fill;
          g.fillText(s, x, y);
        };
        const big = Math.round(art.h * 0.15);
        text(title[0], 34, art.h * 0.3, big, "#fffaf0");
        text(title[1], 34, art.h * 0.3 + big * 1.05, big, "#ffd048");
        text(
          title[2],
          36,
          art.h * 0.3 + big * 1.05 + big * 0.75,
          Math.round(big * 0.36),
          "#fffaf0",
        );
        sprite("icon_kukish", 34 + big * 0.4, art.h * 0.86, 1.3);
      }
      const data = g.getImageData(0, 0, art.w, art.h).data;
      let s = "";
      for (let i = 0; i < data.length; i += 0x8000) {
        s += String.fromCharCode(...data.subarray(i, i + 0x8000));
      }
      return btoa(s);
    },
    { art, title },
  );
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// ——— Скриншоты игры ———

/** Сохранение «середины игры»: три этажа, разные ранги, план смены наполовину. */
function midGameSave(now: number, day: number): string {
  const s = createState();
  s.floorsUnlocked = 3;
  s.seniority = 14;
  s.stamps = 6;
  s.perks[1] = 1;
  for (let fi = 0; fi < 3; fi++) {
    const f = s.floors[fi];
    if (!f) continue;
    f.deskCount = 9 + fi;
    const ranks = [
      [10, 8, 7, 7, 6, 5, 4, 3, 2],
      [9, 8, 6, 6, 5, 4, 3, 3, 2, 1],
      [8, 7, 7, 6, 5, 5, 4, 3, 2, 1, 1],
    ][fi];
    // Последний стол свободен — на кнопке найма видна цена, а не «Нет мест»
    ranks?.slice(0, f.deskCount - 1).forEach((r, i) => (f.desks[i] = r));
    f.rare[1] = 1;
    f.qual = 3;
    f.equip = 5;
    s.cards[fi] = (1 << (10 - fi)) - 1;
    s.rareCards[fi] = 0b10010;
  }
  recomputeIncome(s);
  addKukishi(s, s.incomePerSec * 1500);
  s.earnedThisRun = s.totalEarned;
  startDay(s, day);
  s.live.avansDay = day;
  s.live.avansStreak = 4;
  // План смены «наколупай» выполнен на 60%
  s.live.shiftType = 0;
  s.live.shiftTarget = Math.floor(s.incomePerSec * 240);
  s.live.shiftBase = s.totalEarned - s.live.shiftTarget * 0.6;
  s.live.shiftWait = 0;
  return JSON.stringify(toSave(s, now));
}

const MSK_OFFSET_MIN = -180;
const dayNow = (): number => Math.floor((Date.now() - MSK_OFFSET_MIN * 60_000) / 86_400_000);

interface Shot {
  readonly id: string;
  readonly floor: number;
  readonly panel?: "alesya" | "cards" | "tasks";
}

const SHOTS: readonly Shot[] = [
  { id: "1-accounting", floor: 0 },
  { id: "2-warehouse", floor: 1 },
  { id: "3-design", floor: 2 },
  { id: "4-alesya", floor: 0, panel: "alesya" },
  { id: "5-tasks", floor: 0, panel: "tasks" },
];

const DEVICES: Record<"mobile" | "desktop", BrowserContextOptions> = {
  // 360×640 × 3 = 1080×1920 (9:16); 1280×720 × 1,5 = 1920×1080 (16:9)
  mobile: {
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 },
};

async function screenshots(lang: "ru" | "en", device: "mobile" | "desktop"): Promise<string[]> {
  const written: string[] = [];
  for (const shot of SHOTS) {
    // Свежее сохранение на каждый снимок: иначе через минуту всплывёт окно отгула
    const save = midGameSave(Date.now(), dayNow());
    if (device === "desktop" && shot.panel === "tasks") continue;
    const ctx = await browser.newContext({
      ...DEVICES[device],
      locale: lang === "ru" ? "ru-RU" : "en-US",
      timezoneId: "Europe/Moscow",
    });
    await ctx.addInitScript((data) => {
      localStorage.setItem("kontorka.save", data);
      localStorage.setItem("kontorka.pref.tutorial", "3");
      localStorage.setItem("kontorka.pref.muted", "1");
    }, save);
    const page = await ctx.newPage();
    await page.goto(`${base}/?platform=local`);
    await page.waitForSelector("#loader", { state: "detached", timeout: 15_000 });
    for (let f = 0; f < shot.floor; f++) {
      await page.click(".lift-btn >> nth=1");
      await page.waitForTimeout(700);
    }
    if (shot.panel === "tasks") {
      await page.click(".side-btn >> nth=1");
    } else if (shot.panel) {
      await page.click(".side-btn >> nth=0");
      await page.click(`.tab >> nth=${shot.panel === "alesya" ? 1 : 2}`);
    } else {
      // Немного «сока»: тапы дают всплывающие кукиши и цифры
      const box = await page.locator("#stage").boundingBox();
      if (box) {
        for (let i = 0; i < 6; i++) {
          await page.mouse.click(
            box.x + box.width * (0.3 + (i % 2) * 0.4),
            box.y + box.height * 0.45,
          );
          await page.waitForTimeout(90);
        }
      }
    }
    await page.waitForTimeout(500);
    const name = join(OUT, "screens", `${lang}-${device}-${shot.id}.jpg`);
    await page.screenshot({ path: name, type: "jpeg", quality: 90 });
    written.push(name);
    await ctx.close();
  }
  return written;
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  await mkdir(join(OUT, "screens"), { recursive: true });
  await mkdir(DOCS, { recursive: true });
  const page = await browser.newPage();
  await page.goto(`${base}/assets/atlas.json`);
  const arts: Art[] = [
    { name: "icon-512.png", w: 512, h: 512, lang: "" },
    { name: "cover-800x470-ru.png", w: 800, h: 470, lang: "ru" },
    { name: "cover-800x470-en.png", w: 800, h: 470, lang: "en" },
  ];
  for (const art of arts) {
    const png = encodeRgbPng(art.w, art.h, await drawArt(page, art));
    await writeFile(join(OUT, art.name), png);
    await writeFile(join(DOCS, `promo-${art.name}`), png);
    console.log(`✅ ${join(OUT, art.name)} ${(png.length / 1024).toFixed(0)} КБ`);
  }
  for (const lang of ["ru", "en"] as const) {
    for (const device of ["mobile", "desktop"] as const) {
      const files = await screenshots(lang, device);
      console.log(`✅ скриншоты ${lang}/${device}: ${files.length}`);
    }
  }
  // Всё промо одним архивом — удобно скачать и загрузить в консоль
  const entries = [];
  for (const name of (await readdir(OUT, { recursive: true })).sort()) {
    const file = join(OUT, name);
    if ((await stat(file)).isFile() && !name.endsWith(".zip")) {
      entries.push({ name: name.split(sep).join("/"), data: await readFile(file) });
    }
  }
  await writeFile(join("release", "kontorka-promo.zip"), zip(entries));
  console.log(`✅ release/kontorka-promo.zip: ${entries.length} файлов`);
} finally {
  await browser.close();
  void server.stop(true);
}
