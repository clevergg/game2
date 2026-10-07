/**
 * Команды игрока — единственный способ изменить состояние извне.
 * Каждая проверяет правила, меняет состояние на месте и пишет события в очередь.
 * Возвращает 0 при успехе или причину отказа из DENY (состояние при отказе не меняется).
 */
import { BALANCE } from "../data/balance";
import { FLOOR_COUNT } from "../data/floors";
import { PERKS, perkMax } from "../data/perks";
import { MAX_RANK } from "../data/ranks";
import {
  deskCost,
  equipCost,
  floorUnlockCost,
  hireCost,
  qualCost,
  seniorityGain,
  tapValue,
  trashRefund,
} from "./economy";
import { DENY, type DenyReason, EV, type EventQueue } from "./events";
import { CNT } from "./live-state";
import {
  addKukishi,
  bump,
  firstFreeDesk,
  type FloorState,
  type OfficeState,
  perkLevel,
  random,
  recomputeIncome,
  resetFloor,
} from "./state";

export type CommandResult = 0 | DenyReason;

function deny(q: EventQueue, reason: DenyReason): DenyReason {
  q.push(EV.denied, 0, 0, reason);
  return reason;
}

/** Этаж, открытый игроком, или null. */
function openFloor(s: OfficeState, fi: number): FloorState | null {
  if (!Number.isInteger(fi) || fi < 0 || fi >= s.floorsUnlocked) return null;
  return s.floors[fi] ?? null;
}

function validDesk(f: FloorState, desk: number): boolean {
  return Number.isInteger(desk) && desk >= 0 && desk < f.deskCount;
}

/**
 * Картотека: ранг считается открытым, когда до него дорос. Младшие ранги открываются вместе с ним —
 * иначе перк «квалификация с порога» делал бы их карточки недостижимыми на новых этажах.
 */
function unlockCard(s: OfficeState, fi: number, rank: number, rare: boolean, q: EventQueue): void {
  const bit = 1 << (rank - 1);
  if (((s.cards[fi] ?? 0) & bit) === 0) q.push(EV.rankUnlocked, fi, 0, rank);
  s.cards[fi] = (s.cards[fi] ?? 0) | ((bit << 1) - 1);
  if (rare) s.rareCards[fi] = (s.rareCards[fi] ?? 0) | bit;
}

/** Цена найма на этаже прямо сейчас. */
export function currentHireCost(s: OfficeState, fi: number): number {
  const f = s.floors[fi];
  if (!f) return Infinity;
  return hireCost(fi, f.qual, f.hires, perkLevel(s, "thrift"));
}

export function tap(s: OfficeState, fi: number, desk: number, q: EventQueue): CommandResult {
  const f = openFloor(s, fi);
  if (!f || !validDesk(f, desk) || f.desks[desk] === 0) return deny(q, DENY.invalid);
  const gain = tapValue(s.incomePerSec);
  addKukishi(s, gain);
  bump(s, CNT.taps);
  q.push(EV.tap, fi, desk, 0, gain);
  return 0;
}

function placeHire(
  s: OfficeState,
  fi: number,
  f: FloorState,
  desk: number,
  cost: number,
  q: EventQueue,
): void {
  const rank = f.qual;
  const rare = random(s) < BALANCE.rareChance;
  f.hires++;
  bump(s, CNT.hires);
  f.desks[desk] = rank;
  f.rare[desk] = rare ? 1 : 0;
  f.payoutTimers[desk] = BALANCE.payoutPeriod;
  q.push(EV.hired, fi, desk, rank, cost);
  if (rare) q.push(EV.rareAppeared, fi, desk, rank);
  unlockCard(s, fi, rank, rare, q);
  recomputeIncome(s);
}

/** Найм в отделе квадров на первый свободный стол этажа. */
export function hire(s: OfficeState, fi: number, q: EventQueue): CommandResult {
  const f = openFloor(s, fi);
  if (!f) return deny(q, DENY.locked);
  const desk = firstFreeDesk(s, fi);
  if (desk < 0) return deny(q, DENY.noSpace);
  const cost = currentHireCost(s, fi);
  if (s.kukishi < cost) return deny(q, DENY.noMoney);
  s.kukishi -= cost;
  placeHire(s, fi, f, desk, cost, q);
  return 0;
}

