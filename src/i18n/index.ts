/** Текущий язык и доступ к строкам. UI берёт текст только отсюда. */
import { rankId } from "../data/ranks";
import type { Dict, UiKey } from "./dict";
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

export function rankName(rank: number): string {
  return dict.ranks[rankId(rank)];
}

export function fmt(value: number): string {
  return formatCompact(value, dict.number);
}

export function numberLocale(): Dict["number"] {
  return dict.number;
}
