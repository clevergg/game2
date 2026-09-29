import type { RampName } from "../../../src/data/palette";
import { MAX_RANK } from "../../../src/data/ranks";

/**
 * Внешний вид каждого ранга. Правило читаемости: соседние ранги отличаются
 * не только цветом, но и силуэтом (галстук, очки, жилет, пиджак, гарнитура,
 * козырёк бухгалтера, нимб, размер кресла), а сам батракан немного растёт с рангом.
 */
export interface RankLook {
  readonly scale: number;
  readonly top: "shirt" | "vest" | "jacket";
  readonly topRamp: RampName;
  readonly tie: RampName | null;
  readonly glasses: "none" | "black" | "gold";
  readonly badge: boolean;
  /** Кепка задом наперёд — силуэт стажёра. */
  readonly cap: boolean;
  readonly headset: boolean;
  readonly visor: boolean;
  readonly pen: boolean;
  readonly halo: boolean;
  readonly chair: "basic" | "manager" | "throne";
  readonly antenna: number;
}

const base: RankLook = {
  scale: 1,
  top: "shirt",
  topRamp: "shirt",
  tie: null,
  glasses: "none",
  badge: false,
  cap: false,
  headset: false,
  visor: false,
  pen: false,
  halo: false,
  chair: "basic",
  antenna: 1,
};

export const RANK_LOOKS: readonly RankLook[] = [
  { ...base, scale: 0.9, badge: true, cap: true, antenna: 0.8 }, // 1 стажёр: кепка задом наперёд и бейджик
  { ...base, scale: 0.92, tie: "slate" }, // 2 батракан: серый галстук
  { ...base, scale: 0.94, tie: "blue", glasses: "black" }, // 3 старший: синий галстук, очки
  { ...base, scale: 0.96, top: "vest", topRamp: "olive", tie: "blue", glasses: "black" }, // 4 ведущий: жилет
  { ...base, scale: 0.98, top: "jacket", topRamp: "slate", tie: "red", glasses: "black" }, // 5 главный: пиджак
  { ...base, scale: 1.0, top: "jacket", topRamp: "navy", tie: "red", headset: true }, // 6 зам: гарнитура
  {
    ...base,
    scale: 1.02,
    top: "jacket",
    topRamp: "fabric",
    tie: "gold",
    glasses: "gold",
    chair: "manager",
  }, // 7 начальник: чёрный пиджак, кресло с высокой спинкой
  {
    ...base,
    scale: 1.04,
    top: "jacket",
    topRamp: "teal",
    tie: "gold",
    visor: true,
    chair: "manager",
    antenna: 1.1,
  }, // 8 зам по циферкам: зелёный козырёк бухгалтера
  {
    ...base,
    scale: 1.06,
    top: "jacket",
    topRamp: "burgundy",
    tie: "gold",
    glasses: "gold",
    pen: true,
    chair: "throne",
    antenna: 1.2,
  }, // 9 директор: бордовый пиджак, золотое перо, кресло-трон
  {
    ...base,
    scale: 1.08,
    top: "jacket",
    topRamp: "gold",
    tie: "red",
    glasses: "gold",
    pen: true,
    halo: true,
    chair: "throne",
    antenna: 1.3,
  }, // 10 приближённый к Хозяину: золотой костюм и нимб
];

if (RANK_LOOKS.length !== MAX_RANK) throw new Error("RANK_LOOKS не совпадает с числом рангов");