/** Найм «по блату» — за просмотр рекламы: бесплатно, но удорожание считается как обычно. */
export function hireFree(s: OfficeState, fi: number, q: EventQueue): CommandResult {
  const f = openFloor(s, fi);
  if (!f) return deny(q, DENY.locked);
  const desk = firstFreeDesk(s, fi);
  if (desk < 0) return deny(q, DENY.noSpace);
  placeHire(s, fi, f, desk, 0, q);
  return 0;
}

/**
 * Перетаскивание: на пустой стол — перенос; на такого же ранга (не максимального) — слияние;
 * иначе — обмен местами.
 */
export function move(
  s: OfficeState,
  fi: number,
  from: number,
  to: number,
  q: EventQueue,
): CommandResult {
  const f = openFloor(s, fi);
  if (!f || !validDesk(f, from) || !validDesk(f, to) || from === to) return deny(q, DENY.invalid);
  const a = f.desks[from] ?? 0;
  const b = f.desks[to] ?? 0;
  if (a === 0) return deny(q, DENY.invalid);
  if (b === 0) {
    f.desks[to] = a;
    f.rare[to] = f.rare[from] ?? 0;
    f.desks[from] = 0;
    f.rare[from] = 0;
    f.payoutTimers[to] = f.payoutTimers[from] ?? BALANCE.payoutPeriod;
    q.push(EV.moved, fi, from, to);
  } else if (a === b && a < MAX_RANK) {
    mergeDesks(s, fi, f, from, to, q);
  } else {
    f.desks[to] = a;
    f.desks[from] = b;
    const ra = f.rare[from] ?? 0;
    f.rare[from] = f.rare[to] ?? 0;
    f.rare[to] = ra;
    const t = f.payoutTimers[to] ?? 0;
    f.payoutTimers[to] = f.payoutTimers[from] ?? 0;
    f.payoutTimers[from] = t;
    q.push(EV.swapped, fi, from, to);
  }
  return 0;
}

/** Слияние двух одинаковых: результат на столе to. Премированность сохраняется или выпадает с шансом. */
export function mergeDesks(
  s: OfficeState,
  fi: number,
  f: FloorState,
  from: number,
  to: number,
  q: EventQueue,
): void {
  const rank = (f.desks[to] ?? 0) + 1;
  const rare =
    (f.rare[from] ?? 0) === 1 || (f.rare[to] ?? 0) === 1 || random(s) < BALANCE.rareChance;
  const becameRare = rare && (f.rare[to] ?? 0) === 0 && (f.rare[from] ?? 0) === 0;
  f.desks[to] = rank;
  f.rare[to] = rare ? 1 : 0;
  f.desks[from] = 0;
  f.rare[from] = 0;
  f.payoutTimers[to] = BALANCE.payoutPeriod;
  bump(s, CNT.merges);
  q.push(EV.merged, fi, to, rank);
  if (becameRare) q.push(EV.rareAppeared, fi, to, rank);
  unlockCard(s, fi, rank, rare, q);
  recomputeIncome(s);
}

/** Слоповина: стол освобождается, часть цены возвращается. Последнего на этаже выбросить нельзя. */
export function trash(s: OfficeState, fi: number, desk: number, q: EventQueue): CommandResult {
  const f = openFloor(s, fi);
  if (!f || !validDesk(f, desk)) return deny(q, DENY.invalid);
  const rank = f.desks[desk] ?? 0;
  if (rank === 0) return deny(q, DENY.invalid);
  let others = 0;
  for (let i = 0; i < f.deskCount; i++) if (i !== desk && (f.desks[i] ?? 0) > 0) others++;
  if (others === 0) return deny(q, DENY.invalid);
  const refund = trashRefund(fi, rank);
  f.desks[desk] = 0;
  f.rare[desk] = 0;
  s.kukishi += refund;
  recomputeIncome(s);
  q.push(EV.trashed, fi, desk, rank, refund);
  return 0;
}

export function buyQual(s: OfficeState, fi: number, q: EventQueue): CommandResult {
  const f = openFloor(s, fi);
  if (!f) return deny(q, DENY.locked);
  if (f.qual >= BALANCE.qualMax) return deny(q, DENY.maxed);
  const cost = qualCost(fi, f.qual);
  if (s.kukishi < cost) return deny(q, DENY.noMoney);
  s.kukishi -= cost;
  f.qual++;
  q.push(EV.qualBought, fi, 0, f.qual, cost);
  return 0;
}

