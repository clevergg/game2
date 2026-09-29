import type { RankId } from "../data/ranks";
import type { ru } from "./ru";

export type UiKey = keyof typeof ru.ui;

/** Форма словаря: забытый ключ в любом языке — ошибка компиляции. */
export interface Dict {
  readonly ui: { readonly [K in UiKey]: string };
  readonly ranks: { readonly [K in RankId]: string };
  readonly number: {
    readonly decimal: string;
    /** Суффиксы для 10^0, 10^3, 10^6, 10^9, 10^12. */
    readonly suffixes: readonly [string, string, string, string, string];
  };
}
