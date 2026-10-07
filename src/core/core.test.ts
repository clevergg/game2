import { describe, expect, test } from "bun:test";
import { BALANCE } from "../data/balance";
import { FLOOR_COUNT } from "../data/floors";
import { PERKS, perkIndex } from "../data/perks";
import { MAX_RANK } from "../data/ranks";
import {
  buyDesk,
  buyEquip,
  buyPerk,
  buyQual,
  currentHireCost,
  hire,
  hireFree,
  move,
  reorganize,
  reorgGain,
  tap,
  trash,
  unlockFloor,
} from "./commands";
import {
  deskCost,
  earnedForGain,
  equipCost,
  floorUnlockCost,
  hireCost,
  qualCost,
  rankIncome,
  seniorityGain,
  tapValue,
  trashRefund,
} from "./economy";
import { DENY, EV, EventQueue } from "./events";
import { fromSave, toSave } from "./save";
import { autoMergeOnce, step } from "./sim";
import { createState, type OfficeState, recomputeIncome } from "./state";

const kinds = (q: EventQueue): number[] => Array.from(q.kind.subarray(0, q.length));

function withDesks(ranks: number[], kukishi = 0, fi = 0): OfficeState {
  const s = createState();
  s.floorsUnlocked = Math.max(s.floorsUnlocked, fi + 1);
  const f = s.floors[fi];
  if (!f) throw new Error("нет этажа");
  f.desks.fill(0);
  ranks.forEach((r, i) => (f.desks[i] = r));
  s.kukishi = kukishi;
  recomputeIncome(s);
  return s;
}

describe("economy — инварианты", () => {
  test("слияние всегда выгодно: доход ранга r+1 больше двух рангов r", () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      for (let r = 1; r < MAX_RANK; r++)
        expect(rankIncome(f, r + 1)).toBeGreaterThan(2 * rankIncome(f, r));
    }
  });

  test("следующий этаж богаче и дороже предыдущего", () => {
    for (let f = 1; f < FLOOR_COUNT; f++) {
      expect(rankIncome(f, 1)).toBeGreaterThan(rankIncome(f - 1, MAX_RANK) / 100);
      expect(rankIncome(f, 1)).toBeGreaterThan(rankIncome(f - 1, 1));
      expect(floorUnlockCost(f)).toBeGreaterThan(floorUnlockCost(f - 1));
    }
  });

  test("цены монотонно растут", () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      for (let n = 0; n < 300; n += 7)
        expect(hireCost(f, 1, n + 1, 0)).toBeGreaterThanOrEqual(hireCost(f, 1, n, 0));
      for (let k = 0; k < 6; k++) {
        expect(qualCost(f, k + 2)).toBeGreaterThan(qualCost(f, k + 1));
        expect(equipCost(f, k + 1)).toBeGreaterThan(equipCost(f, k));
        expect(deskCost(f, k + 1)).toBeGreaterThan(deskCost(f, k));
      }
    }
  });

  test("найм ранга q стоит как 2^(q−1) найма ранга 1 при том же счётчике", () => {
    expect(hireCost(0, 4, 0, 0)).toBe(hireCost(0, 1, 0, 0) * 8);
  });

  test("бережливость снижает цену найма", () => {
    expect(hireCost(0, 1, 50, 3)).toBeLessThan(hireCost(0, 1, 50, 0));
  });

  test("тап — минимум 1 кукиш; слоповина возвращает меньше цены найма", () => {
    expect(tapValue(0)).toBe(1);
    for (let r = 1; r <= MAX_RANK; r++)
      expect(trashRefund(0, r)).toBeLessThan(hireCost(0, r, 0, 0));
  });

  test("выслуга растёт как степень заработанного (reorgExp) и обратима через earnedForGain", () => {
    expect(seniorityGain(BALANCE.reorgBase * 0.99)).toBe(0);
    expect(seniorityGain(BALANCE.reorgBase)).toBe(1);
    for (const k of [2, 5, 10, 40]) expect(seniorityGain(earnedForGain(k))).toBe(k);
    expect(seniorityGain(earnedForGain(10) * 0.98)).toBe(9);
  });
});

