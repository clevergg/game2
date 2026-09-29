/** Формулы экономики: чистые функции без состояния. */
import { BALANCE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";

/** Доход батракана ранга r, кукишей в секунду. */
export function incomeOf(rank: number): number {
  return BALANCE.incomeBase * BALANCE.incomeRankMult ** (rank - 1);
}

/** Уровень нанимаемых батраканов: отстаёт от максимального ранга, но не ниже 1. */
export function hireLevel(maxRank: number): number {
  return Math.min(MAX_RANK, Math.max(1, maxRank - BALANCE.hireLag));
}

/** Цена найма батракана уровня level, если таких уже нанято n. */
export function hireCost(level: number, n: number): number {
  return Math.ceil(
    BALANCE.hireBase * BALANCE.hireRankMult ** (level - 1) * BALANCE.hireGrowth ** n,
  );
}

/** Кукиши за один тап при текущем доходе в секунду. */
export function tapValue(incomePerSec: number): number {
  return Math.floor(BALANCE.tapBase + BALANCE.tapIncomeFraction * incomePerSec);
}

/** Возврат за батракана, сданного в слоповину. */
export function trashRefund(rank: number): number {
  return Math.floor(BALANCE.trashRefund * hireCost(rank, 0));
}
