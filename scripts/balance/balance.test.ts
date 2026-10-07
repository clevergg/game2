import { describe, expect, test } from "bun:test";
import { runBot } from "./bot";
import { TARGETS } from "./targets";

describe("баланс: целевой темп (docs/progression.md §5.2)", () => {
  // Бот детерминирован, симуляция 40 часов игры занимает ~0.5 с.
  // Темп настроен на живого игрока: он открывает записки, ловит дебиков и забирает премию смены
  const m = runBot({ limit: 40 * 3600, tapsPerSec: 2, dt: 0.25, events: true });
  for (const target of TARGETS) {
    test(`${target.label}: в пределах ${(target.min / 3600).toFixed(1)}–${(target.max / 3600).toFixed(1)} ч`, () => {
      const t = m[target.key];
      expect(t).toBeDefined();
      expect(t ?? 0).toBeGreaterThanOrEqual(target.min);
      expect(t ?? 0).toBeLessThanOrEqual(target.max);
    });
  }

  test("реорганизаций за всю игру — разумное число, без «пулемёта»", () => {
    expect(m.reorgs).toBeGreaterThanOrEqual(5);
    expect(m.reorgs).toBeLessThanOrEqual(30);
  });

  test("события ускоряют, но не ломают темп: пассивный игрок тоже проходит игру", () => {
    const passive = runBot({ limit: 40 * 3600, tapsPerSec: 2, dt: 0.25 });
    expect(passive.allCards).toBeDefined();
    expect(passive.allCards ?? 0).toBeGreaterThan(m.allCards ?? 0);
    expect(passive.allCards ?? 0).toBeLessThan((m.allCards ?? 0) * 2.5);
  });
});
