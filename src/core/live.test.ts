import { describe, expect, test } from "bun:test";
import { LIVE } from "../data/balance";
import { perkIndex } from "../data/perks";
import {
  canShowInterstitial,
  canShowRewarded,
  createAdGuard,
  noteAdShown,
  noteInput,
  setDragging,
} from "./ad-guard";
import { hire, tap } from "./commands";
import { DENY, EV, EventQueue } from "./events";
import {
  acceptKredik,
  activateColoid,
  activatePremia,
  avansPreview,
  claimAvans,
  claimOffline,
  claimShift,
  claimTask,
  liveStep,
  offlineAmount,
  openNote,
  PLAN,
  startDay,
  tapDebik,
  taskDone,
} from "./live";
import { CNT, NOTE, SPAWN, TASK_COUNT } from "./live-state";
import { fromSave, toSave } from "./save";
import { step } from "./sim";
import { addKukishi, createState, type OfficeState, recomputeIncome } from "./state";

const kinds = (q: EventQueue): number[] => Array.from(q.kind.subarray(0, q.length));

/** Состояние без случайных событий: таймеры появления и смены отодвинуты. */
function quiet(ranks: number[] = [3, 3, 2]): OfficeState {
  const s = createState();
  const f = s.floors[0];
  if (!f) throw new Error("нет этажа");
  f.desks.fill(0);
  ranks.forEach((r, i) => (f.desks[i] = r));
  s.kukishi = 0;
  s.live.spawn.fill(1e9);
  s.live.shiftWait = 1e9;
  recomputeIncome(s);
  return s;
}

describe("записки Хозяина и баффы", () => {
  test("аврал: доход ×avralMult на avralSec секунд, потом возвращается", () => {
    const s = quiet();
    const q = new EventQueue();
    const base = s.incomePerSec;
    s.live.note = NOTE.avral;
    s.live.noteTtl = LIVE.noteTtl;
    expect(openNote(s, q)).toBe(0);
    expect(s.incomePerSec).toBeCloseTo(base * LIVE.avralMult);
    expect(kinds(q)).toContain(EV.buffStarted);
    liveStep(s, LIVE.avralSec + 0.1, q);
    expect(s.incomePerSec).toBeCloseTo(base);
    expect(kinds(q)).toContain(EV.buffEnded);
  });

  test("подарок даёт кукиши, неоткрытая записка пропадает", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.note = NOTE.gift;
    s.live.noteTtl = LIVE.noteTtl;
    openNote(s, q);
    expect(s.kukishi).toBe(Math.floor(s.incomePerSec * LIVE.giftSec));
    expect(openNote(s, q)).toBe(DENY.invalid);

    s.live.note = NOTE.gift;
    s.live.noteTtl = 1;
    q.clear();
    liveStep(s, 1.5, q);
    expect(s.live.note).toBe(NOTE.none);
    expect(kinds(q)).toEqual([EV.noteMissed]);
  });

  test("шабашка: успел натапать — награда, не успел — проигрыш", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.note = NOTE.shabashka;
    openNote(s, q);
    const need = s.live.shabNeed;
    expect(need).toBe(LIVE.shabTapsBase + LIVE.shabTapsPerRank * 3);
    for (let i = 0; i < need; i++) tap(s, 0, 0, q);
    const before = s.kukishi;
    liveStep(s, 0.05, q);
    expect(kinds(q)).toContain(EV.shabashkaWon);
    expect(s.kukishi).toBeGreaterThan(before);

    s.live.note = NOTE.shabashka;
    openNote(s, q);
    q.clear();
    liveStep(s, LIVE.shabSec + 1, q);
    expect(kinds(q)).toEqual([EV.shabashkaLost]);
  });

  test("премия с перком «жирная премия» множит доход сильнее", () => {
    const s = quiet();
    const q = new EventQueue();
    const base = s.incomePerSec;
    activatePremia(s, q);
    expect(s.incomePerSec).toBeCloseTo(base * LIVE.premiaMult);
    s.perks[perkIndex("fatPremia")] = 1;
    activatePremia(s, q);
    expect(s.incomePerSec).toBeCloseTo(base * (LIVE.premiaMult + 1));
  });

  test("калоидный ускоритель сам сливает пары", () => {
    const s = quiet([1, 1, 2, 2]);
    const q = new EventQueue();
    activateColoid(s, q);
    for (let t = 0; t < 5; t++) step(s, 1, q);
    expect(s.floors[0]?.desks[0]).toBe(3);
  });
});