describe("старт", () => {
  test("открыт один этаж, за первым столом стажёр, картотека знает ранг 1", () => {
    const s = createState();
    expect(s.floorsUnlocked).toBe(1);
    expect(s.floors[0]?.desks[0]).toBe(1);
    expect(s.cards[0]).toBe(1);
    expect(s.incomePerSec).toBeGreaterThan(0);
  });

  test("второго батракана можно нанять за несколько секунд тапов", () => {
    const s = createState();
    const q = new EventQueue(1024);
    let seconds = 0;
    while (s.kukishi < currentHireCost(s, 0)) {
      for (let k = 0; k < 3; k++) tap(s, 0, 0, q);
      step(s, 1, q);
      seconds++;
    }
    expect(seconds).toBeLessThanOrEqual(3);
  });
});

describe("найм и квалификация", () => {
  test("найм нанимает ранг квалификации и копит удорожание", () => {
    const s = withDesks([1], 1e9);
    const f = s.floors[0];
    if (!f) return;
    f.qual = 3;
    const q = new EventQueue();
    const cost = currentHireCost(s, 0);
    expect(hire(s, 0, q)).toBe(0);
    expect(f.desks[1]).toBe(3);
    expect(f.hires).toBe(1);
    expect(s.kukishi).toBe(1e9 - cost);
    expect(currentHireCost(s, 0)).toBeGreaterThan(cost);
  });

  test("отказы не меняют состояние", () => {
    const q = new EventQueue();
    const poor = withDesks([1], 0);
    expect(hire(poor, 0, q)).toBe(DENY.noMoney);
    expect(poor.floors[0]?.desks[1]).toBe(0);
    const full = withDesks([1, 1, 1, 1, 1, 1, 1, 1], 1e12);
    expect(hire(full, 0, q)).toBe(DENY.noSpace);
    expect(full.kukishi).toBe(1e12);
    expect(hire(createState(), 1, q)).toBe(DENY.locked);
  });

  test("квалификация: цена, предел", () => {
    const s = withDesks([1], 1e30);
    const q = new EventQueue(64);
    for (let k = 1; k < BALANCE.qualMax; k++) expect(buyQual(s, 0, q)).toBe(0);
    expect(s.floors[0]?.qual).toBe(BALANCE.qualMax);
    expect(buyQual(s, 0, q)).toBe(DENY.maxed);
  });

  test("найм по блату бесплатен, но двигает удорожание", () => {
    const s = withDesks([1], 0);
    const q = new EventQueue();
    const before = currentHireCost(s, 0);
    expect(hireFree(s, 0, q)).toBe(0);
    expect(s.kukishi).toBe(0);
    expect(currentHireCost(s, 0)).toBeGreaterThan(before);
  });
});

describe("слияние, перенос, слоповина", () => {
  test("слияние: ранг выше, карточка, рост дохода", () => {
    const s = withDesks([2, 2]);
    const q = new EventQueue();
    const before = s.incomePerSec;
    expect(move(s, 0, 0, 1, q)).toBe(0);
    expect(s.floors[0]?.desks[1]).toBe(3);
    expect(s.incomePerSec).toBeGreaterThan(before);
    expect(kinds(q)).toContain(EV.merged);
    expect((s.cards[0] ?? 0) & 0b100).toBe(0b100);
  });

  test("премированность сохраняется при слиянии и удваивает доход", () => {
    const s = withDesks([3, 3]);
    const f = s.floors[0];
    if (!f) return;
    f.rare[0] = 1;
    recomputeIncome(s);
    move(s, 0, 1, 0, new EventQueue());
    expect(f.rare[0]).toBe(1);
    expect(f.desks[0]).toBe(4);
    const plain = withDesks([4]);
    plain.cards[0] = s.cards[0] ?? 0; // одинаковый бонус картотеки
    recomputeIncome(plain);
    expect(s.incomePerSec).toBeCloseTo(plain.incomePerSec * BALANCE.rareMult);
  });

  test("максимальный ранг не сливается — обмен; разные — обмен; на пустой — перенос", () => {
    const s = withDesks([MAX_RANK, MAX_RANK, 3]);
    const q = new EventQueue();
    move(s, 0, 0, 1, q);
    move(s, 0, 0, 2, q);
    move(s, 0, 2, 5, q);
    expect(Array.from(s.floors[0]?.desks.subarray(0, 6) ?? [])).toEqual([
      3,
      MAX_RANK,
      0,
      0,
      0,
      MAX_RANK,
    ]);
    expect(kinds(q)).toEqual([EV.swapped, EV.swapped, EV.moved]);
  });

  test("слоповина: возврат, последнего выбросить нельзя", () => {
    const s = withDesks([1, 4]);
    const q = new EventQueue();
    expect(trash(s, 0, 1, q)).toBe(0);
    expect(s.kukishi).toBe(trashRefund(0, 4));
    expect(trash(s, 0, 0, q)).toBe(DENY.invalid);
  });
});

