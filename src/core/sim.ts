/** Шаг симуляции: батраканы колупают циферки и выплачивают кукиши порциями раз в период. */
import { BALANCE } from "../data/balance";
import { incomeOf } from "./economy";
import { EV, type EventQueue } from "./events";
import { addKukishi, type OfficeState } from "./state";

export function step(s: OfficeState, dt: number, q: EventQueue): void {
  const period = BALANCE.payoutPeriod;
  for (let i = 0; i < s.deskCount; i++) {
    const rank = s.desks[i] ?? 0;
    if (rank === 0) continue;
    let t = (s.payoutTimers[i] ?? period) - dt;
    // После долгой паузы кадра может накопиться несколько выплат — отдаём все, но одним событием
    let payouts = 0;
    while (t <= 0) {
      t += period;
      payouts++;
    }
    s.payoutTimers[i] = t;
    if (payouts > 0) {
      const amount = incomeOf(rank) * period * payouts;
      addKukishi(s, amount);
      q.push(EV.payout, i, rank, amount);
    }
  }
}