describe("дебики, кредики, проверка сверху", () => {
  test("дебик появляется по таймеру, пойманный даёт награду и счётчик", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.spawn[SPAWN.debik] = 0.01;
    liveStep(s, 0.05, q);
    expect(kinds(q)).toContain(EV.debikSpawned);
    expect(tapDebik(s, q)).toBe(0);
    expect(s.live.counters[CNT.debiks]).toBe(1);
    expect(s.kukishi).toBe(Math.floor(s.incomePerSec * LIVE.debikRewardSec));
    expect(tapDebik(s, q)).toBe(DENY.invalid);
  });

  test("дебик убегает, если его не поймать", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.debikTtl = 1;
    liveStep(s, 1.1, q);
    expect(kinds(q)).toEqual([EV.debikLeft]);
    expect(tapDebik(s, q)).toBe(DENY.invalid);
  });

  test("кредик: заём сразу, долг ×1.5 гасится долей выплат", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.spawn[SPAWN.kredik] = 0;
    liveStep(s, 0.05, q);
    const loan = s.live.kredikOffer;
    expect(loan).toBeGreaterThan(0);
    expect(acceptKredik(s, q)).toBe(0);
    expect(s.kukishi).toBe(loan);
    expect(s.totalEarned).toBe(0); // заём — не заработок, выслугу на нём не накрутить
    expect(s.live.debt).toBeCloseTo(loan * LIVE.kredikRepay);
    q.clear();
    let repaid = false;
    for (let t = 0; t < 10_000 && !repaid; t++) {
      step(s, 1, q);
      repaid = kinds(q).includes(EV.kredikRepaid);
      q.clear();
    }
    expect(repaid).toBe(true);
    expect(s.live.debt).toBe(0);
  });

  test("проверка сверху: заработал цель вовремя — награда", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.spawn[SPAWN.inspection] = 0;
    liveStep(s, 0.05, q);
    expect(kinds(q)).toContain(EV.inspectionStarted);
    addKukishi(s, s.live.inspTarget);
    q.clear();
    liveStep(s, 0.05, q);
    expect(kinds(q)).toContain(EV.inspectionWon);
  });

  test("проверка сверху: не успел — провал без штрафа", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.spawn[SPAWN.inspection] = 0;
    liveStep(s, 0.05, q);
    const k = s.kukishi;
    q.clear();
    liveStep(s, LIVE.inspSec + 1, q);
    expect(kinds(q)).toContain(EV.inspectionLost);
    expect(s.kukishi).toBe(k);
  });
});

describe("смена и поручения Тоси Боси", () => {
  test("смена: план после перекура, премия, удвоение рекламой, новый перекур", () => {
    const s = quiet();
    const q = new EventQueue();
    s.live.shiftWait = 1;
    liveStep(s, 1.1, q);
    // Первые смены — только «наколупать» или «нанять»
    expect([PLAN.earn, PLAN.hires]).toContain(s.live.shiftType as 0 | 2);
    if (s.live.shiftType === PLAN.earn) addKukishi(s, s.live.shiftTarget);
    else {
      s.kukishi = 1e12;
      for (let i = 0; i < s.live.shiftTarget; i++) {
        hire(s, 0, q);
        const f = s.floors[0];
        if (f) f.desks.fill(0, 3);
      }
    }
    liveStep(s, 0.05, q);
    expect(kinds(q)).toContain(EV.shiftDone);
    const reward = s.live.shiftReward;
    const k = s.kukishi;
    expect(claimShift(s, true, q)).toBe(0);
    expect(s.kukishi - k).toBe(reward * 2);
    expect(s.live.counters[CNT.shifts]).toBe(1);
    expect(s.live.shiftType).toBe(-1);
    expect(s.live.shiftWait).toBe(LIVE.shiftBreakSec);
    expect(claimShift(s, false, q)).toBe(DENY.invalid);
  });

  test("поручения: три разных, раз в день, печать за все три", () => {
    const s = quiet();
    const q = new EventQueue();
    expect(startDay(s, 100)).toBe(true);
    const types = Array.from(s.live.taskType);
    expect(new Set(types).size).toBe(TASK_COUNT);
    expect(startDay(s, 100)).toBe(false);
    expect(Array.from(s.live.taskType)).toEqual(types);

    expect(claimTask(s, 0, q)).toBe(DENY.noMoney);
    // Выполняем все три, накручивая счётчики
    for (let i = 0; i < TASK_COUNT; i++) {
      const target = s.live.taskTarget[i] ?? 0;
      const c = [CNT.earned, CNT.merges, CNT.hires, CNT.taps, CNT.debiks, CNT.shifts][
        s.live.taskType[i] ?? 0
      ];
      if (c === CNT.earned) addKukishi(s, target);
      else if (c !== undefined) s.live.counters[c] = (s.live.counters[c] ?? 0) + target;
    }
    const stamps = s.stamps;
    for (let i = 0; i < TASK_COUNT; i++) {
      expect(taskDone(s, i)).toBe(true);
      expect(claimTask(s, i, q)).toBe(0);
    }
    expect(claimTask(s, 0, q)).toBe(DENY.invalid);
    expect(s.stamps).toBe(stamps + LIVE.tasksBonusStamps);

    expect(startDay(s, 101)).toBe(true);
    expect(Array.from(s.live.taskClaimed)).toEqual([0, 0, 0]);
  });
});