describe("оснащение, столы, этажи", () => {
  test("оснащение повышает доход этажа", () => {
    const s = withDesks([5], 1e12);
    const before = s.incomePerSec;
    expect(buyEquip(s, 0, new EventQueue())).toBe(0);
    expect(s.incomePerSec).toBeCloseTo(before * (1 + BALANCE.equipStep));
  });

  test("столы докупаются до максимума", () => {
    const s = withDesks([1], 1e30);
    const q = new EventQueue(64);
    while (buyDesk(s, 0, q) === 0);
    expect(s.floors[0]?.deskCount).toBe(BALANCE.desksMax);
  });

  test("этаж открывается по очереди, со стартовым батраканом, и даёт доход", () => {
    const s = withDesks([1], 1e30);
    const q = new EventQueue();
    expect(unlockFloor(s, q)).toBe(0);
    expect(s.floorsUnlocked).toBe(2);
    expect(s.floors[1]?.desks[0]).toBe(1);
    expect(s.floorIncome[1]).toBeGreaterThan(s.floorIncome[0] ?? 0);
  });
});

describe("реорганизация и перки", () => {
  test("без заработка реорганизация недоступна", () => {
    expect(reorganize(createState(), new EventQueue())).toBe(DENY.noMoney);
  });

  test("сбрасывает забег, но сохраняет этажи, выслугу, печати и картотеку", () => {
    const s = withDesks([7, 7, 3], 5e9);
    s.floorsUnlocked = 2;
    s.earnedThisRun = earnedForGain(3);
    s.cards[0] = 0b1111111;
    const f = s.floors[0];
    if (!f) return;
    f.qual = 4;
    f.equip = 3;
    const q = new EventQueue();
    expect(reorgGain(s)).toBe(3);
    expect(reorganize(s, q)).toBe(0);
    expect([s.seniority, s.stamps, s.kukishi, s.earnedThisRun]).toEqual([
      3,
      3,
      BALANCE.startKukishi,
      0,
    ]);
    expect(s.floorsUnlocked).toBe(2);
    expect(f.qual).toBe(1);
    expect(f.equip).toBe(0);
    expect(Array.from(f.desks.subarray(0, 3))).toEqual([1, 0, 0]);
    expect(s.cards[0]).toBe(0b1111111);
  });

  test("выслуга увеличивает доход навсегда", () => {
    const s = withDesks([5]);
    const base = s.incomePerSec;
    s.seniority = 5;
    recomputeIncome(s);
    expect(s.incomePerSec).toBeCloseTo(base * (1 + 5 * BALANCE.seniorityBonus));
  });

  test("перки покупаются за печати, перк столов действует сразу и после реорганизации", () => {
    const s = withDesks([1]);
    s.stamps = 100;
    const q = new EventQueue(64);
    const desk = perkIndex("extraDesk");
    expect(buyPerk(s, desk, q)).toBe(0);
    expect(s.floors[0]?.deskCount).toBe(BALANCE.desksStart + 1);
    s.earnedThisRun = BALANCE.reorgBase;
    reorganize(s, q);
    expect(s.floors[0]?.deskCount).toBe(BALANCE.desksStart + 1);
    const qual = perkIndex("startQual");
    buyPerk(s, qual, q);
    s.earnedThisRun = BALANCE.reorgBase;
    reorganize(s, q);
    expect(s.floors[0]?.qual).toBe(2);
    expect(s.floors[0]?.desks[0]).toBe(2);
  });

  test("перк нельзя купить выше максимума или без печатей", () => {
    const s = createState();
    const q = new EventQueue(64);
    expect(buyPerk(s, 0, q)).toBe(DENY.noMoney);
    s.stamps = 1000;
    const auto = perkIndex("autoMerge");
    expect(buyPerk(s, auto, q)).toBe(0);
    expect(buyPerk(s, auto, q)).toBe(DENY.maxed);
    expect(PERKS.length).toBeGreaterThanOrEqual(7);
  });

  test("автослияние сливает младшую пару", () => {
    const s = withDesks([3, 1, 3, 1]);
    autoMergeOnce(s, new EventQueue());
    expect(Array.from(s.floors[0]?.desks.subarray(0, 4) ?? [])).toEqual([3, 2, 3, 0]);
  });
});

