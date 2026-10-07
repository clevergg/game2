/**
 * Бот-игрок для симулятора баланса. Играет на настоящем `src/core` как внимательный
 * активный игрок: тапает, сливает пары, нанимает, берёт дешёвые улучшения, открывает этажи,
 * реорганизуется и покупает перки. Возвращает времена вех — по ним подбирается BALANCE.
 */
import { BALANCE } from "../../src/data/balance";
import { FLOOR_COUNT } from "../../src/data/floors";
import { perkIndex, type PerkId } from "../../src/data/perks";
import { MAX_RANK } from "../../src/data/ranks";
import {
  buyDesk,
  buyEquip,
  buyPerk,
  buyQual,
  currentHireCost,
  hire,
  move,
  perkCost,
  reorganize,
  reorgGain,
  tap,
  trash,
  unlockFloor,
} from "../../src/core/commands";
import { deskCost, equipCost, floorUnlockCost, qualCost } from "../../src/core/economy";
import { EventQueue } from "../../src/core/events";
import { claimShift, declineKredik, openNote, tapDebik } from "../../src/core/live";
import { NOTE } from "../../src/core/live-state";
import { step } from "../../src/core/sim";
import { createState, type OfficeState, popcount } from "../../src/core/state";

export interface Milestones {
  /** Ранг 10 на первом этаже. */
  rank10Floor1?: number;
  firstReorg?: number;
  floor2?: number;
  floor3?: number;
  rank10Floor3?: number;
  /** Все обычные карточки картотеки всех этажей. */
  allCards?: number;
  reorgs: number;
  seniority: number;
}

export interface BotOptions {
  /** Предел симуляции, секунд игры. */
  readonly limit: number;
  readonly tapsPerSec: number;
  readonly dt: number;
  /** Пользуется событиями без рекламы: открывает записки, ловит дебиков, забирает премию смены. */
  readonly events?: boolean;
  /** Наблюдатель раз в минуту игры (для отладочных кривых дохода). */
  readonly observe?: (t: number, s: OfficeState) => void;
  /** Видит события каждого шага до очистки очереди (разбор источников дохода). */
  readonly onEvents?: (q: EventQueue) => void;
}

const PERK_PRIORITY: PerkId[] = [
  "thrift",
  "startQual",
  "extraDesk",
  "autoMerge",
  "fatPremia",
  "debikFreq",
  "longOtgul",
];

function mergeAll(s: OfficeState, q: EventQueue): void {
  for (let fi = 0; fi < s.floorsUnlocked; fi++) {
    const f = s.floors[fi];
    if (!f) continue;
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < f.deskCount && !merged; i++) {
        const r = f.desks[i] ?? 0;
        if (r === 0 || r >= MAX_RANK) continue;
        for (let j = i + 1; j < f.deskCount; j++) {
          if (f.desks[j] === r) {
            move(s, fi, j, i, q);
            merged = true;
            break;
          }
        }
      }
    }
  }
}

function hasPair(s: OfficeState, fi: number): boolean {
  const f = s.floors[fi];
  if (!f) return false;
  const seen = new Set<number>();
  for (let i = 0; i < f.deskCount; i++) {
    const r = f.desks[i] ?? 0;
    if (r === 0 || r >= MAX_RANK) continue;
    if (seen.has(r)) return true;
    seen.add(r);
  }
  return false;
}

export function maxRankOn(s: OfficeState, fi: number): number {
  const f = s.floors[fi];
  let m = 0;
  if (f) for (let i = 0; i < f.deskCount; i++) m = Math.max(m, f.desks[i] ?? 0);
  return m;
}

/** Копим на следующий этаж, если до него меньше 30 минут дохода — как живой игрок с видимой целью. */
function savingForFloor(s: OfficeState): boolean {
  return (
    s.floorsUnlocked < FLOOR_COUNT &&
    floorUnlockCost(s.floorsUnlocked) < Math.max(1, s.incomePerSec) * 1800
  );
}

