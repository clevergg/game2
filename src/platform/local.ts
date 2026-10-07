/**
 * Платформа без SDK: локальный запуск, dev-режим и запасной вариант, если SDK Яндекса недоступен.
 * localStorage может быть запрещён (приватный режим, политика браузера) — тогда игра просто не сохраняется.
 */
import { t } from "../i18n";
import type { Platform } from "./platform";

const SAVE_KEY = "kontorka.save";
const PREF_PREFIX = "kontorka.pref.";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const FAKE_AD_MS = 1800;

/** Имитация рекламы для разработки: затемнение с надписью на пару секунд. */
function fakeAd(): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "fake-ad";
    el.textContent = t("adFake");
    document.body.appendChild(el);
    window.setTimeout(() => {
      el.remove();
      resolve(true);
    }, FAKE_AD_MS);
  });
}

/**
 * fakeAds — показывать имитацию рекламы (локальный запуск, `?fakeAds=1`).
 * Без неё реклама «недоступна»: так игра ведёт себя, если SDK Яндекса не загрузился.
 */
export function createLocalPlatform(fakeAds: boolean): Platform {
  return {
    kind: "local",
    lang: navigator.language,
    now: () => Date.now(),
    loadSave() {
      try {
        return Promise.resolve(storage()?.getItem(SAVE_KEY) ?? null);
      } catch {
        return Promise.resolve(null);
      }
    },
    writeSave(data) {
      try {
        storage()?.setItem(SAVE_KEY, data);
      } catch (e) {
        console.warn("Сохранение не удалось:", e);
      }
      return Promise.resolve();
    },
    getPref(key) {
      try {
        return storage()?.getItem(PREF_PREFIX + key) ?? null;
      } catch {
        return null;
      }
    },
    setPref(key, value) {
      try {
        storage()?.setItem(PREF_PREFIX + key, value);
      } catch {
        // настройки не критичны
      }
    },
    gameReady() {},
    gameplayStart() {},
    gameplayStop() {},
    showRewarded() {
      return fakeAds ? fakeAd() : Promise.resolve(false);
    },
    showInterstitial() {
      return fakeAds ? fakeAd() : Promise.resolve(false);
    },
    onPause() {},
    submitScore() {},
    getLeaderboard: () => Promise.resolve(null),
    login: () => Promise.resolve(false),
    canLogin: false,
  };
}
