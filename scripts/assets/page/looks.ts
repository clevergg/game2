import type { RampName } from "../../../src/data/palette";
import { FLOOR_COUNT } from "../../../src/data/floors";
import { MAX_RANK } from "../../../src/data/ranks";

/**
 * Внешний вид каждого ранга. Правило читаемости: соседние ранги отличаются
 * не только цветом, но и силуэтом (галстук, очки, жилет, пиджак, гарнитура,
 * головной убор, нимб, размер кресла), а сам батракан немного растёт с рангом.
 * У каждого этажа своя линейка: бухгалтеры в рубашках, складские в касках и
 * светоотражающих жилетах, дизайнеры в худи, шапках и беретах.
 */
export interface RankLook {
  readonly scale: number;
  /** tee — футболка цвета topRamp; hivis — сигнальный жилет поверх футболки; hoodie — худи с капюшоном. */
  readonly top: "shirt" | "tee" | "hivis" | "hoodie" | "vest" | "jacket";
  readonly topRamp: RampName;
  /** Цвет футболки под сигнальным жилетом. */
  readonly underRamp: RampName;
  readonly tie: RampName | null;
  readonly glasses: "none" | "black" | "gold";
  readonly badge: boolean;
  /** Кепка задом наперёд — силуэт стажёра; capRamp — её цвет. */
  readonly cap: boolean;
  readonly capRamp: RampName;
  readonly hat: "none" | "hardhat" | "beanie" | "beret";
  readonly hatRamp: RampName;
  readonly headset: boolean;
  /** Большие накладные наушники дизайнера. */
  readonly phones: boolean;
  readonly visor: boolean;
  readonly pen: boolean;
  readonly halo: boolean;
  readonly gloves: RampName | null;
  readonly scarf: RampName | null;
  readonly chair: "basic" | "manager" | "throne";
  readonly antenna: number;
}

const base: RankLook = {
  scale: 1,
  top: "shirt",
  topRamp: "shirt",
  underRamp: "slate",
  tie: null,
  glasses: "none",
  badge: false,
  cap: false,
  capRamp: "red",
  hat: "none",
  hatRamp: "hazard",
  headset: false,
  phones: false,
  visor: false,
  pen: false,
  halo: false,
  gloves: null,
  scarf: null,
  chair: "basic",
  antenna: 1,
};

