import { startGame } from "./game/app";
import { detectLang, setLang, t } from "./i18n";
import { createLocalPlatform } from "./platform/local";

function el<T extends HTMLElement>(id: string, type: new () => T): T {
  const e = document.getElementById(id);
  if (!(e instanceof type)) throw new Error(`#${id} не найден`);
  return e;
}

/** Имитация рекламы: при локальном запуске (не во фрейме Яндекса) или по `?fakeAds=1`. */
const fakeAds =
  window.self === window.top || new URLSearchParams(location.search).get("fakeAds") === "1";
const platform = createLocalPlatform(fakeAds);
const loader = document.getElementById("loader");

startGame(platform, el("stage", HTMLCanvasElement), el("ui", HTMLDivElement))
  .then(() => {
    loader?.remove();
  })
  .catch((e: unknown) => {
    console.error(e);
    setLang(detectLang(platform.lang));
    if (loader) {
      loader.textContent = t("error");
      loader.classList.add("failed");
    }
  });
