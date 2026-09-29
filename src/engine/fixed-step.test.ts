import { describe, expect, test } from "bun:test";
import { FixedStep } from "./fixed-step";

describe("FixedStep", () => {
  test("копит остаток между кадрами", () => {
    const fs = new FixedStep(50, 250);
    expect(fs.advance(30)).toBe(0);
    expect(fs.advance(30)).toBe(1);
    expect(fs.alpha).toBeCloseTo(10 / 50);
  });

  test("длинный кадр даёт несколько шагов", () => {
    const fs = new FixedStep(50, 250);
    expect(fs.advance(160)).toBe(3);
    expect(fs.alpha).toBeCloseTo(10 / 50);
  });

  test("ограничивает кадр после зависания", () => {
    const fs = new FixedStep(50, 250);
    expect(fs.advance(10_000)).toBe(5);
    expect(fs.alpha).toBe(0);
  });

  test("игнорирует отрицательное время", () => {
    const fs = new FixedStep(50, 250);
    expect(fs.advance(-100)).toBe(0);
    expect(fs.alpha).toBe(0);
  });

  test("reset обнуляет остаток", () => {
    const fs = new FixedStep(50, 250);
    fs.advance(40);
    fs.reset();
    expect(fs.alpha).toBe(0);
  });

  test("отклоняет неверные параметры", () => {
    expect(() => new FixedStep(0, 250)).toThrow(RangeError);
    expect(() => new FixedStep(50, 10)).toThrow(RangeError);
  });
});
