/**
 * Формулы экономики v2 (GDD §0.3). Чистые функции от чисел — без состояния,
 * поэтому их легко тестировать и прогонять в симуляторе баланса.
 */
import { BALANCE } from "../data/balance";

const at = (arr: readonly number[], i: number): number => {
  const v = arr[i];
  if (v === undefined) throw new RangeError(`Нет значения для этажа ${i}`);
  return v;
};

/** Базовый доход батракана ранга r на этаже f, кукишей в секунду. */
export function rankIncome(f: number, rank: number): number {
  return BALANCE.incomeBase * at(BALANCE.floorIncome, f) * BALANCE.incomeRankMult ** (rank - 1);
}

/** Множитель этажа: оснащение и открытые карточки картотеки. */
export function floorMult(equip: number, cards: number): number {
  return (1 + BALANCE.equipStep * equip) * (1 + BALANCE.cardBonus * cards);
}

/** Общий множитель: выслуга (навсегда) и временные баффы. */
export function globalMult(seniority: number, buff: number): number {
  return (1 + BALANCE.seniorityBonus * seniority) * buff;
}

/** Цена найма ранга q на этаже f, если за забег уже нанято n батраканов. thrift — уровень перка. */
export function hireCost(f: number, q: number, n: number, thrift: number): number {
  const discount = Math.max(0.1, 1 - BALANCE.thriftStep * thrift);
  return Math.ceil(
    BALANCE.hireBase * at(BALANCE.floorCost, f) * 2 ** (q - 1) * BALANCE.hireGrowth ** n * discount,
  );
}

/** Цена повышения квалификации найма с q до q+1. */
export function qualCost(f: number, q: number): number {
  return Math.ceil(BALANCE.qualBase * at(BALANCE.floorCost, f) * BALANCE.qualMult ** (q - 1));
}

/** Цена следующего уровня оснащения (сейчас уровень e). */
export function equipCost(f: number, e: number): number {
  return Math.ceil(BALANCE.equipBase * at(BALANCE.floorCost, f) * BALANCE.equipMult ** e);
}

/** Цена k+1-го докупленного стола. */
export function deskCost(f: number, k: number): number {
  return Math.ceil(BALANCE.deskBase * at(BALANCE.floorCost, f) * BALANCE.deskMult ** k);
}

export function floorUnlockCost(f: number): number {
  return at(BALANCE.floorUnlock, f);
}

export function tapValue(incomePerSec: number): number {
  return Math.max(1, Math.floor(BALANCE.tapFraction * incomePerSec));
}

export function trashRefund(f: number, rank: number): number {
  return Math.floor(
    BALANCE.trashRefund * BALANCE.hireBase * at(BALANCE.floorCost, f) * 2 ** (rank - 1),
  );
}

/** Сколько выслуги даст реорганизация при заработанном за забег. */
export function seniorityGain(earnedThisRun: number): number {
  return Math.floor((Math.max(0, earnedThisRun) / BALANCE.reorgBase) ** BALANCE.reorgExp + 1e-9);
}

/** Сколько надо заработать за забег, чтобы реорганизация дала gain выслуги. */
export function earnedForGain(gain: number): number {
  return gain ** (1 / BALANCE.reorgExp) * BALANCE.reorgBase;
}
