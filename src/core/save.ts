/**
 * Сохранение: версионированная схема. Загрузка строго проверяет данные:
 * битое или чужое сохранение не роняет игру, а отбрасывается (вернётся null).
 */
import { BALANCE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";
import { createState, type OfficeState, recomputeIncome } from "./state";

export const SAVE_VERSION = 1;

export interface SaveV1 {
  readonly v: 1;
  readonly desks: number[];
  readonly deskCount: number;
  readonly kukishi: number;
  readonly hires: number[];
  readonly maxRank: number;
  readonly earnedThisRun: number;
  readonly totalEarned: number;
  readonly collection: number;
  readonly savedAt: number;
}

export function toSave(s: OfficeState, now: number): SaveV1 {
  return {
    v: 1,
    desks: Array.from(s.desks),
    deskCount: s.deskCount,
    kukishi: s.kukishi,
    hires: Array.from(s.hires),
    maxRank: s.maxRank,
    earnedThisRun: s.earnedThisRun,
    totalEarned: s.totalEarned,
    collection: s.collection,
    savedAt: now,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;
const int = (x: unknown, lo: number, hi: number): x is number =>
  Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;

function intArray(x: unknown, len: number, lo: number, hi: number): x is number[] {
  return Array.isArray(x) && x.length === len && x.every((v) => int(v, lo, hi));
}

/** Возвращает состояние или null, если данные невалидны. */
export function fromSave(data: unknown): OfficeState | null {
  if (!isObj(data) || data["v"] !== SAVE_VERSION) return null;
  const d = data;
  if (!intArray(d["desks"], BALANCE.desksMax, 0, MAX_RANK)) return null;
  if (!int(d["deskCount"], BALANCE.desksStart, BALANCE.desksMax)) return null;
  if (!intArray(d["hires"], MAX_RANK + 1, 0, 65535)) return null;
  if (!int(d["maxRank"], 1, MAX_RANK)) return null;
  if (!int(d["collection"], 1, (1 << MAX_RANK) - 1)) return null;
  if (!num(d["kukishi"]) || !num(d["earnedThisRun"]) || !num(d["totalEarned"])) return null;

  const desks = d["desks"];
  const deskCount = d["deskCount"];
  // За закрытыми столами никого быть не может
  for (let i = deskCount; i < desks.length; i++) if (desks[i] !== 0) return null;

  const s = createState();
  s.desks.set(desks);
  s.deskCount = deskCount;
  s.hires.set(d["hires"]);
  s.maxRank = d["maxRank"];
  s.collection = d["collection"];
  s.kukishi = d["kukishi"];
  s.earnedThisRun = d["earnedThisRun"];
  s.totalEarned = d["totalEarned"];
  recomputeIncome(s);
  return s;
}
