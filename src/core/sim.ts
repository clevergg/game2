/** Шаг симуляции: выплаты со столов всех открытых этажей и автослияние (перк). */
import { BALANCE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";
import { mergeDesks } from "./commands";
import { EV, type EventQueue } from "./events";
import { addKukishi, deskPayout, type OfficeState, perkLevel } from "./state";

export function step(s: OfficeState, dt: number, q: EventQueue): void {
  const period = BALANCE.payoutPeriod;
  for (let fi = 0; fi < s.floorsUnlocked; fi++) {
    const f = s.floors[fi];
    if (!f) continue;
    for (let i = 0; i < f.deskCount; i++) {
      const rank = f.desks[i] ?? 0;
      if (rank === 0) continue;
      let t = (f.payoutTimers[i] ?? period) - dt;
      // После долгого кадра может накопиться несколько выплат — отдаём все одним событием
      let payouts = 0;
      while (t <= 0) {
        t += period;
        payouts++;
      }
      f.payoutTimers[i] = t;
      if (payouts > 0) {
        const amount = deskPayout(s, fi, i) * payouts;
        addKukishi(s, amount);
        q.push(EV.payout, fi, i, rank, amount);
      }
    }
  }
  if (perkLevel(s, "autoMerge") > 0) {
    s.autoMergeTimer -= dt;
    if (s.autoMergeTimer <= 0) {
      s.autoMergeTimer += BALANCE.autoMergePeriod;
      autoMergeOnce(s, q);
    }
  }
}

/** Сливает одну пару одинаковых батраканов на каждом этаже (младшие ранги — в первую очередь). */
export function autoMergeOnce(s: OfficeState, q: EventQueue): void {
  for (let fi = 0; fi < s.floorsUnlocked; fi++) {
    const f = s.floors[fi];
    if (!f) continue;
    let bestRank: number = MAX_RANK;
    let from = -1;
    let to = -1;
    for (let i = 0; i < f.deskCount; i++) {
      const r = f.desks[i] ?? 0;
      if (r === 0 || r >= bestRank) continue;
      for (let j = i + 1; j < f.deskCount; j++) {
        if (f.desks[j] === r) {
          bestRank = r;
          from = j;
          to = i;
          break;
        }
      }
    }
    if (from >= 0) mergeDesks(s, fi, f, from, to, q);
  }
}
