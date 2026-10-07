/**
 * `bun run smoke` — смоук-тест собранной игры в эмуляции телефона (Playwright + Chromium).
 * Играет за игрока: тапает, нанимает, перетаскивает одинаковых батраканов друг на друга,
 * проверяет по сохранению, что ранги растут, что нет ошибок в консоли, и снимает скриншоты.
 * Координаты столов считает та же функция раскладки, что и игра — отладочные крючки в коде не нужны.
 */
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, devices, type Page } from "playwright";
import atlas from "../assets/atlas.json";
import { BALANCE } from "../src/data/balance";
import { computeLayout, type Layout } from "../src/game/layout";

const DIST = "dist";
const SHOTS = join("docs", "img");
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
    const file = join(DIST, path);
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

interface Saved {
  desks: number[];
  kukishi: number;
  maxRank: number;
}

interface SaveV2 {
  floors: { desks: number[] }[];
  kukishi: number;
  cards: number[];
}

const errors: string[] = [];
const result = { failed: false };
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? "✅" : "❌"} ${what}`);
  if (!ok) result.failed = true;
};

/** Сохранение v2 → то, что проверяет смоук: столы первого этажа, кукиши, максимальный достигнутый ранг. */
async function readSave(page: Page): Promise<Saved> {
  const raw = await page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    const text = localStorage.getItem("kontorka.save");
    if (!text) throw new Error("нет сохранения");
    return JSON.parse(text) as SaveV2;
  });
  const cards = raw.cards[0] ?? 0;
  return {
    desks: raw.floors[0]?.desks ?? [],
    kukishi: raw.kukishi,
    maxRank: 32 - Math.clz32(cards),
  };
}

function layoutFor(page: Page): Layout {
  const vp = page.viewportSize();
  if (!vp) throw new Error("нет viewport");
  const desk = atlas.frames.desk;
  return computeLayout(vp.width, vp.height, BALANCE.desksStart, BALANCE.desksMax, {
    deskW: desk[2] ?? 129,
    deskTop: desk[5] ?? 91,
    charTop: atlas.frames.b5_idle_0[5] ?? 150,
  });
}

/** Точка на теле батракана: чуть выше столешницы. */
function body(L: Layout, desk: number): [number, number] {
  return [L.deskX[desk] ?? 0, (L.deskY[desk] ?? 0) - 110 * L.scale];
}

async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(
      from[0] + ((to[0] - from[0]) * k) / 8,
      from[1] + ((to[1] - from[1]) * k) / 8,
    );
  }
  await page.mouse.up();
}

const browser = await chromium.launch({
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
try {
  await mkdir(SHOTS, { recursive: true });
  const phone = devices["Pixel 7"];
  const ctx = await browser.newContext({ ...phone, locale: "ru-RU" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  const t0 = Date.now();
  await page.goto(`http://localhost:${server.port}/`);
  await page.waitForSelector("#loader", { state: "detached", timeout: 15_000 });
  console.log(`Загрузка до интерактива (локально, без троттлинга): ${Date.now() - t0} мс`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, "phase5-1-start.png"), scale: "css" });
  check(
    (await page.textContent(".hint")) === "Колупай циферки!",
    "подсказка первого действия на русском",
  );
  const hintBox = await page.locator(".hint").boundingBox();
  check(
    hintBox !== null && hintBox.y >= 60 && hintBox.y + hintBox.height < 915,
    "подсказка видна на экране, не под панелью",
  );

  const L = layoutFor(page);
  // 1. Тапаем стажёра
  for (let i = 0; i < 8; i++) await page.touchscreen.tap(...body(L, 0));
  await page.waitForTimeout(300);
  let s = await readSave(page);
  check(s.kukishi >= 5, `тапы приносят кукиши (${Math.floor(s.kukishi)})`);

  // 2. Нанимаем второго
  await page.click(".hire", { force: true });
  await page.waitForTimeout(500);
  s = await readSave(page);
  check(s.desks.filter((r) => r > 0).length === 2, "найм: за вторым столом появился батракан");
  await page.screenshot({ path: join(SHOTS, "phase5-2-hired.png"), scale: "css" });

  // 3. Сливаем двух стажёров
  await drag(page, body(L, 1), body(L, 0));
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(SHOTS, "phase5-3-merge.png"), scale: "css" });
  s = await readSave(page);
  check(s.maxRank === 2 && s.desks.includes(2), "слияние: стажёры стали батраканом (ранг 2)");
  check((await page.locator(".toast").count()) > 0, "тост «Новый ранг» показан");

  // 4. Играем дальше: копим, нанимаем, сливаем пары. Темп проверяет тест баланса, здесь — что цикл работает
  for (let round = 0; round < 60 && s.maxRank < 3; round++) {
    for (let i = 0; i < 6; i++) {
      const d = s.desks.findIndex((r) => r > 0);
      await page.touchscreen.tap(...body(L, d));
    }
    await page.click(".hire", { force: true });
    await page.waitForTimeout(120);
    s = await readSave(page);
    const byRank = new Map<number, number>();
    for (let i = 0; i < BALANCE.desksStart; i++) {
      const r = s.desks[i] ?? 0;
      if (r === 0) continue;
      const other = byRank.get(r);
      if (other !== undefined) {
        await drag(page, body(L, i), body(L, other));
        await page.waitForTimeout(120);
        s = await readSave(page);
        break;
      }
      byRank.set(r, i);
    }
  }
  check(s.maxRank >= 3, `цикл «копи → найми → слей» доводит до ранга ${s.maxRank}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SHOTS, "phase5-4-progress.png"), scale: "css" });

  // 5. Перезагрузка: прогресс на месте
  await page.reload();
  await page.waitForSelector("#loader", { state: "detached", timeout: 15_000 });
  const after = await readSave(page);
  check(after.maxRank === s.maxRank, "после перезагрузки прогресс сохранился");

  // 6. Время до интерактива на «медленном 4G» и слабом процессоре (профиль мобильного Lighthouse)
  const slow = await browser.newContext({ ...phone, locale: "ru-RU" });
  const slowPage = await slow.newPage();
  const cdp = await slow.newCDPSession(slowPage);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const ts = Date.now();
  await slowPage.goto(`http://localhost:${server.port}/`);
  await slowPage.waitForSelector("#loader", { state: "detached", timeout: 30_000 });
  const tti = Date.now() - ts;
  check(tti <= 3000, `время до интерактива на slow 4G + CPU×4: ${tti} мс (цель ≤ 3000)`);
  await slow.close();

  // 7. Маленький телефон
  const small = await browser.newContext({ ...devices["iPhone SE"], locale: "ru-RU" });
  const spage = await small.newPage();
  spage.on("pageerror", (e) => errors.push(`pageerror(small): ${e.message}`));
  await spage.goto(`http://localhost:${server.port}/`);
  await spage.waitForSelector("#loader", { state: "detached", timeout: 15_000 });
  await spage.waitForTimeout(400);
  await spage.screenshot({ path: join(SHOTS, "phase5-6-small-phone.png"), scale: "css" });
  check(
    (await spage.textContent(".money-income")) === "+1/с",
    "HUD сразу показывает доход (нет гонки подписки UI)",
  );

  // 8. Десктоп, английский язык
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  });
  const dpage = await desk.newPage();
  dpage.on("pageerror", (e) => errors.push(`pageerror(desktop): ${e.message}`));
  await dpage.goto(`http://localhost:${server.port}/`);
  await dpage.waitForSelector("#loader", { state: "detached", timeout: 15_000 });
  await dpage.waitForTimeout(400);
  check(
    (await dpage.textContent(".hire-label")) === "Hire a Workroach",
    "английский интерфейс на en-US",
  );
  await dpage.screenshot({ path: join(SHOTS, "phase5-5-desktop-en.png") });

  check(
    errors.length === 0,
    `нет ошибок в консоли${errors.length ? ":\n  " + errors.join("\n  ") : ""}`,
  );
} finally {
  await browser.close();
  void server.stop(true);
}

if (result.failed) process.exit(1);
