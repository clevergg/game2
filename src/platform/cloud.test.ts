import { describe, expect, test } from "bun:test";
import { pickNewest, savedAtOf, Throttle } from "./cloud";

const save = (t: number): string => JSON.stringify({ v: 2, savedAt: t });

describe("облачные сохранения", () => {
  test("берётся более свежее из двух", () => {
    expect(pickNewest(save(10), save(20))).toBe(save(20));
    expect(pickNewest(save(30), save(20))).toBe(save(30));
    expect(pickNewest(save(10), null)).toBe(save(10));
    expect(pickNewest(null, save(10))).toBe(save(10));
    expect(pickNewest(null, null)).toBeNull();
  });

  test("битое сохранение проигрывает читаемому", () => {
    expect(pickNewest("{oops", save(1))).toBe(save(1));
    expect(pickNewest(save(1), "")).toBe(save(1));
    expect(savedAtOf('{"v":2}')).toBe(0);
    expect(savedAtOf("[]")).toBe(0);
  });

  test("ограничитель частоты: обычная запись реже, flush — сразу, но не спамом", () => {
    const t = new Throttle(60_000, 2_000);
    expect(t.ready(0, false)).toBe(true);
    expect(t.ready(30_000, false)).toBe(false);
    expect(t.ready(30_000, true)).toBe(true);
    expect(t.ready(31_000, true)).toBe(false);
    expect(t.ready(95_000, false)).toBe(true);
    expect(t.wait(96_000, true)).toBe(1_000);
    expect(t.wait(96_000, false)).toBe(59_000);
  });
});
