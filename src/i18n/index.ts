/** Текущий язык и доступ к строкам. UI берёт текст только отсюда. */
import { floorId } from "../data/floors";
import { PERKS } from "../data/perks";
import { rankId } from "../data/ranks";
import type { Dict, PlanKey, UiKey } from "./dict";
import { en } from "./en";
import { formatCompact } from "./format";
import { ru } from "./ru";

export type Lang = "ru" | "en";

const DICTS: Record<Lang, Dict> = { ru, en };

/** Языки, для которых показываем русский: пользователи Яндекса из СНГ чаще читают по-русски. */
const RU_FAMILY = new Set(["ru", "be", "kk", "uk", "uz"]);

export function detectLang(code: string | undefined): Lang {
  const base = (code ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
  return RU_FAMILY.has(base) ? "ru" : "en";
}

let lang: Lang = "ru";
let dict: Dict = ru;

export function setLang(l: Lang): void {
  lang = l;
  dict = DICTS[l];
}

export function getLang(): Lang {
  return lang;
}

export function t(key: UiKey): string {
  return dict.ui[key];
}

/** Строка с подстановкой: «Этаж {n}» + { n: 2 } → «Этаж 2». */
export function tf(key: UiKey, vars: Readonly<Record<string, string | number>>): string {
  return dict.ui[key].replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = vars[name];
    return v === undefined ? m : String(v);
  });
}

export function rankName(rank: number, floor = 0): string {
  return dict.ranks[floorId(floor)][rankId(rank)];
}

export function floorName(floor: number): string {
  return dict.floors[floorId(floor)];
}

export function perkText(i: number): { readonly name: string; readonly desc: string } {
  const id = PERKS[i]?.id;
  return id === undefined ? { name: "", desc: "" } : dict.perks[id];
}

const PLAN_KEYS: readonly PlanKey[] = ["earn", "merges", "hires", "taps", "debiks", "shifts"];

/** Текст плана смены или поручения (тип — индекс PLAN из core/live). */
export function planText(type: number, target: string): string {
  const key = PLAN_KEYS[type];
  return key === undefined ? "" : dict.plans[key].replace("{n}", target);
}

export function fmt(value: number): string {
  return formatCompact(value, dict.number);
}

export function numberLocale(): Dict["number"] {
  return dict.number;
}
