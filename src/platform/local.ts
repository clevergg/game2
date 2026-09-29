/**
 * Платформа без SDK: локальный запуск, dev-режим и запасной вариант, если SDK Яндекса недоступен.
 * localStorage может быть запрещён (приватный режим, политика браузера) — тогда игра просто не сохраняется.
 */
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

export function createLocalPlatform(): Platform {
  return {
    kind: "local",
    lang: navigator.language,
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
  };
}
