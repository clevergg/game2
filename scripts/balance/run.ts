/** `bun run balance` — прогоняет бота и сравнивает времена вех с целевым темпом (progression.md §5.2). */
import { type Milestones, runBot } from "./bot";
import { TARGETS } from "./targets";

const fmt = (t?: number): string => {
  if (t === undefined) return "не достигнуто";
  if (t < 3600) return `${(t / 60).toFixed(0)} мин`;
  return `${(t / 3600).toFixed(1)} ч`;
};

const started = performance.now();
const m: Milestones = runBot({ limit: 40 * 3600, tapsPerSec: 2, dt: 0.25 });
let ok = true;
console.log("Веха                         Бот            Цель");
for (const target of TARGETS) {
  const t = m[target.key];
  const inRange = t !== undefined && t >= target.min && t <= target.max;
  if (!inRange) ok = false;
  console.log(
    `${inRange ? "✅" : "❌"} ${target.label.padEnd(26)} ${fmt(t).padEnd(14)} ${fmt(target.min)} – ${fmt(target.max)}`,
  );
}
console.log(
  `\nРеорганизаций: ${m.reorgs}, выслуга: ${m.seniority}. Симуляция: ${((performance.now() - started) / 1000).toFixed(1)} с`,
);
if (!ok) process.exitCode = 1;
