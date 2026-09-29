/**
 * Ранги батраканов отдела «Бухгалтерия» (MVP). Ранг в игре — число 1..MAX_RANK,
 * индекс в массиве — ранг минус один. Названия — в словарях i18n по id.
 */
export const RANK_IDS = [
  "intern",
  "workroach",
  "senior",
  "lead",
  "chief",
  "deputy",
  "head",
  "vp",
  "director",
  "closeToBoss",
] as const;

export type RankId = (typeof RANK_IDS)[number];

export const MAX_RANK = RANK_IDS.length;

export function rankId(rank: number): RankId {
  const id = RANK_IDS[rank - 1];
  if (id === undefined) throw new RangeError(`Нет ранга ${rank}`);
  return id;
}
