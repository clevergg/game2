/**
 * `bun run smoke:sdk` — матрица отказов платформы на собранной игре (Playwright, эмуляция телефона).
 * Вместо настоящего `/sdk.js` сервер отдаёт поддельный SDK Яндекса в разных режимах:
 *  - ok:     всё работает — LoadingAPI.ready, GameplayAPI, реклама, облако, лидерборд, внешняя пауза;
 *  - hang:   YaGames.init() не отвечает — через 3 с игра стартует локально;
 *  - broken: init работает, но реклама, игрок и лидерборд бросают ошибки — игра не падает.
 * Режим «SDK нет вообще» (404) проверяет основной `bun run smoke`.
 */
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, devices, type Page } from "playwright";

const DIST = "dist";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};

type Mode = "ok" | "hang" | "broken";
let mode: Mode = "ok";

/** Поддельный SDK. Всё, что вызвала игра, складывается в window.__ya для проверок. */
function fakeSdk(m: Mode): string {
  return `
(() => {
  const ya = (window.__ya = { ready: 0, start: 0, stop: 0, cloud: null, flushes: 0, scores: [], handlers: {}, ads: 0 });
  ya.fire = (name) => (ya.handlers[name] || []).forEach((fn) => fn());
  const broken = ${JSON.stringify(m === "broken")};
  const fail = () => { throw new Error("sdk broken"); };
  const sdk = {
    environment: { i18n: { lang: "ru" } },
    features: {
      LoadingAPI: { ready: () => { ya.ready++; } },
      GameplayAPI: { start: () => { ya.start++; }, stop: () => { ya.stop++; } },
    },
    adv: {
      showFullscreenAdv: broken ? fail : ({ callbacks }) => {
        ya.ads++;
        callbacks.onOpen && callbacks.onOpen();
        setTimeout(() => callbacks.onClose && callbacks.onClose(true), 300);
      },
      showRewardedVideo: broken
        ? ({ callbacks }) => setTimeout(() => callbacks.onError && callbacks.onError(new Error("no fill")), 100)
        : ({ callbacks }) => {
            ya.ads++;
            callbacks.onOpen && callbacks.onOpen();
            setTimeout(() => { callbacks.onRewarded && callbacks.onRewarded(); callbacks.onClose && callbacks.onClose(); }, 300);
          },
    },
    leaderboards: {
      setScore: broken ? () => Promise.reject(new Error("lb")) : (name, score) => { ya.scores.push([name, score]); return Promise.resolve(); },
      getEntries: () => broken ? Promise.reject(new Error("lb")) : Promise.resolve({
        userRank: 2,
        entries: [
          { rank: 1, score: 9900, player: { publicName: "Тося", uniqueID: "a" } },
          { rank: 2, score: 101, player: { publicName: "", uniqueID: "me" } },
        ],
      }),
    },
    auth: { openAuthDialog: () => Promise.resolve() },
    getPlayer: () => broken ? Promise.reject(new Error("player")) : Promise.resolve({
      getData: () => Promise.resolve(ya.cloud ? { save: ya.cloud } : {}),
      setData: (data, flush) => { ya.cloud = data.save; if (flush) ya.flushes++; return Promise.resolve(); },
      isAuthorized: () => false,
      getUniqueID: () => "me",
    }),
    isAvailableMethod: () => Promise.resolve(!broken),
    on: (name, fn) => { (ya.handlers[name] = ya.handlers[name] || []).push(fn); return () => {}; },
    serverTime: () => Date.now(),
  };
  window.YaGames = { init: () => ${m === "hang" ? "new Promise(() => {})" : "Promise.resolve(sdk)"} };
})();`;
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = normalize(new URL(req.url).pathname).replace(/^[/\\]+/, "") || "index.html";
    if (path === "sdk.js") {
      return new Response(fakeSdk(mode), { headers: { "content-type": "text/javascript" } });
    }
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

const result = { failed: false };
const check = (ok: boolean, what: string): void => {
  console.log(`${ok ? "✅" : "❌"} ${what}`);
  if (!ok) result.failed = true;
};

interface YaState {
  ready: number;
  start: number;
  stop: number;
  cloud: string | null;
  flushes: number;
  scores: [string, number][];
  ads: number;
}
const ya = (page: Page): Promise<YaState> =>
  page.evaluate(() => (window as unknown as { __ya: YaState }).__ya);
const kukishi = async (page: Page): Promise<number> =>
  page.evaluate(() => {
    window.dispatchEvent(new Event("pagehide"));
    const raw = localStorage.getItem("kontorka.save");
    return raw ? (JSON.parse(raw) as { kukishi: number }).kukishi : -1;
  });

const browser = await chromium.launch({
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
try {
  async function open(m: Mode): Promise<{ page: Page; errors: string[]; ms: number }> {
    mode = m;
    const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "ru-RU" });
    // Обучение пройдено, чтобы не мешали подсказки
    await ctx.addInitScript(() => {
      localStorage.setItem("kontorka.pref.tutorial", "3");
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    const t0 = Date.now();
    // На localhost игра SDK не ищет — включаем путь Яндекса явно
    await page.goto(`http://localhost:${server.port}/?platform=yandex`);
    await page.waitForSelector("#loader", { state: "detached", timeout: 15_000 });
    const ms = Date.now() - t0;
    await page.waitForTimeout(400);
    return { page, errors, ms };
  }

  // 1. SDK работает
  {
    const { page, errors } = await open("ok");
    let s = await ya(page);
    check(s.ready === 1, "ok: LoadingAPI.ready вызван один раз");
    check(s.start >= 1, "ok: GameplayAPI.start вызван");
    // Аванс на старте дня — закрываем
    if ((await page.locator(".modal .btn.gold").count()) > 0) await page.click(".modal .btn.gold");
    await page.waitForTimeout(200);

    const before = await kukishi(page);
    await page.evaluate(() => {
      (window as unknown as { __ya: { fire(n: string): void } }).__ya.fire("game_api_pause");
    });
    await page.waitForTimeout(1500);
    const paused = await kukishi(page);
    check(
      paused - before <= 2,
      `ok: game_api_pause останавливает игру (+${paused - before} за 1,5 с)`,
    );
    await page.evaluate(() => {
      (window as unknown as { __ya: { fire(n: string): void } }).__ya.fire("game_api_resume");
    });
    await page.waitForTimeout(1500);
    check((await kukishi(page)) > paused, "ok: game_api_resume возобновляет игру");

    await page.click(".buff-btn >> nth=0");
    await page.click(".modal .btn.gold");
    await page.waitForTimeout(900);
    s = await ya(page);
    check(s.ads === 1, "ok: показан rewarded через SDK");
    check((await page.locator(".buff-btn.active").count()) === 1, "ok: награда за rewarded выдана");
    check(s.stop >= 1, "ok: на время рекламы GameplayAPI.stop");

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Принудительная запись может быть отложена ограничителем (не чаще раза в 15 с), но не теряется
    const flushes = s.flushes;
    for (let i = 0; i < 40 && (await ya(page)).flushes === flushes; i++) {
      await page.waitForTimeout(500);
    }
    s = await ya(page);
    check(
      s.flushes > flushes && s.cloud !== null,
      "ok: при сворачивании сохранение уходит в облако (flush)",
    );
    check(
      s.scores.some(([n]) => n === "career"),
      "ok: счёт отправлен в лидерборд «career»",
    );

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.click(".side-btn >> nth=0");
    await page.click(".tab >> nth=3");
    await page.waitForTimeout(500);
    check((await page.locator(".board-row").count()) === 2, "ok: доска почёта показывает записи");
    check(errors.length === 0, `ok: нет ошибок${errors.length ? ": " + errors.join("; ") : ""}`);
    await page.context().close();
  }

  // 2. init завис
  {
    const { page, errors, ms } = await open("hang");
    check(ms < 6000, `hang: игра стартовала локально через ${ms} мс (таймаут SDK 3 с)`);
    check((await page.textContent(".money-income")) !== null, "hang: HUD работает");
    check(errors.length === 0, `hang: нет ошибок${errors.length ? ": " + errors.join("; ") : ""}`);
    await page.context().close();
  }

  // 3. SDK сломан
  {
    const { page, errors } = await open("broken");
    if ((await page.locator(".modal .btn.gold").count()) > 0) await page.click(".modal .btn.gold");
    await page.click(".buff-btn >> nth=0");
    await page.click(".modal .btn.gold");
    await page.waitForTimeout(600);
    check(
      (await page.textContent(".toast-title")) === "Реклама сейчас недоступна",
      "broken: ошибка rewarded → честное сообщение, награды нет",
    );
    check(
      (await page.locator(".buff-btn.active").count()) === 0,
      "broken: бафф не выдан без рекламы",
    );
    await page.click(".modal .close-btn");
    await page.click(".side-btn >> nth=0");
    await page.click(".tab >> nth=3");
    await page.waitForTimeout(500);
    check(
      (await page.locator(".board-row").count()) === 0,
      "broken: доска почёта недоступна без падения",
    );
    check(
      errors.length === 0,
      `broken: нет ошибок${errors.length ? ": " + errors.join("; ") : ""}`,
    );
    await page.context().close();
  }
} finally {
  await browser.close();
  void server.stop(true);
}

if (result.failed) process.exit(1);
