/**
 * Платформа Яндекс Игр. SDK грузится динамически с относительного пути `/sdk.js` (его отдаёт
 * хостинг Яндекса) с таймаутом; если SDK не загрузился — игра стартует на LocalPlatform.
 * Каждый вызов SDK обёрнут: ошибка платформы никогда не роняет игру.
 * Типы — минимальное подмножество API (сверено с @types/ysdk 1.2.0 и документацией, docs/phase7.md).
 */
import { pickNewest, Throttle } from "./cloud";
import { createLocalPlatform } from "./local";
import type { Leaderboard, Platform } from "./platform";

interface YPlayer {
  getData(keys?: readonly string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  isAuthorized(): boolean;
  getUniqueID(): string;
}

interface YEntry {
  rank: number;
  score: number;
  player: { publicName: string; uniqueID: string };
}

interface YSdk {
  environment: { i18n: { lang: string } };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(opts: {
      callbacks: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (e: unknown) => void;
        onOffline?: () => void;
      };
    }): void;
    showRewardedVideo(opts: {
      callbacks: {
        onOpen?: () => void;
        onRewarded?: () => void;
        onClose?: () => void;
        onError?: (e: unknown) => void;
      };
    }): void;
  };
  leaderboards?: {
    setScore(name: string, score: number): Promise<void>;
    getEntries(
      name: string,
      opts: { quantityTop: number; includeUser: boolean; quantityAround: number },
    ): Promise<{ entries: YEntry[]; userRank: number }>;
  };
  auth?: { openAuthDialog(): Promise<void> };
  getPlayer(): Promise<YPlayer>;
  isAvailableMethod(name: string): Promise<boolean>;
  on(event: "game_api_pause" | "game_api_resume", fn: () => void): unknown;
  serverTime(): number;
}

interface YaGamesGlobal {
  init(): Promise<YSdk>;
}

/** Техническое имя лидерборда — его нужно создать в консоли разработчика (docs/phase7.md). */
export const LEADERBOARD = "career";
const SDK_URL = "/sdk.js";
const SDK_TIMEOUT_MS = 3000;
const SAVE_KEY = "save";
/** Облако: обычная запись не чаще раза в минуту, принудительная — не чаще раза в 15 с (в худшем случае 20 записей за 5 минут). */
const CLOUD_GAP_MS = 60_000;
const CLOUD_FLUSH_GAP_MS = 15_000;
/** Лидерборд: лимит Яндекса — 60 запросов в минуту; мы шлём не чаще раза в 30 с. */
const SCORE_GAP_MS = 30_000;
/** Если SDK не вызвал ни одного колбэка рекламы — не держим игру на паузе вечно. */
const AD_SAFETY_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      resolve(null);
    }, ms);
    p.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      resolve(true);
    };
    s.onerror = () => {
      resolve(false);
    };
    document.head.appendChild(s);
  });
}

function yaGames(): YaGamesGlobal | null {
  const g = (window as unknown as { YaGames?: YaGamesGlobal }).YaGames;
  return g && typeof g.init === "function" ? g : null;
}

/** Пытается подключиться к Яндекс Играм; null — SDK недоступен (тогда играем локально). */
export async function createYandexPlatform(): Promise<Platform | null> {
  const sdk = await withTimeout(
    (async () => {
      if (!(await loadScript(SDK_URL))) return null;
      const ya = yaGames();
      return ya ? ya.init() : null;
    })(),
    SDK_TIMEOUT_MS,
  );
  if (!sdk) return null;
  return wrap(sdk);
}

