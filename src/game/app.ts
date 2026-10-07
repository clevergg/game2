/**
 * Сборка игры из слоёв: платформа → язык → атлас → состояние → сцена → UI → цикл.
 * Здесь же связь «ввод → команды core», «события core → сцена/звук/UI», реклама, дни и отгул.
 */
import { render, h } from "preact";
import atlasJson from "../../assets/atlas.json";
import atlasUrl from "../../assets/atlas.png";
import atlasUrl1 from "../../assets/atlas-1.png";
import atlasUrl2 from "../../assets/atlas-2.png";
import { BALANCE, LIVE } from "../data/balance";
import { FLOOR_COUNT } from "../data/floors";
import { MAX_RANK } from "../data/ranks";
import {
  buyDesk,
  buyEquip,
  buyPerk,
  buyQual,
  currentHireCost,
  hire,
  hireFree,
  move,
  reorganize,
  reorgGain,
  tap,
  trash,
  unlockFloor,
} from "../core/commands";
import { floorUnlockCost } from "../core/economy";
import { EV, EventQueue } from "../core/events";
import {
  acceptKredik,
  activateColoid,
  activatePremia,
  avansPreview,
  claimAvans,
  claimOffline,
  claimShift,
  claimTask,
  declineKredik,
  offlineAmount,
  openNote,
  startDay,
  tapDebik,
} from "../core/live";
import { NOTE } from "../core/live-state";
import { fromSave, toSave } from "../core/save";
import { step } from "../core/sim";
import {
  createState,
  firstFreeDesk,
  type FloorState,
  type OfficeState,
  perkLevel,
} from "../core/state";
import { type AtlasJson, loadAtlas } from "../engine/atlas";
import { AudioPlayer } from "../engine/audio/player";
import { attachInput } from "../engine/input";
import { type Loop, startLoop } from "../engine/loop";
import { FloatingNumbers, Particles } from "../engine/particles";
import { CanvasRenderer } from "../engine/renderer";
import { detectLang, floorName, fmt, numberLocale, rankName, setLang, t, tf } from "../i18n";
import type { Platform } from "../platform/platform";
import type { UiActions } from "../ui/actions";
import { App } from "../ui/App";
import {
  type HrTab,
  INITIAL_UI,
  type Modal,
  type PanelKind,
  Store,
  type UiState,
} from "../ui/store";
import { Ads } from "./ads";
import { awaySeconds, dayNumber } from "./days";
import { computeLayout, HUD_TOP, type Layout } from "./layout";
import { HIT, OfficeScene } from "./scene";
import { challengeView, hrBadge, hrView, shiftView, tasksBadge, tasksView } from "./snapshot";
import { nextStage, parseStage, TUTORIAL, type TutorialStage } from "./tutorial";

const AUTOSAVE_MS = 15_000;
const UI_PUBLISH_SEC = 0.1;
/** Отгул показываем, только если игрока не было хотя бы минуту. */
const OTGUL_MIN_SEC = 60;
/** Как часто проверять смену календарного дня (полночь — новые поручения и аванс). */
const DAY_CHECK_SEC = 5;

interface Loaded {
  readonly state: OfficeState;
  readonly savedAt: number;
}

async function loadState(platform: Platform): Promise<Loaded> {
  const raw = await platform.loadSave();
  if (!raw) return { state: createState(), savedAt: 0 };
  try {
    const data = JSON.parse(raw) as unknown;
    const state = fromSave(data);
    const savedAt =
      typeof data === "object" &&
      data !== null &&
      "savedAt" in data &&
      typeof data.savedAt === "number"
        ? data.savedAt
        : 0;
    return state ? { state, savedAt } : { state: createState(), savedAt: 0 };
  } catch {
    console.warn("Сохранение повреждено, начинаем заново");
    return { state: createState(), savedAt: 0 };
  }
}

