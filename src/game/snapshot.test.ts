import { describe, expect, test } from "bun:test";
import { EventQueue } from "../core/events";
import { claimShift, liveStep, startDay } from "../core/live";
import { CNT, TASK_COUNT } from "../core/live-state";
import { addKukishi, createState } from "../core/state";
import { awaySeconds, dayNumber } from "./days";
import { PAUSE, Pauser } from "./pause";
import {
  careerScore,
  challengeView,
  hrBadge,
  hrView,
  shiftView,
  tasksBadge,
  tasksView,
} from "./snapshot";

describe("дни", () => {
  test("номер дня меняется в местную полночь", () => {
    // UTC+3 (Москва): getTimezoneOffset() = −180
    const msk = -180;
    const beforeMidnight = Date.UTC(2026, 9, 7, 20, 59);
    const afterMidnight = Date.UTC(2026, 9, 7, 21, 1);
    expect(dayNumber(afterMidnight, msk)).toBe(dayNumber(beforeMidnight, msk) + 1);
    expect(dayNumber(beforeMidnight, 0)).toBe(dayNumber(afterMidnight, 0));
  });

  test("отсутствие: часы назад и мусор — 0", () => {
    expect(awaySeconds(1000, 61_000)).toBe(60);
    expect(awaySeconds(61_000, 1000)).toBe(0);
    expect(awaySeconds(Number.NaN, 1000)).toBe(0);
  });
});

describe("снимки для UI", () => {
  test("смена: перекур, план, готовая премия", () => {
    const s = createState();
    const q = new EventQueue();
    expect(shiftView(s).type).toBe(-1);
    s.live.shiftWait = 0.01;
    s.live.spawn.fill(1e9);
    liveStep(s, 0.05, q);
    const v = shiftView(s);
    expect(v.type).toBeGreaterThanOrEqual(0);
    expect(v.progress).toBe(0);
    s.live.shiftReward = 10;
    expect(shiftView(s).reward).toBe(10);
    claimShift(s, false, q);
    expect(shiftView(s).wait).toBeGreaterThan(0);
  });

  test("испытание шабашки показывает прогресс тапов", () => {
    const s = createState();
    expect(challengeView(s)).toBeNull();
    s.live.shabLeft = 10;
    s.live.shabNeed = 40;
    s.live.shabBase = 5;
    s.live.counters[CNT.taps] = 15;
    expect(challengeView(s)).toEqual({ kind: "shabashka", left: 10, have: 10, need: 40 });
  });

  test("отдел квадров: закрытый этаж — null; до выслуги — сколько осталось", () => {
    const s = createState();
    expect(hrView(s, 1)).toBeNull();
    const hr = hrView(s, 0);
    expect(hr?.reorgGain).toBe(0);
    expect(hr?.reorgNeed).toBeGreaterThan(0);
    expect(hr?.perks.length).toBe(7);
    expect(hrBadge(s)).toBe(false);
    s.stamps = 100;
    expect(hrBadge(s)).toBe(true);
  });

  test("поручения: бейдж считает аванс и выполненные задания", () => {
    const s = createState();
    startDay(s, 50);
    expect(tasksBadge(s, 50)).toBe(1); // только аванс
    const v = tasksView(s, 50);
    expect(v.items.length).toBe(TASK_COUNT);
    expect(v.avansReward).toBeGreaterThan(0);
    // Выполняем всё накруткой счётчиков
    for (let c = 0; c < s.live.counters.length; c++) s.live.counters[c] = 1e9;
    addKukishi(s, 1e12);
    expect(tasksBadge(s, 50)).toBe(1 + TASK_COUNT);
  });
});

describe("доска почёта и пауза", () => {
  test("карьера: выслуга × 100 + карточки", () => {
    const s = createState();
    expect(careerScore(s)).toBe(1); // карточка стажёра Бухгалтерии
    s.seniority = 3;
    s.cards[1] = 0b111;
    s.rareCards[0] = 0b1;
    expect(careerScore(s)).toBe(300 + 1 + 3 + 1);
  });

  test("пауза держится, пока есть хоть одна причина", () => {
    const calls: boolean[] = [];
    const p = new Pauser((v) => calls.push(v));
    p.set(PAUSE.ad, true);
    p.set(PAUSE.hidden, true);
    p.set(PAUSE.ad, false);
    expect(p.paused).toBe(true);
    p.set(PAUSE.hidden, false);
    p.set(PAUSE.external, false);
    expect(calls).toEqual([true, false]);
  });
});
