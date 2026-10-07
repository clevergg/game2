/**
 * Этажи Конторки снизу вверх. Каждый этаж — отдел со своей линейкой из 10 рангов.
 * К релизу — 3 этажа; новые добавляются сюда, в словари и в генератор ассетов.
 */
export const FLOOR_IDS = ["accounting", "warehouse", "design"] as const;

export type FloorId = (typeof FLOOR_IDS)[number];

export const FLOOR_COUNT = FLOOR_IDS.length;

export function floorId(f: number): FloorId {
  const id = FLOOR_IDS[f];
  if (id === undefined) throw new RangeError(`Нет этажа ${f}`);
  return id;
}