export function buyEquip(s: OfficeState, fi: number, q: EventQueue): CommandResult {
  const f = openFloor(s, fi);
  if (!f) return deny(q, DENY.locked);
  const cost = equipCost(fi, f.equip);
  if (s.kukishi < cost) return deny(q, DENY.noMoney);
  s.kukishi -= cost;
  f.equip++;
  recomputeIncome(s);
  q.push(EV.equipBought, fi, 0, f.equip, cost);
  return 0;
}

export function buyDesk(s: OfficeState, fi: number, q: EventQueue): CommandResult {
  const f = openFloor(s, fi);
  if (!f) return deny(q, DENY.locked);
  if (f.deskCount >= BALANCE.desksMax) return deny(q, DENY.maxed);
  const cost = deskCost(fi, f.desksBought);
  if (s.kukishi < cost) return deny(q, DENY.noMoney);
  s.kukishi -= cost;
  f.desksBought++;
  f.deskCount++;
  q.push(EV.deskBought, fi, 0, f.deskCount, cost);
  return 0;
}

/** Открыть следующий этаж. Открытые этажи остаются навсегда. */
export function unlockFloor(s: OfficeState, q: EventQueue): CommandResult {
  const fi = s.floorsUnlocked;
  if (fi >= FLOOR_COUNT) return deny(q, DENY.maxed);
  const cost = floorUnlockCost(fi);
  if (s.kukishi < cost) return deny(q, DENY.noMoney);
  s.kukishi -= cost;
  s.floorsUnlocked++;
  resetFloor(s, fi);
  recomputeIncome(s);
  q.push(EV.floorUnlocked, fi, 0, 0, cost);
  return 0;
}

/** Сколько выслуги даст реорганизация прямо сейчас. */
export function reorgGain(s: OfficeState): number {
  return seniorityGain(s.earnedThisRun);
}

/**
 * Реорганизация (престиж): кукиши, батраканы, квалификация, оснащение и докупленные столы
 * сбрасываются; этажи, выслуга, печати, перки и картотека остаются.
 */
export function reorganize(s: OfficeState, q: EventQueue): CommandResult {
  const gain = reorgGain(s);
  if (gain < 1) return deny(q, DENY.noMoney);
  s.seniority += gain;
  s.stamps += gain;
  s.reorgs++;
  s.kukishi = BALANCE.startKukishi;
  s.earnedThisRun = 0;
  for (let fi = 0; fi < s.floorsUnlocked; fi++) resetFloor(s, fi);
  recomputeIncome(s);
  q.push(EV.reorganized, 0, 0, gain);
  return 0;
}

/** Цена следующего уровня перка в печатях или Infinity, если перк на максимуме. */
export function perkCost(s: OfficeState, i: number): number {
  const p = PERKS[i];
  if (!p) return Infinity;
  const lvl = s.perks[i] ?? 0;
  return p.cost[lvl] ?? Infinity;
}

export function buyPerk(s: OfficeState, i: number, q: EventQueue): CommandResult {
  if (!Number.isInteger(i) || i < 0 || i >= PERKS.length) return deny(q, DENY.invalid);
  const lvl = s.perks[i] ?? 0;
  if (lvl >= perkMax(i)) return deny(q, DENY.maxed);
  const cost = perkCost(s, i);
  if (s.stamps < cost) return deny(q, DENY.noMoney);
  s.stamps -= cost;
  s.perks[i] = lvl + 1;
  // Перки «столов» и «квалификации» действуют сразу, а не только со следующего забега
  for (let fi = 0; fi < s.floorsUnlocked; fi++) {
    const f = s.floors[fi];
    if (!f) continue;
    f.deskCount = Math.max(
      f.deskCount,
      Math.min(BALANCE.desksMax, BALANCE.desksStart + perkLevel(s, "extraDesk") + f.desksBought),
    );
    f.qual = Math.max(f.qual, Math.min(BALANCE.qualMax, 1 + perkLevel(s, "startQual")));
  }
  q.push(EV.perkBought, 0, i, lvl + 1, cost);
  return 0;
}
