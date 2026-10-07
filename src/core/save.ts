/**
 * Сохранение: версионированная схема со строгой проверкой и миграциями.
 * Битое или чужое сохранение не роняет игру, а отбрасывается (вернётся null).
 * v1 — срез (Фаза 5, один этаж); v2 — «Вертикаль» (этажи, выслуга, перки).
 */
import { BALANCE } from "../data/balance";
import { FLOOR_COUNT } from "../data/floors";
import { PERK_COUNT, perkMax } from "../data/perks";
import { MAX_RANK } from "../data/ranks";
import { createState, type OfficeState, recomputeIncome } from "./state";

export const SAVE_VERSION = 2;

export interface FloorSave {
  readonly desks: number[];
  readonly rare: number[];
  readonly deskCount: number;
  readonly hires: number;
  readonly qual: number;
  readonly equip: number;
  readonly desksBought: number;
}

export interface SaveV2 {
  readonly v: 2;
  readonly floors: FloorSave[];
  readonly floorsUnlocked: number;
  readonly kukishi: number;
  readonly earnedThisRun: number;
  readonly totalEarned: number;
  readonly seniority: number;
  readonly stamps: number;
  readonly reorgs: number;
  readonly perks: number[];
  readonly cards: number[];
  readonly rareCards: number[];
  readonly rng: number;
  readonly savedAt: number;
}

export function toSave(s: OfficeState, now: number): SaveV2 {
  return {
    v: 2,
    floors: s.floors.map((f) => ({
      desks: Array.from(f.desks),
      rare: Array.from(f.rare),
      deskCount: f.deskCount,
      hires: f.hires,
      qual: f.qual,
      equip: f.equip,
      desksBought: f.desksBought,
    })),
    floorsUnlocked: s.floorsUnlocked,
    kukishi: s.kukishi,
    earnedThisRun: s.earnedThisRun,
    totalEarned: s.totalEarned,
    seniority: s.seniority,
    stamps: s.stamps,
    reorgs: s.reorgs,
    perks: Array.from(s.perks),
    cards: Array.from(s.cards),
    rareCards: Array.from(s.rareCards),
    rng: s.rng,
    savedAt: now,
  };
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;
const int = (x: unknown, lo: number, hi: number): x is number =>
  Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const intArray = (x: unknown, len: number, lo: number, hi: number): x is number[] =>
  Array.isArray(x) && x.length === len && x.every((v) => int(v, lo, hi));
const CARD_MASK = (1 << MAX_RANK) - 1;

/** Возвращает состояние или null, если данные невалидны. Старые версии мигрируются. */
export function fromSave(data: unknown): OfficeState | null {
  if (!isObj(data)) return null;
  if (data["v"] === 1) return fromV1(data);
  if (data["v"] !== 2) return null;
  const d = data;
  if (!int(d["floorsUnlocked"], 1, FLOOR_COUNT)) return null;
  for (const k of ["kukishi", "earnedThisRun", "totalEarned"]) if (!num(d[k])) return null;
  if (!int(d["seniority"], 0, 1e9) || !int(d["stamps"], 0, 1e9) || !int(d["reorgs"], 0, 1e9))
    return null;
  if (
    !intArray(d["cards"], FLOOR_COUNT, 0, CARD_MASK) ||
    !intArray(d["rareCards"], FLOOR_COUNT, 0, CARD_MASK)
  )
    return null;
  if (!int(d["rng"], 0, 0xffffffff)) return null;
  const perks = d["perks"];
  if (!intArray(perks, PERK_COUNT, 0, 255) || perks.some((lvl, i) => lvl > perkMax(i))) return null;
  const floors = d["floors"];
  if (!Array.isArray(floors) || floors.length !== FLOOR_COUNT) return null;

  const s = createState();
  for (let fi = 0; fi < FLOOR_COUNT; fi++) {
    const fd: unknown = floors[fi];
    if (!isObj(fd)) return null;
    if (!intArray(fd["desks"], BALANCE.desksMax, 0, MAX_RANK)) return null;
    if (!intArray(fd["rare"], BALANCE.desksMax, 0, 1)) return null;
    if (!int(fd["deskCount"], BALANCE.desksStart, BALANCE.desksMax)) return null;
    if (
      !int(fd["hires"], 0, 1e9) ||
      !int(fd["qual"], 1, BALANCE.qualMax) ||
      !int(fd["equip"], 0, 1000)
    )
      return null;
    if (!int(fd["desksBought"], 0, BALANCE.desksMax)) return null;
    const desks = fd["desks"];
    const deskCount = fd["deskCount"];
    for (let i = deskCount; i < desks.length; i++) if (desks[i] !== 0) return null;
    const f = s.floors[fi];
    if (!f) return null;
    f.desks.set(desks);
    f.rare.set(fd["rare"]);
    f.deskCount = deskCount;
    f.hires = fd["hires"];
    f.qual = fd["qual"];
    f.equip = fd["equip"];
    f.desksBought = fd["desksBought"];
  }
  s.floorsUnlocked = d["floorsUnlocked"];
  s.kukishi = d["kukishi"] as number;
  s.earnedThisRun = d["earnedThisRun"] as number;
  s.totalEarned = d["totalEarned"] as number;
  s.seniority = d["seniority"];
  s.stamps = d["stamps"];
  s.reorgs = d["reorgs"];
  s.perks.set(perks);
  s.cards.set(d["cards"]);
  s.rareCards.set(d["rareCards"]);
  s.rng = d["rng"];
  recomputeIncome(s);
  return s;
}

/** v1 (срез): один этаж, уровень найма рос сам. Переносим батраканов, кукиши и картотеку. */
function fromV1(d: Obj): OfficeState | null {
  if (!intArray(d["desks"], BALANCE.desksMax, 0, MAX_RANK)) return null;
  if (!int(d["deskCount"], BALANCE.desksStart, BALANCE.desksMax)) return null;
  if (!intArray(d["hires"], MAX_RANK + 1, 0, 65535)) return null;
  if (!int(d["collection"], 1, CARD_MASK)) return null;
  if (!num(d["kukishi"]) || !num(d["earnedThisRun"]) || !num(d["totalEarned"])) return null;
  const desks = d["desks"];
  const deskCount = d["deskCount"];
  for (let i = deskCount; i < desks.length; i++) if (desks[i] !== 0) return null;
  const s = createState();
  const f = s.floors[0];
  if (!f) return null;
  f.desks.set(desks);
  f.deskCount = deskCount;
  f.hires = d["hires"].reduce((sum, n) => sum + n, 0);
  s.cards[0] = d["collection"];
  s.kukishi = d["kukishi"];
  s.earnedThisRun = d["earnedThisRun"];
  s.totalEarned = d["totalEarned"];
  recomputeIncome(s);
  return s;
}