const today = (): number => dayNumber(Date.now(), new Date().getTimezoneOffset());

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

  const [atlas, loaded] = await Promise.all([
    loadAtlas([atlasUrl, atlasUrl1, atlasUrl2], atlasJson as AtlasJson),
    loadState(platform),
  ]);
  const state = loaded.state;
  const renderer = new CanvasRenderer(canvas, atlas);
  const particles = new Particles(256);
  const numbers = new FloatingNumbers(atlas, ["gold", "green"], 64);
  numbers.setLocale(numberLocale());
  const queue = new EventQueue(256);
  const ui = new Store<UiState>({ ...INITIAL_UI, muted: audio.isMuted });

  const deskIdx = atlas.frame("f0_desk");
  const charIdx = atlas.frame("f0_b5_idle_0");
  const metrics = {
    deskW: atlas.w[deskIdx] ?? 129,
    deskTop: atlas.ay[deskIdx] ?? 91,
    charTop: atlas.ay[charIdx] ?? 150,
  };
  // Листы открытых этажей подгружаем в фоне, чтобы лифт ездил без ожидания
  for (let fi = 1; fi < state.floorsUnlocked; fi++) void atlas.load(fi);

  let toasts = 0;
  let stamps = 0;
  let denies = 0;
  const toast = (title: string, text = ""): void => {
    ui.set({ toast: { id: ++toasts, title, text } });
  };

  const deskCountOf = (fi: number): number =>
    fi < state.floorsUnlocked ? floorOf(state, fi).deskCount : BALANCE.desksStart;
  let viewFloor = 0;
  const makeLayout = (): Layout =>
    computeLayout(
      canvas.clientWidth,
      canvas.clientHeight,
      deskCountOf(viewFloor),
      BALANCE.desksMax,
      metrics,
    );
  let layout = makeLayout();
  const scene = new OfficeScene(atlas, renderer, particles, numbers, audio, state, layout, {
    stamp: (x, y) => {
      ui.set({ stamp: { id: ++stamps, x, y: Math.max(HUD_TOP + 48, y) } });
    },
    rankUnlocked: () => {
      // Тост нового ранга показывается из общего обработчика событий (там известен этаж)
    },
    denied: () => {
      ui.set({ denyId: ++denies });
    },
  });
  const relayout = (): void => {
    layout = makeLayout();
    scene.setLayout(layout);
  };

  const resize = (): void => {
    renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    relayout();
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

  // ——— Окна ———
  let panel: PanelKind = "none";
  let tab: HrTab = "floor";
  let modal: Modal | null = null;
  const pending: Modal[] = [];
  const showModal = (m: Modal): void => {
    if (modal) pending.push(m);
    else {
      modal = m;
      ui.set({ modal });
    }
  };
  const closeModal = (): void => {
    modal = pending.shift() ?? null;
    ui.set({ modal });
  };

  // ——— Реклама: на время показа всё на паузе ———
  let loop: Loop | null = null;
  const ads = new Ads(platform, {
    pause: () => {
      loop?.pause();
      audio.setPaused(true);
      platform.gameplayStop();
      ui.set({ adBusy: true });
    },
    resume: () => {
      ui.set({ adBusy: false });
      if (document.hidden) return;
      audio.setPaused(false);
      loop?.resume();
      platform.gameplayStart();
    },
  });
  /** Реклама за награду: при успехе выполняет give, иначе говорит, что реклама недоступна. */
  const rewarded = (give: () => void): void => {
    void ads.rewarded().then((ok) => {
      if (ok) give();
      else toast(t("adUnavailable"));
      publish();
    });
  };

  // ——— Дни: поручения, аванс; отгул ———
  let day = today();
  startDay(state, day);
  let dayCheckIn = DAY_CHECK_SEC;
  const away = awaySeconds(loaded.savedAt, Date.now());
  const otgul = loaded.savedAt > 0 && away >= OTGUL_MIN_SEC ? offlineAmount(state, away) : 0;
  if (otgul > 0) showModal({ kind: "otgul", amount: otgul });

  // ——— Подсказки первой сессии ———
  let stage: TutorialStage = parseStage(platform.getPref("tutorial"));
  const facts = { taps: 0, hires: 0, merges: 0 };
  const offerAvans = (): void => {
    const p = avansPreview(state, day);
    if (p.reward > 0 && stage === TUTORIAL.done && modal?.kind !== "avans") {
      showModal({ kind: "avans", reward: p.reward, streak: p.streak });
    }
  };
  const advanceTutorial = (): void => {
    const next = nextStage(stage, facts);
    if (next !== stage) {
      stage = next;
      // Аванс после обучения не всплывает: о нём скажет бейдж поручений, а со следующей сессии — окно
      platform.setPref("tutorial", String(stage));
    }
  };
  offerAvans();

  // ——— Лифт ———
  const setFloor = (fi: number): void => {
    const top = Math.min(FLOOR_COUNT - 1, state.floorsUnlocked);
    const next = Math.max(0, Math.min(top, fi));
    if (next === viewFloor) return;
    if (scene.dragging) scene.endDrag();
    viewFloor = next;
    scene.floor = next;
    relayout();
    audio.play("click");
    void atlas.load(next).then(publish);
    publish();
  };

  // ——— Ввод → команды ———
  const input = {
    tap: (x: number, y: number) => {
      audio.unlock();
      ads.input();
      const hit = scene.hitEvent(x, y);
      if (hit === HIT.note) {
        openNote(state, queue);
        return;
      }
      if (hit === HIT.debik) {
        tapDebik(state, queue);
        return;
      }
      if (hit === HIT.kredik) return;
      if (viewFloor >= state.floorsUnlocked) return;
      const desk = scene.hitDesk(x, y);
      if (desk >= 0 && tap(state, viewFloor, desk, queue) === 0) {
        facts.taps++;
        advanceTutorial();
      }
    },
    dragStart: (x: number, y: number) => {
      audio.unlock();
      if (viewFloor >= state.floorsUnlocked || scene.hitEvent(x, y) !== HIT.none) return false;
      const desk = scene.hitDesk(x, y);
      if (desk < 0) return false;
      scene.beginDrag(desk, x, y);
      ads.dragging(true);
      ui.set({ dragging: true });
      return true;
    },
    dragMove: (x: number, y: number) => {
      scene.moveDrag(x, y);
    },
    dragEnd: (x: number, y: number) => {
      scene.moveDrag(x, y);
      const { from, to } = scene.endDrag();
      ads.dragging(false);
      ui.set({ dragging: false });
      if (to === -2) trash(state, viewFloor, from, queue);
      else if (to >= 0) move(state, viewFloor, from, to, queue);
    },
    dragCancel: () => {
      scene.endDrag();
      ads.dragging(false);
      ui.set({ dragging: false });
    },
  };
  attachInput(canvas, input);
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat || viewFloor >= state.floorsUnlocked) return;
    e.preventDefault();
    audio.unlock();
    ads.input();
    // Десктоп: пробел колупает случайного батракана
    const busy: number[] = [];
    const fl = floorOf(state, viewFloor);
    for (let i = 0; i < fl.deskCount; i++) if ((fl.desks[i] ?? 0) > 0) busy.push(i);
    const desk = busy[Math.floor(Math.random() * busy.length)];
    if (desk !== undefined && tap(state, viewFloor, desk, queue) === 0) facts.taps++;
  });

  const after = (): void => {
    flushEvents();
    publish();
  };
  const actions: UiActions = {
    hire: () => {
      audio.unlock();
      ads.input();
      if (hire(state, viewFloor, queue) === 0) {
        facts.hires++;
        advanceTutorial();
      }
      after();
    },
    hireBlat: () => {
      audio.unlock();
      rewarded(() => {
        if (hireFree(state, viewFloor, queue) === 0) facts.hires++;
        after();
      });
    },
    toggleMute: () => {
      audio.unlock();
      audio.setMuted(!audio.isMuted);
      platform.setPref("muted", audio.isMuted ? "1" : "0");
      ui.set({ muted: audio.isMuted });
      audio.play("click");
    },
    setFloor,
    unlockFloor: () => {
      audio.unlock();
      if (unlockFloor(state, queue) === 0) save(false);
      after();
    },
    openPanel: (p) => {
      audio.unlock();
      panel = p;
      if (p !== "none") audio.play("click");
      ui.set({ panel });
      publish();
    },
    setTab: (next) => {
      tab = next;
      audio.play("click");
      ui.set({ tab });
    },
    closeModal: () => {
      closeModal();
    },
    buyQual: () => {
      buyQual(state, viewFloor, queue);
      after();
    },
    buyEquip: () => {
      buyEquip(state, viewFloor, queue);
      after();
    },
    buyDesk: () => {
      buyDesk(state, viewFloor, queue);
      after();
    },
    buyPerk: (i) => {
      if (buyPerk(state, i, queue) === 0) save(false);
      after();
    },
    askReorg: () => {
      const gain = reorgGain(state);
      if (gain >= 1) showModal({ kind: "reorg", gain });
    },
    reorganize: () => {
      closeModal();
      if (reorganize(state, queue) !== 0) return;
      panel = "none";
      ui.set({ panel });
      save(true);
      after();
      void ads.interstitial();
    },
    claimTask: (i) => {
      if (claimTask(state, i, queue) === 0) save(false);
      after();
    },
    claimAvans: () => {
      if (claimAvans(state, day, queue) === 0) save(false);
      if (modal?.kind === "avans") closeModal();
      after();
    },
    openShift: () => {
      if (state.live.shiftReward > 0) showModal({ kind: "shift", reward: state.live.shiftReward });
    },
    claimShift: (doubled) => {
      if (doubled) {
        rewarded(() => {
          claimShift(state, true, queue);
          closeModal();
          after();
        });
        return;
      }
      claimShift(state, false, queue);
      closeModal();
      after();
      void ads.interstitial();
    },
    claimOtgul: (doubled) => {
      const amount = modal?.kind === "otgul" ? modal.amount : 0;
      if (doubled) {
        rewarded(() => {
          claimOffline(state, amount, true, queue);
          closeModal();
          after();
        });
        return;
      }
      claimOffline(state, amount, false, queue);
      closeModal();
      after();
      void ads.interstitial();
    },
    askPremia: () => {
      showModal({ kind: "premia", mult: LIVE.premiaMult + perkLevel(state, "fatPremia") });
    },
    askColoid: () => {
      showModal({ kind: "coloid" });
    },
    watchPremia: () => {
      rewarded(() => {
        activatePremia(state, queue);
        closeModal();
        after();
      });
    },
    watchColoid: () => {
      rewarded(() => {
        activateColoid(state, queue);
        closeModal();
        after();
      });
    },
    acceptKredik: () => {
      acceptKredik(state, queue);
      after();
    },
    declineKredik: () => {
      declineKredik(state);
      audio.play("click");
      publish();
    },
  };
  render(h(App, { store: ui, actions, atlas }), uiRoot);

  // ——— События core → сцена, звук, тосты, окна ———
  function flushEvents(): void {
    for (let i = 0; i < queue.length; i++) {
      const kind = queue.kind[i] ?? 0;
      const f = queue.f[i] ?? 0;
      const b = queue.b[i] ?? 0;
      const value = queue.value[i] ?? 0;
      scene.onEvent(kind, f, queue.a[i] ?? 0, b, value);
      switch (kind) {
        case EV.merged:
          facts.merges++;
          advanceTutorial();
          save(false);
          break;
        case EV.rankUnlocked:
          toast(t("newRank"), rankName(b, f));
          break;
        case EV.rareAppeared:
          if (f === viewFloor) toast(t("rare"), t("rareDesc"));
          break;
        case EV.noteOpened:
          if (b === NOTE.avral) toast(tf("avral", { n: LIVE.avralMult, t: LIVE.avralSec }));
          else if (b === NOTE.gift) toast(t("gift"), `+${fmt(value)}`);
          break;
        case EV.debikCaught:
          toast(t("debikCaught"), `+${fmt(value)}`);
          break;
        case EV.shabashkaWon:
          toast(t("shabashkaWon"), `+${fmt(value)}`);
          break;
        case EV.shabashkaLost:
          toast(t("shabashkaLost"));
          break;
        case EV.inspectionWon:
          toast(t("inspectionWon"), `+${fmt(value)}`);
          break;
        case EV.inspectionLost:
          toast(t("inspectionLost"));
          break;
        case EV.kredikRepaid:
          toast(t("kredikRepaid"));
          break;
        case EV.shiftDone:
          if (modal === null && panel === "none" && !scene.dragging) {
            showModal({ kind: "shift", reward: value });
          }
          break;
        case EV.floorUnlocked:
          toast(t("floorUnlocked"), floorName(f));
          void atlas.load(f).then(publish);
          relayout();
          break;
        case EV.deskBought:
        case EV.perkBought:
        case EV.reorganized:
          relayout();
          break;
      }
    }
    queue.clear();
  }

  // ——— Снимок для UI ———
  let publishIn = 0;
  function publish(): void {
    const L = layout;
    const fi = viewFloor;
    const locked = fi >= state.floorsUnlocked;
    let hint: UiState["hint"] = null;
    let hintX = 0;
    let hintY = 0;
    if (!locked && fi === 0 && modal === null) {
      if (stage === TUTORIAL.tap) {
        hint = "tap";
        const d = floorOf(state, fi).desks.findIndex((r) => r > 0);
        hintX = L.deskX[d] ?? 0;
        hintY = Math.max(HUD_TOP + 52, (L.deskY[d] ?? 0) - 158 * L.scale);
      } else if (stage === TUTORIAL.hire) {
        if (state.kukishi >= currentHireCost(state, fi)) hint = "hire";
      } else if (stage === TUTORIAL.merge) {
        const pair = findPair(floorOf(state, fi));
        if (pair) {
          hint = "merge";
          hintX = ((L.deskX[pair[0]] ?? 0) + (L.deskX[pair[1]] ?? 0)) / 2;
          hintY = Math.max(
            HUD_TOP + 52,
            Math.min(L.deskY[pair[0]] ?? 0, L.deskY[pair[1]] ?? 0) - 158 * L.scale,
          );
        }
      }
    }
    const cost = locked ? 0 : currentHireCost(state, fi);
    const free = locked ? -1 : firstFreeDesk(state, fi);
    const hrFloor = Math.min(fi, state.floorsUnlocked - 1);
    ui.set({
      kukishi: Math.floor(state.kukishi),
      income: state.incomePerSec,
      hireCost: cost,
      hasSpace: free >= 0,
      canHire: free >= 0 && state.kukishi >= cost,
      hint,
      hintX,
      hintY,
      floor: fi,
      floorsUnlocked: state.floorsUnlocked,
      floorReady: scene.floorReady,
      unlockCost: state.floorsUnlocked < FLOOR_COUNT ? floorUnlockCost(state.floorsUnlocked) : 0,
      buffs: Array.from(state.live.buffs),
      debt: Math.ceil(state.live.debt),
      shift: shiftView(state),
      challenge: challengeView(state),
      kredikOffer: state.live.kredikOffer,
      tasksBadge: tasksBadge(state, day),
      hrBadge: hrBadge(state),
      hr: panel === "hr" ? hrView(state, hrFloor) : null,
      tasks: panel === "tasks" ? tasksView(state, day) : null,
    });
  }

  // ——— Цикл ———
  const gameLoop = startLoop({
    update(dt) {
      step(state, dt, queue);
      flushEvents();
      publishIn -= dt;
      if (publishIn <= 0) {
        publishIn = UI_PUBLISH_SEC;
        dayCheckIn -= UI_PUBLISH_SEC;
        if (dayCheckIn <= 0) {
          dayCheckIn = DAY_CHECK_SEC;
          const d = today();
          if (d !== day) {
            day = d;
            startDay(state, day);
            offerAvans();
          }
        }
        publish();
      }
    },
    render(_alpha, frameSec) {
      scene.update(frameSec);
      scene.draw();
    },
  });
  loop = gameLoop;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      gameLoop.pause();
      audio.setPaused(true);
      platform.gameplayStop();
      save(true);
    } else if (!ads.showing) {
      audio.setPaused(false);
      gameLoop.resume();
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

function floorOf(s: OfficeState, fi: number): FloorState {
  const f = s.floors[fi] ?? s.floors[0];
  if (!f) throw new Error("Нет этажей");
  return f;
}

/** Два батракана одного ранга (не максимального) — для подсказки «перетащи одного на другого». */
function findPair(s: FloorState): [number, number] | null {
  for (let i = 0; i < s.deskCount; i++) {
    const r = s.desks[i] ?? 0;
    if (r === 0) continue;
    for (let j = i + 1; j < s.deskCount; j++) if (s.desks[j] === r && r < MAX_RANK) return [i, j];
  }
  return null;
}
