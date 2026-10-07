/**
 * Сборка игры из слоёв: платформа → язык → атлас → состояние → сцена → UI → цикл.
 * Здесь же связь «ввод → команды core» и «события core → сцена/звук/UI».
 */
import { render, h } from "preact";
import atlasJson from "../../assets/atlas.json";
import atlasUrl from "../../assets/atlas.png";
import { BALANCE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";
import { currentHireCost, hire, move, tap, trash } from "../core/commands";
import { EV, EventQueue } from "../core/events";
import { fromSave, toSave } from "../core/save";
import { step } from "../core/sim";
import { createState, firstFreeDesk, type FloorState, type OfficeState } from "../core/state";
import { type AtlasJson, loadAtlas } from "../engine/atlas";
import { AudioPlayer } from "../engine/audio/player";
import { attachInput } from "../engine/input";
import { startLoop } from "../engine/loop";
import { FloatingNumbers, Particles } from "../engine/particles";
import { CanvasRenderer } from "../engine/renderer";
import { detectLang, numberLocale, setLang, t } from "../i18n";
import type { Platform } from "../platform/platform";
import { App } from "../ui/App";
import { INITIAL_UI, Store, type UiState } from "../ui/store";
import { computeLayout, HUD_TOP, type Layout } from "./layout";
import { OfficeScene } from "./scene";
import { nextStage, parseStage, TUTORIAL, type TutorialStage } from "./tutorial";

const AUTOSAVE_MS = 15_000;
const UI_PUBLISH_SEC = 0.1;

async function loadState(platform: Platform): Promise<OfficeState> {
  const raw = await platform.loadSave();
  if (!raw) return createState();
  try {
    return fromSave(JSON.parse(raw) as unknown) ?? createState();
  } catch {
    console.warn("Сохранение повреждено, начинаем заново");
    return createState();
  }
}

export async function startGame(
  platform: Platform,
  canvas: HTMLCanvasElement,
  uiRoot: HTMLElement,
): Promise<void> {
  setLang(detectLang(platform.lang));
  document.title = t("title");
  document.documentElement.lang = detectLang(platform.lang);

  const audio = new AudioPlayer();
  audio.prepare();
  audio.setMuted(platform.getPref("muted") === "1");

  const [atlas, state] = await Promise.all([
    loadAtlas(atlasUrl, atlasJson as AtlasJson),
    loadState(platform),
  ]);
  const renderer = new CanvasRenderer(canvas, atlas);
  const particles = new Particles(256);
  const numbers = new FloatingNumbers(atlas, ["gold", "green"], 64);
  numbers.setLocale(numberLocale());
  const queue = new EventQueue(256);
  const ui = new Store<UiState>({ ...INITIAL_UI, muted: audio.isMuted });

  const deskIdx = atlas.frame("desk");
  const charIdx = atlas.frame("b5_idle_0");
  const metrics = {
    deskW: atlas.w[deskIdx] ?? 129,
    deskTop: atlas.ay[deskIdx] ?? 91,
    charTop: atlas.ay[charIdx] ?? 150,
  };
  /** Этаж на экране; лифт переключает его (Фаза 6.6). */
  const viewFloor = 0;
  const makeLayout = (): Layout =>
    computeLayout(
      canvas.clientWidth,
      canvas.clientHeight,
      floorOf(state, viewFloor).deskCount,
      BALANCE.desksMax,
      metrics,
    );

  let stamps = 0;
  let toasts = 0;
  let denies = 0;
  let layout = makeLayout();
  const scene = new OfficeScene(atlas, renderer, particles, numbers, audio, state, layout, {
    stamp: (x, y) => {
      ui.set({ stamp: { id: ++stamps, x, y: Math.max(HUD_TOP + 48, y) } });
    },
    rankUnlocked: (rank) => {
      ui.set({ toast: { id: ++toasts, rank } });
    },
    denied: () => {
      ui.set({ denyId: ++denies });
    },
  });

  const resize = (): void => {
    renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    layout = makeLayout();
    scene.setLayout(layout);
  };
  window.addEventListener("resize", resize);
  resize();

  // ——— Сохранение ———
  const save = (flush: boolean): void => {
    void platform.writeSave(JSON.stringify(toSave(state, Date.now())), flush);
  };
  window.setInterval(() => {
    save(false);
  }, AUTOSAVE_MS);

  // ——— Подсказки первой сессии ———
  let stage: TutorialStage = parseStage(platform.getPref("tutorial"));
  const facts = { taps: 0, hires: 0, merges: 0 };
  const advanceTutorial = (): void => {
    const next = nextStage(stage, facts);
    if (next !== stage) {
      stage = next;
      platform.setPref("tutorial", String(stage));
    }
  };

  // ——— Ввод → команды ———
  const input = {
    tap: (x: number, y: number) => {
      audio.unlock();
      const desk = scene.hitDesk(x, y);
      if (desk >= 0 && tap(state, scene.floor, desk, queue) === 0) {
        facts.taps++;
        advanceTutorial();
      }
    },
    dragStart: (x: number, y: number) => {
      audio.unlock();
      const desk = scene.hitDesk(x, y);
      if (desk < 0) return false;
      scene.beginDrag(desk, x, y);
      ui.set({ dragging: true });
      return true;
    },
    dragMove: (x: number, y: number) => {
      scene.moveDrag(x, y);
    },
    dragEnd: (x: number, y: number) => {
      scene.moveDrag(x, y);
      const { from, to } = scene.endDrag();
      ui.set({ dragging: false });
      if (to === -2) trash(state, scene.floor, from, queue);
      else if (to >= 0) move(state, scene.floor, from, to, queue);
    },
    dragCancel: () => {
      scene.endDrag();
      ui.set({ dragging: false });
    },
  };
  attachInput(canvas, input);
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat) return;
    e.preventDefault();
    audio.unlock();
    // Десктоп: пробел колупает случайного батракана
    const busy: number[] = [];
    const fl = floorOf(state, scene.floor);
    for (let i = 0; i < fl.deskCount; i++) if ((fl.desks[i] ?? 0) > 0) busy.push(i);
    const desk = busy[Math.floor(Math.random() * busy.length)];
    if (desk !== undefined && tap(state, scene.floor, desk, queue) === 0) facts.taps++;
  });

  const actions = {
    hire: () => {
      audio.unlock();
      if (hire(state, scene.floor, queue) === 0) {
        facts.hires++;
        advanceTutorial();
      }
    },
    toggleMute: () => {
      audio.unlock();
      audio.setMuted(!audio.isMuted);
      platform.setPref("muted", audio.isMuted ? "1" : "0");
      ui.set({ muted: audio.isMuted });
      audio.play("click");
    },
  };
  render(h(App, { store: ui, actions, atlas }), uiRoot);

  // ——— Снимок для UI ———
  let publishIn = 0;
  const publish = (): void => {
    const L = layout;
    let hint: UiState["hint"] = null;
    let hintX = 0;
    let hintY = 0;
    if (stage === TUTORIAL.tap) {
      hint = "tap";
      const d = floorOf(state, scene.floor).desks.findIndex((r) => r > 0);
      hintX = L.deskX[d] ?? 0;
      hintY = Math.max(HUD_TOP + 52, (L.deskY[d] ?? 0) - 158 * L.scale);
    } else if (stage === TUTORIAL.hire) {
      if (state.kukishi >= currentHireCost(state, scene.floor)) hint = "hire";
    } else if (stage === TUTORIAL.merge) {
      const pair = findPair(floorOf(state, scene.floor));
      if (pair) {
        hint = "merge";
        hintX = ((L.deskX[pair[0]] ?? 0) + (L.deskX[pair[1]] ?? 0)) / 2;
        hintY = Math.max(
          HUD_TOP + 52,
          Math.min(L.deskY[pair[0]] ?? 0, L.deskY[pair[1]] ?? 0) - 158 * L.scale,
        );
      }
    }
    const cost = currentHireCost(state, scene.floor);
    ui.set({
      kukishi: Math.floor(state.kukishi),
      income: state.incomePerSec,
      hireCost: cost,
      hasSpace: firstFreeDesk(state, scene.floor) >= 0,
      canHire: firstFreeDesk(state, scene.floor) >= 0 && state.kukishi >= cost,
      hint,
      hintX,
      hintY,
    });
  };
  // ——— Цикл ———
  const loop = startLoop({
    update(dt) {
      step(state, dt, queue);
      for (let i = 0; i < queue.length; i++) {
        const kind = queue.kind[i] ?? 0;
        scene.onEvent(kind, queue.f[i] ?? 0, queue.a[i] ?? 0, queue.b[i] ?? 0, queue.value[i] ?? 0);
        if (kind === EV.merged) {
          facts.merges++;
          advanceTutorial();
          save(false);
        }
      }
      queue.clear();
      publishIn -= dt;
      if (publishIn <= 0) {
        publishIn = UI_PUBLISH_SEC;
        publish();
      }
    },
    render(_alpha, frameSec) {
      scene.update(frameSec);
      scene.draw();
    },
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      loop.pause();
      audio.setPaused(true);
      platform.gameplayStop();
      save(true);
    } else {
      audio.setPaused(false);
      loop.resume();
      platform.gameplayStart();
    }
  });
  window.addEventListener("pagehide", () => {
    save(true);
  });

  publish();
  platform.gameReady();
  platform.gameplayStart();
}

/** Два батракана одного ранга (не максимального) — для подсказки «перетащи одного на другого». */
function floorOf(s: OfficeState, fi: number): FloorState {
  const f = s.floors[fi] ?? s.floors[0];
  if (!f) throw new Error("Нет этажей");
  return f;
}

function findPair(s: FloorState): [number, number] | null {
  for (let i = 0; i < s.deskCount; i++) {
    const r = s.desks[i] ?? 0;
    if (r === 0) continue;
    for (let j = i + 1; j < s.deskCount; j++) if (s.desks[j] === r && r < MAX_RANK) return [i, j];
  }
  return null;
}
