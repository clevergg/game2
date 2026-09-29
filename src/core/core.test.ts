import { describe, expect, test } from "bun:test";
import { BALANCE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";
import { currentHireCost, hire, move, tap, trash } from "./commands";
import { hireCost, hireLevel, incomeOf, tapValue, trashRefund } from "./economy";
import { DENY, EV, EventQueue } from "./events";
import { fromSave, toSave } from "./save";
import { step } from "./sim";
import { createState, type OfficeState, recomputeIncome } from "./state";

function kinds(q: EventQueue): number[] {
  return Array.from(q.kind.subarray(0, q.length));
}

function withDesks(ranks: number[], kukishi = 0): OfficeState {
  const s = createState();
  s.desks.fill(0);
  ranks.forEach((r, i) => (s.desks[i] = r));
  s.maxRank = Math.max(1, ...ranks);
  s.kukishi = kukishi;
  for (const r of ranks) if (r > 0) s.collection |= 1 << (r - 1);
  recomputeIncome(s);
  return s;
}

describe("economy — инварианты GDD §4.4", () => {
  test("слияние всегда повышает доход: inc(r+1) > 2·inc(r)", () => {
    for (let r = 1; r < MAX_RANK; r++) expect(incomeOf(r + 1)).toBeGreaterThan(2 * incomeOf(r));
  });

  test("цена найма монотонно растёт по числу нанятых и по уровню", () => {
    for (let L = 1; L <= MAX_RANK; L++) {
      for (let n = 0; n < 50; n++)
        expect(hireCost(L, n + 1)).toBeGreaterThanOrEqual(hireCost(L, n));
      if (L < MAX_RANK) expect(hireCost(L + 1, 0)).toBeGreaterThan(hireCost(L, 0));
    }
  });

  test("уровень найма отстаёт от максимального ранга, но не ниже 1", () => {
    expect(hireLevel(1)).toBe(1);
    expect(hireLevel(4)).toBe(1);
    expect(hireLevel(7)).toBe(7 - BALANCE.hireLag);
  });

  test("тап приносит хотя бы 1 кукиш", () => {
    expect(tapValue(0)).toBe(1);
    expect(tapValue(100)).toBe(16);
  });

  test("слоповина возвращает меньше, чем стоит найм", () => {
    for (let r = 1; r <= MAX_RANK; r++) expect(trashRefund(r)).toBeLessThan(hireCost(r, 0));
  });
});

describe("старт игры", () => {
  test("один стажёр за первым столом, 8 открытых столов", () => {
    const s = createState();
    expect(s.desks[0]).toBe(1);
    expect(s.deskCount).toBe(BALANCE.desksStart);
    expect(s.incomePerSec).toBe(1);
  });

  test("второго батракана можно нанять за несколько секунд тапов", () => {
    const s = createState();
    const q = new EventQueue();
    let seconds = 0;
    while (s.kukishi < currentHireCost(s)) {
      for (let k = 0; k < 4; k++) tap(s, 0, q); // ~4 тапа в секунду
      step(s, 1, q);
      seconds++;
    }
    expect(seconds).toBeLessThanOrEqual(2);
  });
});

describe("commands", () => {
  test("найм списывает цену, занимает свободный стол и растит цену", () => {
    const s = withDesks([1], 100);
    const q = new EventQueue();
    const cost = currentHireCost(s);
    expect(hire(s, q)).toBe(0);
    expect(s.kukishi).toBe(100 - cost);
    expect(s.desks[1]).toBe(1);
    expect(currentHireCost(s)).toBeGreaterThan(cost);
    expect(kinds(q)).toEqual([EV.hired]);
  });

  test("найм без денег и без мест отклоняется, состояние не меняется", () => {
    const poor = withDesks([1], 0);
    const q = new EventQueue();
    expect(hire(poor, q)).toBe(DENY.noMoney);
    expect(poor.desks[1]).toBe(0);
    const full = withDesks([1, 1, 1, 1, 1, 1, 1, 1], 1e9);
    expect(hire(full, q)).toBe(DENY.noSpace);
    expect(full.kukishi).toBe(1e9);
  });

  test("слияние двух одинаковых — повышение, открытие ранга, рост дохода", () => {
    const s = withDesks([2, 2]);
    const q = new EventQueue();
    const before = s.incomePerSec;
    expect(move(s, 0, 1, q)).toBe(0);
    expect(s.desks[0]).toBe(0);
    expect(s.desks[1]).toBe(3);
    expect(s.maxRank).toBe(3);
    expect(s.incomePerSec).toBeGreaterThan(before);
    expect(kinds(q)).toEqual([EV.merged, EV.rankUnlocked]);
  });

  test("повторное открытие ранга не порождает событие", () => {
    const s = withDesks([2, 2, 3]);
    const q = new EventQueue();
    move(s, 0, 1, q);
    expect(kinds(q)).toEqual([EV.merged]);
  });

  test("максимальный ранг не сливается — меняются местами", () => {
    const s = withDesks([MAX_RANK, MAX_RANK]);
    const q = new EventQueue();
    move(s, 0, 1, q);
    expect([s.desks[0], s.desks[1]]).toEqual([MAX_RANK, MAX_RANK]);
    expect(kinds(q)).toEqual([EV.swapped]);
  });

  test("разные ранги меняются местами, на пустой стол — перенос", () => {
    const s = withDesks([1, 3]);
    const q = new EventQueue();
    move(s, 0, 1, q);
    expect([s.desks[0], s.desks[1]]).toEqual([3, 1]);
    move(s, 1, 5, q);
    expect([s.desks[1], s.desks[5]]).toEqual([0, 1]);
    expect(kinds(q)).toEqual([EV.swapped, EV.moved]);
  });

  test("неверные ходы отклоняются", () => {
    const s = withDesks([1]);
    const q = new EventQueue();
    expect(move(s, 0, 0, q)).toBe(DENY.invalid);
    expect(move(s, 3, 1, q)).toBe(DENY.invalid);
    expect(move(s, 0, 11, q)).toBe(DENY.invalid); // стол закрыт
    expect(tap(s, 4, q)).toBe(DENY.invalid);
  });

  test("слоповина: возврат кукишей, стол свободен; последнего выбросить нельзя", () => {
    const s = withDesks([1, 4]);
    const q = new EventQueue();
    expect(trash(s, 1, q)).toBe(0);
    expect(s.desks[1]).toBe(0);
    expect(s.kukishi).toBe(trashRefund(4));
    expect(trash(s, 0, q)).toBe(DENY.invalid);
    expect(s.desks[0]).toBe(1);
  });
});

describe("sim", () => {
  test("за минуту каждый стол выплачивает ровно свой доход", () => {
    const s = withDesks([1, 3, 5]);
    const q = new EventQueue(1024);
    for (let i = 0; i < 60 * 20; i++) step(s, 0.05, q);
    const expected = 60 * (incomeOf(1) + incomeOf(3) + incomeOf(5));
    // Допуск — одна выплата каждого стола (фаза таймера)
    expect(Math.abs(s.kukishi - expected)).toBeLessThanOrEqual(
      incomeOf(1) + incomeOf(3) + incomeOf(5),
    );
  });

  test("после зависания кадра выплаты не теряются и идут одним событием", () => {
    const s = withDesks([2]);
    const q = new EventQueue();
    step(s, 10, q);
    expect(q.length).toBe(1);
    expect(q.value[0]).toBeGreaterThanOrEqual(9 * incomeOf(2));
  });
});

describe("events", () => {
  test("переполнение не падает и считается", () => {
    const q = new EventQueue(2);
    q.push(EV.tap);
    q.push(EV.tap);
    q.push(EV.tap);
    expect(q.length).toBe(2);
    expect(q.dropped).toBe(1);
    q.clear();
    expect(q.length).toBe(0);
  });
});

describe("save", () => {
  test("сохранение → загрузка даёт то же состояние", () => {
    const s = withDesks([1, 2, 7, 0, 3], 12345.5);
    s.hires[2] = 7;
    s.totalEarned = 99999;
    const json = JSON.parse(JSON.stringify(toSave(s, 1))) as unknown;
    const back = fromSave(json);
    expect(back).not.toBeNull();
    if (!back) return;
    expect(Array.from(back.desks)).toEqual(Array.from(s.desks));
    expect(back.kukishi).toBe(s.kukishi);
    expect(back.hires[2]).toBe(7);
    expect(back.maxRank).toBe(s.maxRank);
    expect(back.incomePerSec).toBe(s.incomePerSec);
  });

  test("битые сохранения отбрасываются", () => {
    const good = toSave(createState(), 0);
    const cases: unknown[] = [
      null,
      "мусор",
      { ...good, v: 2 },
      { ...good, desks: [1] },
      { ...good, desks: good.desks.map(() => 99) },
      { ...good, kukishi: -5 },
      { ...good, kukishi: Number.NaN },
      { ...good, deskCount: 3 },
      { ...good, maxRank: 0 },
      { ...good, desks: good.desks.map((_, i) => (i === 11 ? 1 : 0)) }, // батракан за закрытым столом
    ];
    for (const c of cases) expect(fromSave(c)).toBeNull();
  });
});
