/**
 * Команды игрока. Единственный способ изменить состояние офиса извне.
 * Каждая команда проверяет правила, меняет состояние на месте и пишет события в очередь.
 * Возвращает 0 при успехе или причину отказа из DENY.
 */
import { MAX_RANK } from "../data/ranks";
import { hireCost, hireLevel, tapValue, trashRefund } from "./economy";
import { DENY, type DenyReason, EV, type EventQueue } from "./events";
import { addKukishi, firstFreeDesk, isUnlocked, type OfficeState, recomputeIncome } from "./state";
import { BALANCE } from "../data/balance";

export type CommandResult = 0 | DenyReason;

function deny(q: EventQueue, reason: DenyReason): DenyReason {
  q.push(EV.denied, 0, reason);
  return reason;
}

function validDesk(s: OfficeState, desk: number): boolean {
  return Number.isInteger(desk) && desk >= 0 && desk < s.deskCount;
}

function unlockRank(s: OfficeState, rank: number, q: EventQueue): void {
  if (rank > s.maxRank) s.maxRank = rank;
  if (!isUnlocked(s, rank)) {
    s.collection |= 1 << (rank - 1);
    q.push(EV.rankUnlocked, 0, rank);
  }
}

/** Тап по батракану: «поколупать циферки» вручную. */
export function tap(s: OfficeState, desk: number, q: EventQueue): CommandResult {
  if (!validDesk(s, desk) || s.desks[desk] === 0) return deny(q, DENY.invalid);
  const gain = tapValue(s.incomePerSec);
  addKukishi(s, gain);
  q.push(EV.tap, desk, 0, gain);
  return 0;
}

/** Текущая цена найма в отделе квадров. */
export function currentHireCost(s: OfficeState): number {
  const level = hireLevel(s.maxRank);
  return hireCost(level, s.hires[level] ?? 0);
}

/** Найм батракана в отделе квадров на первый свободный стол. */
export function hire(s: OfficeState, q: EventQueue): CommandResult {
  const desk = firstFreeDesk(s);
  if (desk < 0) return deny(q, DENY.noSpace);
  const level = hireLevel(s.maxRank);
  const cost = hireCost(level, s.hires[level] ?? 0);
  if (s.kukishi < cost) return deny(q, DENY.noMoney);
  s.kukishi -= cost;
  s.hires[level] = (s.hires[level] ?? 0) + 1;
  s.desks[desk] = level;
  s.payoutTimers[desk] = BALANCE.payoutPeriod;
  recomputeIncome(s);
  q.push(EV.hired, desk, level, cost);
  unlockRank(s, level, q);
  return 0;
}

/**
 * Перетаскивание батракана со стола from на стол to. Что произойдёт, решают правила:
 * пустой стол — перенос; такой же ранг (не максимальный) — слияние-повышение; иначе — обмен местами.
 */
export function move(s: OfficeState, from: number, to: number, q: EventQueue): CommandResult {
  if (!validDesk(s, from) || !validDesk(s, to) || from === to) return deny(q, DENY.invalid);
  const a = s.desks[from] ?? 0;
  const b = s.desks[to] ?? 0;
  if (a === 0) return deny(q, DENY.invalid);
  if (b === 0) {
    s.desks[to] = a;
    s.desks[from] = 0;
    s.payoutTimers[to] = s.payoutTimers[from] ?? BALANCE.payoutPeriod;
    q.push(EV.moved, from, to);
  } else if (a === b && a < MAX_RANK) {
    const rank = a + 1;
    s.desks[to] = rank;
    s.desks[from] = 0;
    s.payoutTimers[to] = BALANCE.payoutPeriod;
    recomputeIncome(s);
    q.push(EV.merged, to, rank);
    unlockRank(s, rank, q);
  } else {
    s.desks[to] = a;
    s.desks[from] = b;
    const t = s.payoutTimers[to] ?? 0;
    s.payoutTimers[to] = s.payoutTimers[from] ?? 0;
    s.payoutTimers[from] = t;
    q.push(EV.swapped, from, to);
  }
  return 0;
}

/** Сдать батракана в слоповину: стол освобождается, часть цены возвращается. */
export function trash(s: OfficeState, desk: number, q: EventQueue): CommandResult {
  if (!validDesk(s, desk)) return deny(q, DENY.invalid);
  const rank = s.desks[desk] ?? 0;
  if (rank === 0) return deny(q, DENY.invalid);
  // Нельзя выбросить последнего батракана: офис без работников — тупик
  let others = 0;
  for (let i = 0; i < s.deskCount; i++) if (i !== desk && (s.desks[i] ?? 0) > 0) others++;
  if (others === 0) return deny(q, DENY.invalid);
  const refund = trashRefund(rank);
  s.desks[desk] = 0;
  s.kukishi += refund;
  recomputeIncome(s);
  q.push(EV.trashed, desk, rank, refund);
  return 0;
}
