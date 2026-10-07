/**
 * Логика событий и дневных слоёв (GDD §0.5–0.6): баффы, записки Хозяина, дебики, кредики,
 * проверка сверху, план смены, поручения Тоси Боси, аванс, отгул.
 * Даты core не знает: игра передаёт номер дня (дни с эпохи по календарю устройства).
 */
import { LIVE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";
import { DENY, type DenyReason, EV, type EventQueue } from "./events";
import { BUFF, CNT, NOTE, SPAWN, TASK_COUNT } from "./live-state";
import {
  addKukishi,
  baseIncome,
  type OfficeState,
  perkLevel,
  random,
  recomputeIncome,
} from "./state";

type Result = 0 | DenyReason;

const between = (s: OfficeState, lo: number, hi: number): number => lo + (hi - lo) * random(s);
const pick = (s: OfficeState, range: readonly [number, number]): number =>
  Math.round(between(s, range[0], range[1]));

/** Награда «N секунд дохода», не меньше 1 кукиша. */
function incomeSec(s: OfficeState, sec: number): number {
  return Math.max(1, Math.floor(baseIncome(s) * sec));
}

function maxRankAll(s: OfficeState): number {
  let m = 1;
  for (let fi = 0; fi < s.floorsUnlocked; fi++) {
    const f = s.floors[fi];
    if (f) for (let i = 0; i < f.deskCount; i++) m = Math.max(m, f.desks[i] ?? 0);
  }
  return Math.min(m, MAX_RANK);
}

// ——— Баффы ———

/** Пересчитывает общий множитель баффов и доход. */
export function applyBuffs(s: OfficeState): void {
  const b = s.live.buffs;
  let mult = 1;
  if ((b[BUFF.premia] ?? 0) > 0) mult *= LIVE.premiaMult + perkLevel(s, "fatPremia");
  if ((b[BUFF.avral] ?? 0) > 0) mult *= LIVE.avralMult;
  if ((b[BUFF.coloid] ?? 0) > 0) mult *= LIVE.coloidMult;
  s.buffMult = mult;
  recomputeIncome(s);
}

function startBuff(s: OfficeState, kind: number, sec: number, q: EventQueue): void {
  s.live.buffs[kind] = sec;
  applyBuffs(s);
  q.push(EV.buffStarted, 0, 0, kind, sec);
}

/** Премия (после просмотра rewarded): доход ×(2 + перк) на 3 минуты. */
export function activatePremia(s: OfficeState, q: EventQueue): void {
  startBuff(s, BUFF.premia, LIVE.premiaSec, q);
}

/** Калоидный ускоритель (после rewarded): автослияние и доход ×1.5 на минуту. */
export function activateColoid(s: OfficeState, q: EventQueue): void {
  startBuff(s, BUFF.coloid, LIVE.coloidSec, q);
}

export function buffActive(s: OfficeState, kind: number): boolean {
  return (s.live.buffs[kind] ?? 0) > 0;
}

// ——— Кредик: гашение долга ———

/** Часть выплаты уходит на погашение долга. Возвращает, что остаётся игроку. */
export function repay(s: OfficeState, amount: number, q: EventQueue): number {
  const L = s.live;
  if (L.debt <= 0) return amount;
  const part = Math.min(L.debt, amount * LIVE.kredikShare);
  L.debt -= part;
  if (L.debt <= 1e-9) {
    L.debt = 0;
    q.push(EV.kredikRepaid);
  }
  return amount - part;
}

// ——— Шаг событий ———

export function liveStep(s: OfficeState, dt: number, q: EventQueue): void {
  const L = s.live;
  // Баффы
  let buffsChanged = false;
  for (let k = 0; k < L.buffs.length; k++) {
    const left = L.buffs[k] ?? 0;
    if (left <= 0) continue;
    const next = left - dt;
    L.buffs[k] = Math.max(0, next);
    if (next <= 0) {
      buffsChanged = true;
      q.push(EV.buffEnded, 0, 0, k);
    }
  }
  if (buffsChanged) applyBuffs(s);

  // Записка висит ограниченное время
  if (L.note !== NOTE.none) {
    L.noteTtl -= dt;
    if (L.noteTtl <= 0) {
      L.note = NOTE.none;
      q.push(EV.noteMissed);
    }
  }
  if (L.debikTtl > 0) {
    L.debikTtl -= dt;
    if (L.debikTtl <= 0) {
      L.debikTtl = 0;
      q.push(EV.debikLeft);
    }
  }
  if (L.kredikOffer > 0) {
    L.kredikTtl -= dt;
    if (L.kredikTtl <= 0) L.kredikOffer = 0;
  }

  // Шабашка: N тапов за 20 секунд
  if (L.shabLeft > 0) {
    if ((L.counters[CNT.taps] ?? 0) - L.shabBase >= L.shabNeed) {
      L.shabLeft = 0;
      const reward = incomeSec(s, LIVE.shabRewardSec);
      addKukishi(s, reward);
      q.push(EV.shabashkaWon, 0, 0, 0, reward);
    } else {
      L.shabLeft -= dt;
      if (L.shabLeft <= 0) {
        L.shabLeft = 0;
        q.push(EV.shabashkaLost);
      }
    }
  }

  // Проверка сверху: заработать цель за 60 секунд
  if (L.inspLeft > 0) {
    if ((L.counters[CNT.earned] ?? 0) - L.inspBase >= L.inspTarget) {
      L.inspLeft = 0;
      const reward = Math.floor(L.inspTarget * LIVE.inspBonus);
      addKukishi(s, reward);
      q.push(EV.inspectionWon, 0, 0, 0, reward);
    } else {
      L.inspLeft -= dt;
      if (L.inspLeft <= 0) {
        L.inspLeft = 0;
        q.push(EV.inspectionLost);
      }
    }
  }

  // Появление событий
  for (let k = 0; k < L.spawn.length; k++) {
    L.spawn[k] = (L.spawn[k] ?? 0) - dt;
    if ((L.spawn[k] ?? 0) > 0) continue;
    spawnEvent(s, k, q);
  }

  // План смены: после перекура выдаётся новый
  if (L.shiftType < 0) {
    L.shiftWait -= dt;
    if (L.shiftWait <= 0) newShift(s);
  } else if (L.shiftReward === 0 && planProgress(s, L.shiftType, L.shiftBase) >= L.shiftTarget) {
    L.shiftReward = incomeSec(s, LIVE.shiftRewardSec);
    q.push(EV.shiftDone, 0, 0, 0, L.shiftReward);
  }
}

function spawnEvent(s: OfficeState, kind: number, q: EventQueue): void {
  const L = s.live;
  const busy = L.shabLeft > 0 || L.inspLeft > 0;
  switch (kind) {
    case SPAWN.note: {
      L.spawn[kind] = between(s, LIVE.noteMin, LIVE.noteMax);
      if (L.note !== NOTE.none || busy) return;
      const r = random(s);
      L.note = r < 0.35 ? NOTE.avral : r < 0.7 ? NOTE.shabashka : NOTE.gift;
      L.noteTtl = LIVE.noteTtl;
      q.push(EV.noteSpawned, 0, 0, L.note);
      return;
    }
    case SPAWN.debik: {
      const k = Math.max(0.2, 1 - LIVE.debikPerkStep * perkLevel(s, "debikFreq"));
      L.spawn[kind] = between(s, LIVE.debikMin, LIVE.debikMax) * k;
      if (L.debikTtl > 0) return;
      L.debikTtl = LIVE.debikTtl;
      q.push(EV.debikSpawned);
      return;
    }
    case SPAWN.kredik: {
      L.spawn[kind] = between(s, LIVE.kredikMin, LIVE.kredikMax);
      if (L.kredikOffer > 0 || L.debt > 0) return;
      L.kredikOffer = incomeSec(s, LIVE.kredikLoanSec);
      L.kredikTtl = LIVE.kredikTtl;
      q.push(EV.kredikOffered, 0, 0, 0, L.kredikOffer);
      return;
    }
    case SPAWN.inspection: {
      L.spawn[kind] = between(s, LIVE.inspMin, LIVE.inspMax);
      if (busy) return;
      L.inspTarget = incomeSec(s, LIVE.inspTargetSec);
      L.inspBase = L.counters[CNT.earned] ?? 0;
      L.inspLeft = LIVE.inspSec;
      q.push(EV.inspectionStarted, 0, 0, 0, L.inspTarget);
      return;
    }
  }
}

// ——— Действия игрока ———

/** Открыть записку Хозяина. */
export function openNote(s: OfficeState, q: EventQueue): Result {
  const L = s.live;
  const kind = L.note;
  if (kind === NOTE.none) return DENY.invalid;
  L.note = NOTE.none;
  let gift = 0;
  if (kind === NOTE.avral) startBuff(s, BUFF.avral, LIVE.avralSec, q);
  else if (kind === NOTE.gift) {
    gift = incomeSec(s, LIVE.giftSec);
    addKukishi(s, gift);
  } else {
    L.shabNeed = LIVE.shabTapsBase + LIVE.shabTapsPerRank * maxRankAll(s);
    L.shabBase = L.counters[CNT.taps] ?? 0;
    L.shabLeft = LIVE.shabSec;
    q.push(EV.shabashkaStarted, 0, 0, L.shabNeed);
  }
  q.push(EV.noteOpened, 0, 0, kind, gift);
  return 0;
}

export function tapDebik(s: OfficeState, q: EventQueue): Result {
  const L = s.live;
  if (L.debikTtl <= 0) return DENY.invalid;
  L.debikTtl = 0;
  const reward = incomeSec(s, LIVE.debikRewardSec);
  addKukishi(s, reward);
  L.counters[CNT.debiks] = (L.counters[CNT.debiks] ?? 0) + 1;
  q.push(EV.debikCaught, 0, 0, 0, reward);
  return 0;
}

export function acceptKredik(s: OfficeState, q: EventQueue): Result {
  const L = s.live;
  if (L.kredikOffer <= 0) return DENY.invalid;
  const loan = L.kredikOffer;
  L.kredikOffer = 0;
  s.kukishi += loan;
  L.debt = loan * LIVE.kredikRepay;
  q.push(EV.kredikAccepted, 0, 0, 0, loan);
  return 0;
}

export function declineKredik(s: OfficeState): void {
  s.live.kredikOffer = 0;
}

// ——— Планы смены и поручений ———

export const PLAN = { earn: 0, merges: 1, hires: 2, taps: 3, debiks: 4, shifts: 5 } as const;

const PLAN_COUNTER = [CNT.earned, CNT.merges, CNT.hires, CNT.taps, CNT.debiks, CNT.shifts];

export function planProgress(s: OfficeState, type: number, base: number): number {
  const c = PLAN_COUNTER[type];
  return c === undefined ? 0 : (s.live.counters[c] ?? 0) - base;
}

function planBase(s: OfficeState, type: number): number {
  const c = PLAN_COUNTER[type];
  return c === undefined ? 0 : (s.live.counters[c] ?? 0);
}

// Первые смены — простые и понятные: наколупать и нанять
const SHIFT_FIRST = [PLAN.earn, PLAN.hires];
const SHIFT_ALL = [PLAN.earn, PLAN.merges, PLAN.hires, PLAN.taps, PLAN.debiks];

function newShift(s: OfficeState): void {
  const L = s.live;
  const pool = L.shiftNo < 2 ? SHIFT_FIRST : SHIFT_ALL;
  const type = pool[Math.floor(random(s) * pool.length)] ?? PLAN.earn;
  L.shiftType = type;
  L.shiftBase = planBase(s, type);
  L.shiftTarget =
    type === PLAN.earn
      ? incomeSec(s, LIVE.shiftEarnSec)
      : type === PLAN.merges
        ? pick(s, LIVE.shiftMerges)
        : type === PLAN.hires
          ? pick(s, LIVE.shiftHires)
          : type === PLAN.taps
            ? pick(s, LIVE.shiftTaps)
            : pick(s, LIVE.shiftDebiks);
  L.shiftReward = 0;
  L.shiftWait = 0;
}

/** Забрать премию смены («смена отшабашена»), doubled — после просмотра рекламы. */
export function claimShift(s: OfficeState, doubled: boolean, q: EventQueue): Result {
  const L = s.live;
  if (L.shiftReward <= 0) return DENY.invalid;
  const reward = L.shiftReward * (doubled ? 2 : 1);
  addKukishi(s, reward);
  L.shiftReward = 0;
  L.shiftNo++;
  L.counters[CNT.shifts] = (L.counters[CNT.shifts] ?? 0) + 1;
  q.push(EV.rewardClaimed, 0, 0, doubled ? 1 : 0, reward);
  L.shiftType = -1;
  L.shiftWait = LIVE.shiftBreakSec;
  return 0;
}

/** Новый день: Тося Бося выдаёт 3 новых поручения. Повторный вызов в тот же день ничего не меняет. */
export function startDay(s: OfficeState, day: number): boolean {
  const L = s.live;
  if (L.taskDay === day) return false;
  L.taskDay = day;
  const pool = [PLAN.earn, PLAN.merges, PLAN.hires, PLAN.taps, PLAN.debiks, PLAN.shifts];
  for (let i = 0; i < TASK_COUNT; i++) {
    // Три разных типа: берём из пула без повторов
    const idx = Math.floor(random(s) * pool.length);
    const type = pool.splice(idx, 1)[0] ?? PLAN.earn;
    L.taskType[i] = type;
    L.taskBase[i] = planBase(s, type);
    L.taskTarget[i] =
      type === PLAN.earn
        ? incomeSec(s, LIVE.taskEarnSec)
        : type === PLAN.merges
          ? pick(s, LIVE.taskMerges)
          : type === PLAN.hires
            ? pick(s, LIVE.taskHires)
            : type === PLAN.taps
              ? pick(s, LIVE.taskTaps)
              : type === PLAN.debiks
                ? pick(s, LIVE.taskDebiks)
                : pick(s, LIVE.taskShifts);
    L.taskClaimed[i] = 0;
  }
  return true;
}

export function taskDone(s: OfficeState, i: number): boolean {
  const L = s.live;
  const type = L.taskType[i] ?? -1;
  return type >= 0 && planProgress(s, type, L.taskBase[i] ?? 0) >= (L.taskTarget[i] ?? Infinity);
}

/** Забрать награду поручения; за все три — печать отдела квадров. */
export function claimTask(s: OfficeState, i: number, q: EventQueue): Result {
  const L = s.live;
  if (!Number.isInteger(i) || i < 0 || i >= TASK_COUNT || L.taskClaimed[i] === 1)
    return DENY.invalid;
  if (!taskDone(s, i)) return DENY.noMoney;
  L.taskClaimed[i] = 1;
  const reward = incomeSec(s, LIVE.taskRewardSec);
  addKukishi(s, reward);
  q.push(EV.rewardClaimed, 0, i, 0, reward);
  if (L.taskClaimed.every((c) => c === 1)) s.stamps += LIVE.tasksBonusStamps;
  return 0;
}

// ——— Аванс и отгул ———

/** Сколько даст аванс сегодня (0 — уже получен). */
export function avansPreview(s: OfficeState, day: number): { reward: number; streak: number } {
  const L = s.live;
  if (L.avansDay === day) return { reward: 0, streak: L.avansStreak };
  const streak = L.avansDay === day - 1 ? Math.min(LIVE.avansMaxStreak, L.avansStreak + 1) : 1;
  return { reward: Math.max(LIVE.avansMin, incomeSec(s, LIVE.avansSecPerDay * streak)), streak };
}

export function claimAvans(s: OfficeState, day: number, q: EventQueue): Result {
  const p = avansPreview(s, day);
  if (p.reward === 0) return DENY.invalid;
  s.live.avansDay = day;
  s.live.avansStreak = p.streak;
  addKukishi(s, p.reward);
  q.push(EV.rewardClaimed, 0, 0, p.streak, p.reward);
  return 0;
}

/** Оффлайн-доход за отсутствие (секунды): половина базового дохода до предела часов. */
export function offlineAmount(s: OfficeState, awaySec: number): number {
  if (!(awaySec > 0)) return 0;
  const capHours = LIVE.offlineBaseHours + LIVE.offlineHoursPerPerk * perkLevel(s, "longOtgul");
  const sec = Math.min(awaySec, capHours * 3600);
  const income = s.incomePerSec / Math.max(1e-9, s.buffMult);
  return Math.floor(income * LIVE.offlineRate * sec);
}

export function claimOffline(
  s: OfficeState,
  amount: number,
  doubled: boolean,
  q: EventQueue,
): void {
  if (amount <= 0) return;
  const total = amount * (doubled ? 2 : 1);
  addKukishi(s, total);
  q.push(EV.rewardClaimed, 0, 0, doubled ? 1 : 0, total);
}
