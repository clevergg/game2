/** `bun scripts/balance/sources.ts [часы]` — откуда приходят кукиши у бота с событиями (отладка баланса). */
import { EV } from "../../src/core/events";
import { runBot } from "./bot";

const hours = Number(process.argv[2] ?? 1);
const names = new Map<number, string>(Object.entries(EV).map(([k, v]) => [v, k]));
const sum = new Map<string, number>();
const cnt = new Map<string, number>();
const SOURCES: Set<number> = new Set([
  EV.payout,
  EV.tap,
  EV.noteOpened,
  EV.debikCaught,
  EV.shabashkaWon,
  EV.inspectionWon,
  EV.rewardClaimed,
  EV.shiftDone,
  EV.buffStarted,
]);
runBot({
  limit: hours * 3600,
  tapsPerSec: 2,
  dt: 0.25,
  events: true,
  onEvents: (q) => {
    for (let i = 0; i < q.length; i++) {
      const k = q.kind[i] ?? 0;
      if (!SOURCES.has(k)) continue;
      const n = names.get(k) ?? String(k);
      sum.set(n, (sum.get(n) ?? 0) + (q.value[i] ?? 0));
      cnt.set(n, (cnt.get(n) ?? 0) + 1);
    }
  },
});
const total = (sum.get("payout") ?? 0) + (sum.get("tap") ?? 0);
for (const [n, v] of sum) {
  console.log(
    `${n.padEnd(16)} ×${String(cnt.get(n)).padEnd(6)} ${v.toExponential(2)}  (${((v / total) * 100).toFixed(1)}% от выплат+тапов)`,
  );
}
