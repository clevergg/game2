/**
 * Целевой темп (docs/progression.md §5.2) для бота — внимательного активного игрока.
 * Живой игрок медленнее бота, но получает оффлайн-доход, поэтому календарно выходит близко.
 */
import type { Milestones } from "./bot";

type TimedKey = Exclude<keyof Milestones, "reorgs" | "seniority">;

export const TARGETS: readonly { key: TimedKey; label: string; min: number; max: number }[] = [
  { key: "rank10Floor1", label: "Ранг 10 Бухгалтерии", min: 35 * 60, max: 70 * 60 },
  { key: "firstReorg", label: "Первая реорганизация", min: 75 * 60, max: 180 * 60 },
  { key: "floor2", label: "Открыт Склад", min: 2 * 3600, max: 4 * 3600 },
  { key: "floor3", label: "Открыта Конторка дизайнеров", min: 5 * 3600, max: 10 * 3600 },
  { key: "allCards", label: "Вся картотека (30)", min: 12 * 3600, max: 26 * 3600 },
];
