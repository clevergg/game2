/** Состояние Конторки: этажи, кукиши, выслуга, перки, картотека. Массивы выделяются один раз. */
import { BALANCE } from "../data/balance";
import { FLOOR_COUNT } from "../data/floors";
import { PERK_COUNT, perkIndex } from "../data/perks";
import { floorMult, globalMult, rankIncome } from "./economy";

export interface FloorState {
  /** Ранг батракана за каждым столом, 0 — стол пуст. */
  readonly desks: Int8Array;
  /** 1 — батракан за столом премированный. */
  readonly rare: Uint8Array;
  /** Секунд до следующей выплаты стола. */
  readonly payoutTimers: Float32Array;
  deskCount: number;
  /** Сколько батраканов нанято на этаже за забег — двигатель удорожания найма. */
  hires: number;
  /** Квалификация найма: какой ранг нанимается. */
  qual: number;
  /** Уровень оснащения этажа. */
  equip: number;
  /** Сколько столов докуплено в этом забеге. */
  desksBought: number;
}

export interface OfficeState {
  readonly floors: readonly FloorState[];
  /** Сколько этажей открыто (1..FLOOR_COUNT). */
  floorsUnlocked: number;
  kukishi: number;
  earnedThisRun: number;
  totalEarned: number;
  /** Выслуга: постоянный бонус дохода, не тратится. */
  seniority: number;
  /** Печати отдела квадров: валюта перков. */
  stamps: number;
  reorgs: number;
  /** Уровни перков. */
  readonly perks: Uint8Array;
  /** Картотека: бит r−1 — ранг r открыт на этаже (по этажам). */
  readonly cards: Uint16Array;
  /** То же для премированных батраканов. */
  readonly rareCards: Uint16Array;
  /** Множитель дохода от временных баффов (премия, аврал, калоид); выставляет sim. */
  buffMult: number;
  /** Кэш: доход этажа в секунду и общий. */
  readonly floorIncome: Float64Array;
  incomePerSec: number;
  /** Состояние детерминированного ГСЧ (шанс премированного и т.п.). */
  rng: number;
  /** Секунд до следующего автослияния (перк). */
  autoMergeTimer: number;
}

export function initialTimer(desk: number): number {
  return BALANCE.payoutPeriod * (0.35 + ((desk * 0.37) % 0.6));
}

function createFloor(): FloorState {
  const f: FloorState = {
    desks: new Int8Array(BALANCE.desksMax),
    rare: new Uint8Array(BALANCE.desksMax),
    payoutTimers: new Float32Array(BALANCE.desksMax),
    deskCount: BALANCE.desksStart,
    hires: 0,
    qual: 1,
    equip: 0,
    desksBought: 0,
  };
  for (let i = 0; i < BALANCE.desksMax; i++) f.payoutTimers[i] = initialTimer(i);
  return f;
}

export function perkLevel(s: OfficeState, id: Parameters<typeof perkIndex>[0]): number {
  return s.perks[perkIndex(id)] ?? 0;
}

/** Приводит этаж к стартовому виду забега с учётом перков. */
export function resetFloor(s: OfficeState, fi: number): void {
  const f = s.floors[fi];
  if (!f) return;
  f.desks.fill(0);
  f.rare.fill(0);
  for (let i = 0; i < BALANCE.desksMax; i++) f.payoutTimers[i] = initialTimer(i);
  f.deskCount = Math.min(BALANCE.desksMax, BALANCE.desksStart + perkLevel(s, "extraDesk"));
  f.hires = 0;
  f.qual = Math.min(BALANCE.qualMax, 1 + perkLevel(s, "startQual"));
  f.equip = 0;
  f.desksBought = 0;
  // Первый батракан уже сидит за столом — этаж никогда не стартует пустым
  f.desks[0] = f.qual;
  s.cards[fi] = (s.cards[fi] ?? 0) | ((1 << f.qual) - 1);
}

export function createState(): OfficeState {
  const s: OfficeState = {
    floors: Array.from({ length: FLOOR_COUNT }, createFloor),
    floorsUnlocked: 1,
    kukishi: BALANCE.startKukishi,
    earnedThisRun: 0,
    totalEarned: 0,
    seniority: 0,
    stamps: 0,
    reorgs: 0,
    perks: new Uint8Array(PERK_COUNT),
    cards: new Uint16Array(FLOOR_COUNT),
    rareCards: new Uint16Array(FLOOR_COUNT),
    buffMult: 1,
    floorIncome: new Float64Array(FLOOR_COUNT),
    incomePerSec: 0,
    rng: 0x9e3779b9,
    autoMergeTimer: BALANCE.autoMergePeriod,
  };
  resetFloor(s, 0);
  recomputeIncome(s);
  return s;
}

export function addKukishi(s: OfficeState, amount: number): void {
  s.kukishi += amount;
  s.earnedThisRun += amount;
  s.totalEarned += amount;
}

export function firstFreeDesk(s: OfficeState, fi: number): number {
  const f = s.floors[fi];
  if (!f) return -1;
  for (let i = 0; i < f.deskCount; i++) if (f.desks[i] === 0) return i;
  return -1;
}

export function popcount(x: number): number {
  let n = 0;
  let v = x;
  while (v) {
    n += v & 1;
    v >>>= 1;
  }
  return n;
}

/** Детерминированный ГСЧ (mulberry32) в состоянии: результаты воспроизводимы в тестах и симуляторе. */
export function random(s: OfficeState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Пересчитывает кэш дохода. Вызывать после любого изменения столов, оснащения, картотеки, баффов. */
export function recomputeIncome(s: OfficeState): void {
  const global = globalMult(s.seniority, s.buffMult);
  let total = 0;
  for (let fi = 0; fi < s.floors.length; fi++) {
    const f = s.floors[fi];
    if (!f || fi >= s.floorsUnlocked) {
      s.floorIncome[fi] = 0;
      continue;
    }
    let sum = 0;
    for (let i = 0; i < f.deskCount; i++) {
      const r = f.desks[i] ?? 0;
      if (r > 0) sum += rankIncome(fi, r) * (f.rare[i] ? BALANCE.rareMult : 1);
    }
    const inc = sum * floorMult(f.equip, popcount(s.cards[fi] ?? 0)) * global;
    s.floorIncome[fi] = inc;
    total += inc;
  }
  s.incomePerSec = total;
}

/** Выплата одного стола за период (кукиши). */
export function deskPayout(s: OfficeState, fi: number, desk: number): number {
  const f = s.floors[fi];
  if (!f) return 0;
  const r = f.desks[desk] ?? 0;
  if (r === 0) return 0;
  return (
    rankIncome(fi, r) *
    (f.rare[desk] ? BALANCE.rareMult : 1) *
    floorMult(f.equip, popcount(s.cards[fi] ?? 0)) *
    globalMult(s.seniority, s.buffMult) *
    BALANCE.payoutPeriod
  );
}
