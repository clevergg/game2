import { describe, expect, test } from "bun:test";
import { en } from "./en";
import { compactParts, formatCompact } from "./format";
import { detectLang, fmt, rankName, setLang, t } from "./index";
import { ru } from "./ru";

describe("formatCompact", () => {
  const cases: [number, string, string][] = [
    [0, "0", "0"],
    [12.7, "12", "12"],
    [999, "999", "999"],
    [1000, "1 тыс.", "1K"],
    [1250, "1,2 тыс.", "1.2K"],
    [12400, "12,4 тыс.", "12.4K"],
    [99999, "99,9 тыс.", "99.9K"],
    [123456, "123 тыс.", "123K"],
    [1_500_000, "1,5 млн", "1.5M"],
    [2e9, "2 млрд", "2B"],
    [3.3e12, "3,3 трлн", "3.3T"],
    [5e15, "5000 трлн", "5000T"],
  ];
  for (const [v, r, e] of cases) {
    test(`${v} → «${r}» / «${e}»`, () => {
      expect(formatCompact(v, ru.number)).toBe(r);
      expect(formatCompact(v, en.number)).toBe(e);
    });
  }

  test("границы степеней не ломаются из-за неточности log10", () => {
    const p = { int: 0, frac: -1, suffix: 0 };
    for (const k of [1, 2, 3, 4]) {
      compactParts(1000 ** k, p);
      expect([p.int, p.suffix]).toEqual([1, k]);
      compactParts(1000 ** k - 1, p);
      expect(p.suffix).toBe(k - 1);
    }
  });
});

describe("язык", () => {
  test("русский для ru/be/kk/uk/uz, иначе английский", () => {
    expect(detectLang("ru-RU")).toBe("ru");
    expect(detectLang("kk")).toBe("ru");
    expect(detectLang("uk_UA")).toBe("ru");
    expect(detectLang("en-US")).toBe("en");
    expect(detectLang("tr")).toBe("en");
    expect(detectLang(undefined)).toBe("en");
  });

  test("переключение словаря", () => {
    setLang("en");
    expect(t("hire")).toBe("Hire a Workroach");
    expect(rankName(10)).toBe("Close to the Boss");
    expect(fmt(1250)).toBe("1.2K");
    setLang("ru");
    expect(t("hire")).toBe("Нанять батракана");
    expect(fmt(1250)).toBe("1,2 тыс.");
  });
});