async function wrap(sdk: YSdk): Promise<Platform> {
  // Локальная платформа — для настроек и как локальная копия сохранения
  const local = createLocalPlatform(false);
  let player = await withTimeout(sdk.getPlayer(), SDK_TIMEOUT_MS);
  const cloudThrottle = new Throttle(CLOUD_GAP_MS, CLOUD_FLUSH_GAP_MS);
  const scoreThrottle = new Throttle(SCORE_GAP_MS);
  let lastScore = -1;
  let pendingScore = -1;
  let gameplay = false;
  let lang = "ru";
  try {
    lang = sdk.environment.i18n.lang;
  } catch {
    // язык по умолчанию
  }
  const safe = (fn: () => void): void => {
    try {
      fn();
    } catch (e) {
      console.warn("Yandex SDK:", e);
    }
  };
  const available = async (method: string): Promise<boolean> =>
    (await withTimeout(sdk.isAvailableMethod(method), SDK_TIMEOUT_MS)) === true;

  let pendingSave: string | null = null;
  let saveTimer = 0;
  const sendCloud = async (flush: boolean): Promise<void> => {
    const data = pendingSave;
    if (!player || data === null || !cloudThrottle.ready(Date.now(), flush)) return;
    pendingSave = null;
    try {
      await player.setData({ [SAVE_KEY]: data }, flush);
    } catch (e) {
      console.warn("Облачное сохранение не удалось:", e);
    }
  };

  const flushScore = (): void => {
    if (pendingScore < 0 || pendingScore === lastScore || !sdk.leaderboards) return;
    if (!scoreThrottle.ready(Date.now(), false)) return;
    const score = pendingScore;
    void available("leaderboards.setScore").then((ok) => {
      if (!ok || !sdk.leaderboards) return;
      sdk.leaderboards.setScore(LEADERBOARD, score).then(
        () => {
          lastScore = score;
        },
        (e: unknown) => {
          console.warn("Лидерборд:", e);
        },
      );
    });
  };

  return {
    kind: "yandex",
    lang,
    now() {
      try {
        const t = sdk.serverTime();
        return Number.isFinite(t) && t > 0 ? t : Date.now();
      } catch {
        return Date.now();
      }
    },
    async loadSave() {
      const localRaw = await local.loadSave();
      if (!player) return localRaw;
      const data = await withTimeout(player.getData([SAVE_KEY]), SDK_TIMEOUT_MS);
      const cloud = data?.[SAVE_KEY];
      return pickNewest(localRaw, typeof cloud === "string" ? cloud : null);
    },
    async writeSave(data, flush) {
      await local.writeSave(data, flush);
      if (!player) return;
      pendingSave = data;
      const wait = cloudThrottle.wait(Date.now(), flush);
      if (wait > 0) {
        // Принудительную запись не теряем: отправим последнюю версию, как только можно
        if (flush && saveTimer === 0) {
          saveTimer = window.setTimeout(() => {
            saveTimer = 0;
            void sendCloud(true);
          }, wait);
        }
        return;
      }
      await sendCloud(flush);
    },
    getPref: (key) => local.getPref(key),
    setPref: (key, value) => {
      local.setPref(key, value);
    },
    gameReady() {
      safe(() => sdk.features.LoadingAPI?.ready());
    },
    gameplayStart() {
      if (gameplay) return;
      gameplay = true;
      safe(() => sdk.features.GameplayAPI?.start());
    },
    gameplayStop() {
      if (!gameplay) return;
      gameplay = false;
      safe(() => sdk.features.GameplayAPI?.stop());
    },
    onPause(handler) {
      safe(() => {
        sdk.on("game_api_pause", () => {
          handler(true);
        });
        sdk.on("game_api_resume", () => {
          handler(false);
        });
      });
    },
    showRewarded() {
      return new Promise<boolean>((resolve) => {
        let rewarded = false;
        let done = false;
        const finish = (): void => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          resolve(rewarded);
        };
        const timer = window.setTimeout(finish, AD_SAFETY_MS);
        try {
          sdk.adv.showRewardedVideo({
            callbacks: {
              onRewarded: () => {
                rewarded = true;
              },
              onClose: finish,
              onError: finish,
            },
          });
        } catch {
          finish();
        }
      });
    },
    showInterstitial() {
      return new Promise<boolean>((resolve) => {
        let done = false;
        const finish = (shown: boolean): void => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          resolve(shown);
        };
        const timer = window.setTimeout(() => {
          finish(false);
        }, AD_SAFETY_MS);
        try {
          sdk.adv.showFullscreenAdv({
            callbacks: {
              onClose: (wasShown) => {
                finish(wasShown);
              },
              onError: () => {
                finish(false);
              },
              onOffline: () => {
                finish(false);
              },
            },
          });
        } catch {
          finish(false);
        }
      });
    },
    submitScore(score) {
      if (!Number.isFinite(score) || score < 0) return;
      pendingScore = Math.floor(score);
      flushScore();
    },
    async getLeaderboard(): Promise<Leaderboard | null> {
      if (!sdk.leaderboards || !(await available("leaderboards.getEntries"))) return null;
      const res = await withTimeout(
        sdk.leaderboards.getEntries(LEADERBOARD, {
          quantityTop: 10,
          includeUser: true,
          quantityAround: 2,
        }),
        SDK_TIMEOUT_MS,
      );
      if (!res) return null;
      let me = "";
      try {
        me = player?.getUniqueID() ?? "";
      } catch {
        // без идентификатора просто не подсвечиваем себя
      }
      return {
        myRank: res.userRank,
        entries: res.entries.map((e) => ({
          rank: e.rank,
          name: e.player.publicName,
          score: e.score,
          me: me !== "" && e.player.uniqueID === me,
        })),
      };
    },
    canLogin: sdk.auth !== undefined,
    async login() {
      try {
        if (player?.isAuthorized() === true) return true;
        await sdk.auth?.openAuthDialog();
        player = await withTimeout(sdk.getPlayer(), SDK_TIMEOUT_MS);
        // Счёт, который не прошёл до входа, отправим заново
        lastScore = -1;
        flushScore();
        return player?.isAuthorized() === true;
      } catch {
        return false;
      }
    },
  };
}