function shop(s: OfficeState, q: EventQueue): boolean {
  const income = Math.max(1, s.incomePerSec);
  if (s.floorsUnlocked < FLOOR_COUNT && s.kukishi >= floorUnlockCost(s.floorsUnlocked)) {
    return unlockFloor(s, q) === 0;
  }
  const saving = savingForFloor(s);
  for (let fi = s.floorsUnlocked - 1; fi >= 0; fi--) {
    const f = s.floors[fi];
    if (!f) continue;
    const free = f.desks.subarray(0, f.deskCount).includes(0);
    if (!free && !hasPair(s, fi)) {
      const dc = deskCost(fi, f.desksBought);
      if (f.deskCount < BALANCE.desksMax && s.kukishi >= dc && dc < income * 300) {
        return buyDesk(s, fi, q) === 0;
      }
      // Тупик: выбрасываем самого младшего, если он ниже квалификации (пары ему уже не будет)
      let low = -1;
      for (let i = 0; i < f.deskCount; i++) {
        const r = f.desks[i] ?? 0;
        if (r < f.qual && (low < 0 || r < (f.desks[low] ?? 0))) low = i;
      }
      if (low >= 0) return trash(s, fi, low, q) === 0;
    }
    const qc = qualCost(fi, f.qual);
    if (
      f.qual < BALANCE.qualMax &&
      f.qual < maxRankOn(s, fi) - 1 &&
      s.kukishi >= qc &&
      qc < income * 120
    ) {
      return buyQual(s, fi, q) === 0;
    }
    const ec = equipCost(fi, f.equip);
    if (s.kukishi >= ec && ec < income * 60) return buyEquip(s, fi, q) === 0;
    if (!saving && free && s.kukishi >= currentHireCost(s, fi)) return hire(s, fi, q) === 0;
  }
  return false;
}

function buyPerks(s: OfficeState, q: EventQueue): void {
  for (;;) {
    let bought = false;
    for (const id of PERK_PRIORITY) {
      const i = perkIndex(id);
      if (s.stamps >= perkCost(s, i) && buyPerk(s, i, q) === 0) {
        bought = true;
        break;
      }
    }
    if (!bought) return;
  }
}

/** Живой игрок реагирует не мгновенно: на записку и дебика уходит пара секунд. */
function playEvents(s: OfficeState, q: EventQueue): void {
  const L = s.live;
  if (L.note !== NOTE.none && L.noteTtl < 10) openNote(s, q);
  if (L.debikTtl > 0 && L.debikTtl < 4) tapDebik(s, q);
  if (L.kredikOffer > 0) declineKredik(s);
  if (L.shiftReward > 0) claimShift(s, false, q);
}

export function runBot(opts: BotOptions): Milestones {
  const s = createState();
  const q = new EventQueue(1 << 14);
  const m: Milestones = { reorgs: 0, seniority: 0 };
  let lastProgressAt = 0;
  let bestProgress = 0;
  let tapAcc = 0;
  for (let t = 0; t < opts.limit; t += opts.dt) {
    tapAcc += opts.tapsPerSec * opts.dt;
    const top = s.floorsUnlocked - 1;
    const desk = s.floors[top]?.desks.findIndex((r) => r > 0) ?? -1;
    while (tapAcc >= 1) {
      if (desk >= 0) tap(s, top, desk, q);
      tapAcc -= 1;
    }
    step(s, opts.dt, q);
    if (opts.events === true) playEvents(s, q);
    mergeAll(s, q);
    for (let k = 0; k < 40 && shop(s, q); k++) mergeAll(s, q);
    opts.onEvents?.(q);
    q.clear();

    const progress = s.floorsUnlocked * 100 + maxRankOn(s, top);
    if (progress > bestProgress) {
      bestProgress = progress;
      lastProgressAt = t;
    }
    if (m.rank10Floor1 === undefined && maxRankOn(s, 0) >= MAX_RANK) m.rank10Floor1 = t;
    if (m.floor2 === undefined && s.floorsUnlocked >= 2) m.floor2 = t;
    if (m.floor3 === undefined && s.floorsUnlocked >= 3) m.floor3 = t;
    if (m.rank10Floor3 === undefined && s.floorsUnlocked >= 3 && maxRankOn(s, 2) >= MAX_RANK) {
      m.rank10Floor3 = t;
    }
    if (m.allCards === undefined && Array.from(s.cards).every((c) => popcount(c) === MAX_RANK)) {
      m.allCards = t;
    }

    const gain = reorgGain(s);
    // Реорганизация: когда выслуга удвоится; при застое (30 мин без роста) — если прибавка ощутима
    const stalled = t - lastProgressAt > (savingForFloor(s) ? 3600 : 1800);
    const doubling = gain >= Math.max(2, s.seniority) && !savingForFloor(s);
    const worthIt = stalled && gain >= Math.max(1, s.seniority / 4);
    if (gain >= 1 && (doubling || worthIt)) {
      reorganize(s, q);
      if (m.firstReorg === undefined) m.firstReorg = t;
      buyPerks(s, q);
      lastProgressAt = t;
      bestProgress = 0;
      q.clear();
    }
    if (opts.observe && Math.floor(t / 60) !== Math.floor((t - opts.dt) / 60)) opts.observe(t, s);
    if (m.allCards !== undefined && m.rank10Floor3 !== undefined) break;
  }
  m.reorgs = s.reorgs;
  m.seniority = s.seniority;
  return m;
}
