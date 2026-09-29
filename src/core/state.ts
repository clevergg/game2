/** Состояние офиса. Все массивы выделяются один раз при создании. */
import { BALANCE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";
import { incomeOf } from "./economy";

export interface OfficeState {
  /** Ранг батракана за каждым столом, 0 — стол пуст. Длина — максимум столов. */
  readonly desks: Int8Array;
  /** Сколько столов открыто (остальные «под коробками»). */
  deskCount: number;
  kukishi: number;
  /** Сколько батраканов каждого уровня нанято в забеге (индекс — уровень). */
  readonly hires: Uint16Array;
  maxRank: number;
  earnedThisRun: number;
  totalEarned: number;
  /** Картотека: бит r−1 — ранг r уже открыт. */
  collection: number;
  /** Секунд до следующей выплаты каждого стола. */
  readonly payoutTimers: Float32Array;
  /** Суммарный доход в секунду (кэш, пересчитывается при изменении столов). */
  incomePerSec: number;
}

/** Выплаты столов разнесены по времени, чтобы кукиши сыпались вразнобой, а не залпом. */
export function initialTimer(desk: number): number {
  return BALANCE.payoutPeriod * (0.35 + ((desk * 0.37) % 0.6));
}

export function createState(): OfficeState {
  const s: OfficeState = {
    desks: new Int8Array(BALANCE.desksMax),
    deskCount: BALANCE.desksStart,
    kukishi: 0,
    hires: new Uint16Array(MAX_RANK + 1),
    maxRank: 1,
    earnedThisRun: 0,
    totalEarned: 0,
    collection: 1,
    payoutTimers: new Float32Array(BALANCE.desksMax),
    incomePerSec: 0,
  };
  for (let i = 0; i < BALANCE.desksMax; i++) s.payoutTimers[i] = initialTimer(i);
  // Первый кадр игры: один стажёр уже сидит за столом
  s.desks[0] = 1;
  recomputeIncome(s);
  return s;
}

export function recomputeIncome(s: OfficeState): void {
  let sum = 0;
  for (let i = 0; i < s.deskCount; i++) {
    const r = s.desks[i] ?? 0;
    if (r > 0) sum += incomeOf(r);
  }
  s.incomePerSec = sum;
}

export function addKukishi(s: OfficeState, amount: number): void {
  s.kukishi += amount;
  s.earnedThisRun += amount;
  s.totalEarned += amount;
}

export function isUnlocked(s: OfficeState, rank: number): boolean {
  return (s.collection & (1 << (rank - 1))) !== 0;
}

export function firstFreeDesk(s: OfficeState): number {
  for (let i = 0; i < s.deskCount; i++) if (s.desks[i] === 0) return i;
  return -1;
}
