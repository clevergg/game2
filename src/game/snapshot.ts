/**
 * Снимки состояния для интерфейса: чистые функции «состояние core → данные экрана».
 * UI не читает OfficeState напрямую — только эти представления (раз в 100 мс).
 */
import { BALANCE } from "../data/balance";
import { FLOOR_COUNT } from "../data/floors";
import { PERK_COUNT, perkMax } from "../data/perks";
import { perkCost, reorgGain } from "../core/commands";
import { deskCost, earnedForGain, equipCost, qualCost } from "../core/economy";
import { avansPreview, planProgress, taskDone } from "../core/live";
import { CNT, TASK_COUNT } from "../core/live-state";
import type { OfficeState } from "../core/state";
import type { ChallengeView, HrView, ShiftView, TasksView } from "../ui/store";

export function shiftView(s: OfficeState): ShiftView {
  const L = s.live;
  if (L.shiftType < 0) return { type: -1, target: 0, progress: 0, reward: 0, wait: L.shiftWait };
  return {
    type: L.shiftType,
    target: L.shiftTarget,
    progress: Math.min(L.shiftTarget, Math.max(0, planProgress(s, L.shiftType, L.shiftBase))),
    reward: L.shiftReward,
    wait: 0,
  };
}

export function challengeView(s: OfficeState): ChallengeView | null {
  const L = s.live;
  if (L.shabLeft > 0) {
    return {
      kind: "shabashka",
      left: L.shabLeft,
      have: Math.min(L.shabNeed, (L.counters[CNT.taps] ?? 0) - L.shabBase),
      need: L.shabNeed,
    };
  }
  if (L.inspLeft > 0) {
    return {
      kind: "inspection",
      left: L.inspLeft,
      have: Math.min(L.inspTarget, (L.counters[CNT.earned] ?? 0) - L.inspBase),
      need: L.inspTarget,
    };
  }
  return null;
}

export function hrView(s: OfficeState, fi: number): HrView | null {
  const f = s.floors[fi];
  if (!f || fi >= s.floorsUnlocked) return null;
  const gain = reorgGain(s);
  const perks = [];
  for (let i = 0; i < PERK_COUNT; i++) {
    perks.push({ level: s.perks[i] ?? 0, max: perkMax(i), cost: perkCost(s, i) });
  }
  return {
    qual: f.qual,
    qualMax: BALANCE.qualMax,
    qualCost: qualCost(fi, f.qual),
    equip: f.equip,
    equipCost: equipCost(fi, f.equip),
    equipPct: Math.round(f.equip * BALANCE.equipStep * 100),
    deskCount: f.deskCount,
    desksMax: BALANCE.desksMax,
    deskCost: deskCost(fi, f.desksBought),
    seniority: s.seniority,
    seniorityPct: Math.round(s.seniority * BALANCE.seniorityBonus * 100),
    stamps: s.stamps,
    reorgGain: gain,
    reorgNeed: gain >= 1 ? 0 : Math.max(0, Math.ceil(earnedForGain(1) - s.earnedThisRun)),
    perks,
    cards: Array.from(s.cards.subarray(0, FLOOR_COUNT)),
    rareCards: Array.from(s.rareCards.subarray(0, FLOOR_COUNT)),
  };
}

export function tasksView(s: OfficeState, day: number): TasksView {
  const L = s.live;
  const items = [];
  for (let i = 0; i < TASK_COUNT; i++) {
    const type = L.taskType[i] ?? -1;
    const target = L.taskTarget[i] ?? 0;
    items.push({
      type,
      target,
      progress:
        type < 0 ? 0 : Math.min(target, Math.max(0, planProgress(s, type, L.taskBase[i] ?? 0))),
      claimed: L.taskClaimed[i] === 1,
    });
  }
  const avans = avansPreview(s, day);
  return { items, avansReward: avans.reward, avansStreak: avans.streak };
}

/** Бейдж «Поручений»: сколько наград можно забрать прямо сейчас (с авансом). */
export function tasksBadge(s: OfficeState, day: number): number {
  let n = avansPreview(s, day).reward > 0 ? 1 : 0;
  for (let i = 0; i < TASK_COUNT; i++) if (s.live.taskClaimed[i] !== 1 && taskDone(s, i)) n++;
  return n;
}

/** Бейдж отдела квадров: есть на что потратить печати или пора реорганизоваться. */
export function hrBadge(s: OfficeState): boolean {
  if (reorgGain(s) >= Math.max(1, s.seniority)) return true;
  for (let i = 0; i < PERK_COUNT; i++) {
    if ((s.perks[i] ?? 0) < perkMax(i) && s.stamps >= perkCost(s, i)) return true;
  }
  return false;
}