describe("аванс и отгул", () => {
  test("аванс: серия растёт по дням подряд, сбрасывается после пропуска", () => {
    const s = quiet();
    const q = new EventQueue();
    expect(avansPreview(s, 10).streak).toBe(1);
    expect(claimAvans(s, 10, q)).toBe(0);
    expect(claimAvans(s, 10, q)).toBe(DENY.invalid);
    claimAvans(s, 11, q);
    expect(s.live.avansStreak).toBe(2);
    claimAvans(s, 13, q);
    expect(s.live.avansStreak).toBe(1);
    for (let d = 14; d < 30; d++) claimAvans(s, d, q);
    expect(s.live.avansStreak).toBe(LIVE.avansMaxStreak);
    expect(avansPreview(s, 30).reward).toBeGreaterThanOrEqual(LIVE.avansMin);
  });

  test("отгул: половина базового дохода, предел часов растёт с перком, баффы не считаются", () => {
    const s = quiet();
    const q = new EventQueue();
    const base = s.incomePerSec;
    const cap = LIVE.offlineBaseHours * 3600;
    expect(offlineAmount(s, 600)).toBe(Math.floor(base * LIVE.offlineRate * 600));
    expect(offlineAmount(s, cap * 10)).toBe(offlineAmount(s, cap));
    s.perks[perkIndex("longOtgul")] = 1;
    expect(offlineAmount(s, cap * 10)).toBeGreaterThan(offlineAmount(s, cap));
    activatePremia(s, q);
    expect(offlineAmount(s, 600)).toBe(Math.floor(base * LIVE.offlineRate * 600));
    expect(offlineAmount(s, -5)).toBe(0);
    expect(offlineAmount(s, Number.NaN)).toBe(0);
    claimOffline(s, 100, true, q);
    expect(s.kukishi).toBe(200);
  });
});

describe("сохранение слоя событий", () => {
  test("долгоживущие поля переживают сохранение, баффы применяются", () => {
    const s = quiet();
    const q = new EventQueue();
    activatePremia(s, q);
    s.live.debt = 123;
    s.live.counters[CNT.merges] = 7;
    startDay(s, 42);
    claimAvans(s, 42, q);
    const back = fromSave(JSON.parse(JSON.stringify(toSave(s, 0))));
    expect(back).not.toBeNull();
    if (!back) return;
    expect(back.live.debt).toBe(123);
    expect(back.live.counters[CNT.merges]).toBe(7);
    expect(back.live.counters[CNT.earned]).toBe(back.totalEarned);
    expect(Array.from(back.live.taskType)).toEqual(Array.from(s.live.taskType));
    expect([back.live.taskDay, back.live.avansDay, back.live.avansStreak]).toEqual([42, 42, 1]);
    expect(back.buffMult).toBe(LIVE.premiaMult);
    expect(back.incomePerSec).toBeCloseTo(s.incomePerSec);
  });

  test("битый слой событий не губит прогресс; сохранение без него тоже грузится", () => {
    const s = quiet();
    s.kukishi = 999;
    const data = JSON.parse(JSON.stringify(toSave(s, 0))) as Record<string, unknown>;
    const broken = fromSave({ ...data, live: { buffs: "x" } });
    expect(broken?.kukishi).toBe(999);
    expect(broken?.live.taskDay).toBe(-1);
    const old = { ...data };
    delete old["live"];
    expect(fromSave(old)?.kukishi).toBe(999);
    expect(fromSave({ ...data, live: { ...(data["live"] as object), debt: -1 } })?.live.debt).toBe(
      0,
    );
  });
});

describe("ad-guard: межстраничная реклама", () => {
  test("не в начале сессии, не чаще интервала, не во время драга и сразу после тапа", () => {
    const g = createAdGuard(1000);
    expect(canShowInterstitial(g, 1030)).toBe(false);
    expect(canShowInterstitial(g, 1061)).toBe(true);
    noteInput(g, 1100);
    expect(canShowInterstitial(g, 1101)).toBe(false);
    expect(canShowInterstitial(g, 1104)).toBe(true);
    setDragging(g, true, 1104);
    expect(canShowInterstitial(g, 1200)).toBe(false);
    expect(canShowRewarded(g)).toBe(false);
    setDragging(g, false, 1200);
    expect(canShowRewarded(g)).toBe(true);
    expect(canShowInterstitial(g, 1204)).toBe(true);
    noteAdShown(g, 1204);
    expect(canShowInterstitial(g, 1300)).toBe(false);
    expect(canShowInterstitial(g, 1325)).toBe(true);
  });
});
