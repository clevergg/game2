import { startGame } from "./game/app";
import { detectLang, setLang, t } from "./i18n";
import { createLocalPlatform } from "./platform/local";
import type { Platform } from "./platform/platform";
import { createYandexPlatform } from "./platform/yandex";

function el<T extends HTMLElement>(id: string, type: new () => T): T {
  const e = document.getElementById(id);
  if (!(e instanceof type)) throw new Error(`#${id} не найден`);
  return e;
}

/**
 * Платформа: сначала пробуем SDK Яндекса (на хостинге Яндекса он отдаётся по `/sdk.js`),
 * при неудаче — локальная. Имитация рекламы — только при локальном запуске вне фрейма
 * или по `?fakeAds=1`; во фрейме без SDK реклама честно «недоступна».
 */
/** Локальный запуск: localhost или адрес домашней сети (телефон в той же Wi-Fi) не во фрейме. */
function isLocalRun(): boolean {
  const host = location.hostname;
  const lan = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  return (host === "" || lan) && window.self === window.top;
}

async function pickPlatform(): Promise<Platform> {
  const params = new URLSearchParams(location.search);
  const forced = params.get("platform");
  if (forced === "yandex" || (forced !== "local" && !isLocalRun())) {
    const ya = await createYandexPlatform();
    if (ya) return ya;
  }
  const fakeAds = window.self === window.top || params.get("fakeAds") === "1";
  return createLocalPlatform(fakeAds);
}

const loader = document.getElementById("loader");
let platform: Platform | null = null;

pickPlatform()
  .then((p) => {
    platform = p;
    return startGame(p, el("stage", HTMLCanvasElement), el("ui", HTMLDivElement));
  })
  .then(() => {
    loader?.remove();
  })
  .catch((e: unknown) => {
    console.error(e);
    setLang(detectLang(platform?.lang ?? navigator.language));
    if (loader) {
      loader.textContent = t("error");
      loader.classList.add("failed");
    }
  });