describe("sim", () => {
  test("за минуту этаж выплачивает свой доход", () => {
    const s = withDesks([1, 3, 5]);
    const q = new EventQueue(4096);
    const income = s.incomePerSec;
    for (let i = 0; i < 60 * 20; i++) step(s, 0.05, q);
    expect(Math.abs(s.kukishi - 60 * income)).toBeLessThanOrEqual(income);
  });

  test("после зависания кадра выплаты не теряются и идут одним событием", () => {
    const s = withDesks([2]);
    const q = new EventQueue();
    step(s, 10, q);
    expect(q.length).toBe(1);
    expect(q.value[0]).toBeGreaterThanOrEqual(9 * rankIncome(0, 2));
  });
});

describe("events", () => {
  test("переполнение не падает и считается", () => {
    const q = new EventQueue(2);
    q.push(EV.tap);
    q.push(EV.tap);
    q.push(EV.tap);
    expect([q.length, q.dropped]).toEqual([2, 1]);
  });
});

describe("save", () => {
  test("v2: сохранение → загрузка даёт то же состояние", () => {
    const s = withDesks([1, 2, 7, 0, 3], 12345.5);
    s.floorsUnlocked = 2;
    s.seniority = 4;
    s.stamps = 2;
    s.perks[1] = 1;
    const f = s.floors[0];
    if (f) {
      f.qual = 3;
      f.rare[2] = 1;
    }
    recomputeIncome(s);
    const back = fromSave(JSON.parse(JSON.stringify(toSave(s, 1))) as unknown);
    expect(back).not.toBeNull();
    if (!back) return;
    expect(Array.from(back.floors[0]?.desks ?? [])).toEqual(Array.from(f?.desks ?? []));
    expect(back.floors[0]?.rare[2]).toBe(1);
    expect([back.floorsUnlocked, back.seniority, back.stamps, back.perks[1]]).toEqual([2, 4, 2, 1]);
    expect(back.incomePerSec).toBeCloseTo(s.incomePerSec);
  });

  test("v1 из среза мигрирует: батраканы, кукиши и картотека на первом этаже", () => {
    const v1 = {
      v: 1,
      desks: [3, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      deskCount: 8,
      kukishi: 500,
      hires: [0, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      maxRank: 3,
      earnedThisRun: 900,
      totalEarned: 900,
      collection: 0b111,
      savedAt: 0,
    };
    const s = fromSave(v1);
    expect(s).not.toBeNull();
    expect(Array.from(s?.floors[0]?.desks.subarray(0, 2) ?? [])).toEqual([3, 2]);
    expect(s?.kukishi).toBe(500);
    expect(s?.cards[0]).toBe(0b111);
    expect(s?.floors[0]?.hires).toBe(5);
  });

  test("битые сохранения отбрасываются", () => {
    const good = toSave(createState(), 0);
    const cases: unknown[] = [
      null,
      "мусор",
      [],
      { ...good, v: 3 },
      { ...good, floorsUnlocked: 0 },
      { ...good, kukishi: -5 },
      { ...good, kukishi: Number.NaN },
      { ...good, perks: good.perks.map(() => 99) },
      { ...good, floors: good.floors.slice(0, 1) },
      { ...good, floors: good.floors.map((f) => ({ ...f, desks: f.desks.map(() => 99) })) },
      {
        ...good,
        floors: good.floors.map((f) => ({
          ...f,
          desks: f.desks.map((_, i) => (i === 11 ? 1 : 0)),
        })),
      },
    ];
    for (const c of cases) expect(fromSave(c)).toBeNull();
  });
});

describe("картотека", () => {
  test("достигнутый ранг открывает и все младшие карточки", () => {
    const s = withDesks([4, 4]);
    s.cards[0] = 1;
    move(s, 0, 0, 1, new EventQueue());
    expect(s.cards[0]).toBe(0b11111);
  });

  test("этаж, открытый с высокой стартовой квалификацией, сразу знает младшие ранги", () => {
    const s = createState();
    s.stamps = 100;
    const q = new EventQueue(64);
    buyPerk(s, perkIndex("startQual"), q);
    buyPerk(s, perkIndex("startQual"), q);
    s.kukishi = 1e30;
    unlockFloor(s, q);
    expect(s.cards[1]).toBe(0b111);
  });
});
