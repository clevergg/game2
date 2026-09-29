import { describe, expect, test } from "bun:test";
import { columnsFor, computeLayout, HUD_BOTTOM, HUD_TOP } from "./layout";
import { nextStage, parseStage, TUTORIAL } from "./tutorial";

const METRICS = { deskW: 129, deskTop: 91, charTop: 150 };

describe("layout", () => {
  const phones: [number, number][] = [
    [320, 568],
    [360, 640],
    [375, 667],
    [390, 844],
    [412, 915],
    [1280, 720],
  ];
  for (const [w, h] of phones) {
    test(`${w}×${h}: столы внутри игровой области и не наезжают по горизонтали`, () => {
      const L = computeLayout(w, h, 8, 12, METRICS);
      for (let i = 0; i < 8; i++) {
        const x = L.deskX[i] ?? 0;
        const y = L.deskY[i] ?? 0;
        expect(x - (METRICS.deskW / 2) * L.scale).toBeGreaterThanOrEqual(0);
        expect(x + (METRICS.deskW / 2) * L.scale).toBeLessThanOrEqual(w);
        expect(y).toBeLessThanOrEqual(h - HUD_BOTTOM);
        // Голова батракана не уходит под верхнюю панель
        expect(y - METRICS.charTop * L.scale).toBeGreaterThanOrEqual(HUD_TOP - 1);
      }
      const gap = (L.deskX[1] ?? 0) - (L.deskX[0] ?? 0);
      expect(gap).toBeGreaterThan(METRICS.deskW * L.scale);
    });
  }

  test("8 столов — 2 колонки, больше — 3", () => {
    expect(columnsFor(8)).toBe(2);
    expect(columnsFor(9)).toBe(3);
    expect(computeLayout(390, 844, 12, 12, METRICS).rows).toBe(4);
  });

  test("на десктопе игра в центральной колонке", () => {
    const L = computeLayout(1920, 1080, 8, 12, METRICS);
    expect(L.contentW).toBeLessThanOrEqual(520);
    expect(L.contentLeft).toBeGreaterThan(600);
  });
});

describe("tutorial", () => {
  test("тап → найм → слияние → готово", () => {
    let s = nextStage(TUTORIAL.tap, { taps: 1, hires: 0, merges: 0 });
    expect(s).toBe(TUTORIAL.tap);
    s = nextStage(s, { taps: 3, hires: 0, merges: 0 });
    expect(s).toBe(TUTORIAL.hire);
    s = nextStage(s, { taps: 3, hires: 1, merges: 0 });
    expect(s).toBe(TUTORIAL.merge);
    s = nextStage(s, { taps: 3, hires: 1, merges: 1 });
    expect(s).toBe(TUTORIAL.done);
  });

  test("сообразительный игрок, который сразу слил, пропускает подсказки", () => {
    expect(nextStage(TUTORIAL.tap, { taps: 0, hires: 1, merges: 1 })).toBe(TUTORIAL.done);
  });

  test("сохранённая стадия читается безопасно", () => {
    expect(parseStage(null)).toBe(TUTORIAL.tap);
    expect(parseStage("2")).toBe(TUTORIAL.merge);
    expect(parseStage("мусор")).toBe(TUTORIAL.tap);
    expect(parseStage("99")).toBe(TUTORIAL.tap);
  });
});
