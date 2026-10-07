import type { FloorId } from "../data/floors";
import type { PerkId } from "../data/perks";
import type { RankId } from "../data/ranks";
import type { ru } from "./ru";

export type UiKey = keyof typeof ru.ui;
export type PlanKey = keyof typeof ru.plans;

/** Форма словаря: забытый ключ в любом языке — ошибка компиляции. */
export interface Dict {
  readonly ui: { readonly [K in UiKey]: string };
  readonly floors: { readonly [K in FloorId]: string };
  readonly ranks: { readonly [F in FloorId]: { readonly [K in RankId]: string } };
  readonly perks: { readonly [K in PerkId]: { readonly name: string; readonly desc: string } };
  readonly plans: { readonly [K in PlanKey]: string };
  readonly number: {
    readonly decimal: string;
    /** Суффиксы для 10^0, 10^3, … 10^21. */
    readonly suffixes: readonly [string, string, string, string, string, string, string, string];
  };
}
