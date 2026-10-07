/**
 * Перки Кудесницы Алеси из отдела квадров. Покупаются за печати, переживают реорганизацию.
 * cost[i] — цена перехода на уровень i+1.
 */
export const PERKS = [
  /** Квалификация найма на всех этажах начинается выше. */
  { id: "startQual", cost: [2, 5, 12] },
  /** +1 стол на всех этажах. */
  { id: "extraDesk", cost: [3, 8] },
  /** Отгул (оффлайн-доход) копится дольше: +2 часа за уровень. */
  { id: "longOtgul", cost: [1, 3, 6] },
  /** Дебики прибегают чаще: −20% к интервалу за уровень. */
  { id: "debikFreq", cost: [1, 2, 4] },
  /** Премия жирнее: +1 к множителю премии за уровень. */
  { id: "fatPremia", cost: [2, 6] },
  /** Автослияние: одинаковые батраканы сами сливаются раз в несколько секунд. */
  { id: "autoMerge", cost: [6] },
  /** Бережливость: −6% к цене найма за уровень. */
  { id: "thrift", cost: [1, 2, 3, 5, 8] },
] as const;

export type PerkId = (typeof PERKS)[number]["id"];

export const PERK_COUNT = PERKS.length;

export function perkIndex(id: PerkId): number {
  return PERKS.findIndex((p) => p.id === id);
}

export function perkMax(i: number): number {
  return PERKS[i]?.cost.length ?? 0;
}