/** Бухгалтерия (этаж 1) — линейка среза, не меняется. */
const ACCOUNTING: readonly RankLook[] = [
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

/** Склад (этаж 2): колупают коробки. Растут от футболки к каске и пиджаку завсклада. */
const WAREHOUSE: readonly RankLook[] = [
  { ...base, scale: 0.9, top: "tee", topRamp: "olive", badge: true, cap: true, capRamp: "orange", antenna: 0.8 }, // 1 подсобник
  { ...base, scale: 0.92, top: "hivis", topRamp: "orange", underRamp: "slate", gloves: "hazard" }, // 2 грузчик: сигнальный жилет, перчатки
  {
    ...base,
    scale: 0.94,
    top: "hivis",
    topRamp: "orange",
    underRamp: "denim",
    gloves: "hazard",
    hat: "hardhat",
    hatRamp: "hazard",
  }, // 3 старший грузчик: жёлтая каска
  {
    ...base,
    scale: 0.96,
    top: "hivis",
    topRamp: "hazard",
    underRamp: "navy",
    hat: "hardhat",
    hatRamp: "studio",
    glasses: "black",
    pen: true,
  }, // 4 кладовщик: белая каска, очки, карандаш
  {
    ...base,
    scale: 0.98,
    top: "vest",
    topRamp: "denim",
    hat: "hardhat",
    hatRamp: "orange",
    gloves: "hazard",
    headset: true,
  }, // 5 старший кладовщик: джинсовый комбинезон, рация-гарнитура
  {
    ...base,
    scale: 1.0,
    top: "jacket",
    topRamp: "orange",
    tie: "navy",
    hat: "hardhat",
    hatRamp: "studio",
    headset: true,
  }, // 6 бригадир: оранжевая куртка
  {
    ...base,
    scale: 1.02,
    top: "jacket",
    topRamp: "fabric",
    tie: "orange",
    hat: "hardhat",
    hatRamp: "red",
    glasses: "gold",
    chair: "manager",
  }, // 7 начальник смены: красная каска
  {
    ...base,
    scale: 1.04,
    top: "jacket",
    topRamp: "teal",
    tie: "gold",
    hat: "hardhat",
    hatRamp: "blue",
    glasses: "gold",
    chair: "manager",
    antenna: 1.1,
  }, // 8 завсклад: синяя каска
  {
    ...base,
    scale: 1.06,
    top: "jacket",
    topRamp: "burgundy",
    tie: "gold",
    hat: "hardhat",
    hatRamp: "gold",
    pen: true,
    chair: "throne",
    antenna: 1.2,
  }, // 9 логист-директор: золотая каска
  {
    ...base,
    scale: 1.08,
    top: "jacket",
    topRamp: "gold",
    tie: "orange",
    hat: "hardhat",
    hatRamp: "gold",
    glasses: "gold",
    halo: true,
    chair: "throne",
    antenna: 1.3,
  }, // 10 хранитель всех коробок: золото и нимб
];

/** Конторка дизайнеров (этаж 3): колупают макеты. Худи, шапки, береты и шарфы. */
const DESIGN: readonly RankLook[] = [
  { ...base, scale: 0.9, top: "tee", topRamp: "pink", badge: true, cap: true, capRamp: "mint", antenna: 0.8 }, // 1 джун-стажёр
  { ...base, scale: 0.92, top: "hoodie", topRamp: "mint" }, // 2 джун: мятное худи
  { ...base, scale: 0.94, top: "hoodie", topRamp: "purple", phones: true }, // 3 мидл: наушники
  {
    ...base,
    scale: 0.96,
    top: "hoodie",
    topRamp: "denim",
    hat: "beanie",
    hatRamp: "pink",
    glasses: "black",
  }, // 4 сеньор: розовая шапка-бини
  {
    ...base,
    scale: 0.98,
    top: "tee",
    topRamp: "studio",
    hat: "beret",
    hatRamp: "red",
    scarf: "purple",
    glasses: "black",
  }, // 5 арт-лид: красный берет и шарф
  {
    ...base,
    scale: 1.0,
    top: "jacket",
    topRamp: "fabric",
    hat: "beret",
    hatRamp: "fabric",
    glasses: "gold",
    phones: true,
  }, // 6 арт-директор: всё чёрное
  {
    ...base,
    scale: 1.02,
    top: "jacket",
    topRamp: "purple",
    scarf: "pink",
    phones: true,
    chair: "manager",
  }, // 7 креативный директор: фиолетовый пиджак, розовый шарф
  {
    ...base,
    scale: 1.04,
    top: "jacket",
    topRamp: "pink",
    hat: "beret",
    hatRamp: "purple",
    glasses: "gold",
    chair: "manager",
    antenna: 1.1,
  }, // 8 главный по макетам: розовый пиджак
  {
    ...base,
    scale: 1.06,
    top: "jacket",
    topRamp: "mint",
    scarf: "gold",
    glasses: "gold",
    pen: true,
    chair: "throne",
    antenna: 1.2,
  }, // 9 дизайн-директор: золотой шарф и перо-стилус
  {
    ...base,
    scale: 1.08,
    top: "jacket",
    topRamp: "gold",
    hat: "beret",
    hatRamp: "gold",
    scarf: "pink",
    glasses: "gold",
    halo: true,
    chair: "throne",
    antenna: 1.3,
  }, // 10 гуру макетов: золото, берет и нимб
];

export type DeskKind = "accounting" | "warehouse" | "design";

/** Тема этажа: батраканы, мебель, пол и стена, цвет теней на полу. */
export interface FloorTheme {
  readonly looks: readonly RankLook[];
  readonly desk: DeskKind;
  /** Рампа пола: из неё берётся тень под столом и креслом. */
  readonly floorRamp: RampName;
}

export const FLOOR_THEMES: readonly FloorTheme[] = [
  { looks: ACCOUNTING, desk: "accounting", floorRamp: "carpet" },
  { looks: WAREHOUSE, desk: "warehouse", floorRamp: "concrete" },
  { looks: DESIGN, desk: "design", floorRamp: "birch" },
];

if (FLOOR_THEMES.length !== FLOOR_COUNT) throw new Error("FLOOR_THEMES не совпадает с числом этажей");
for (const t of FLOOR_THEMES) {
  if (t.looks.length !== MAX_RANK) throw new Error(`Линейка ${t.desk} не совпадает с числом рангов`);
}
