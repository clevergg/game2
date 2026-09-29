import { describe, expect, test } from "bun:test";
import { OUTLINE_INDEX, paletteHex, paletteIndex, RAMP_NAMES, TRANSPARENT_INDEX } from "./palette";
import { MAX_RANK, RANK_IDS, rankId } from "./ranks";

describe("palette", () => {
  test("влезает в 8-битный PNG и цвета не повторяются", () => {
    const hex = paletteHex();
    expect(hex.length + 1).toBeLessThanOrEqual(256);
    expect(new Set(hex).size).toBe(hex.length);
  });

  test("индексы рамп не пересекаются со служебными", () => {
    const first = RAMP_NAMES[0];
    const last = RAMP_NAMES.at(-1);
    if (!first || !last) throw new Error("пустая палитра");
    expect(paletteIndex(first, 0)).toBeGreaterThan(Math.max(TRANSPARENT_INDEX, OUTLINE_INDEX));
    expect(paletteIndex(last, 3)).toBe(paletteHex().length);
  });
});

describe("ranks", () => {
  test("10 рангов и id по номеру", () => {
    expect(MAX_RANK).toBe(10);
    expect(rankId(1)).toBe("intern");
    expect(rankId(10)).toBe("closeToBoss");
    expect(new Set(RANK_IDS).size).toBe(RANK_IDS.length);
  });

  test("несуществующий ранг — ошибка", () => {
    expect(() => rankId(0)).toThrow(RangeError);
    expect(() => rankId(11)).toThrow(RangeError);
  });
});
