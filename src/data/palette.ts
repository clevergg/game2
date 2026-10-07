/**
 * Палитра игры. Каждый материал — рампа из 4 оттенков: от освещённого (0) к теневому (3).
 * Генератор ассетов рисует каждый пиксель строго оттенком рампы своего материала,
 * поэтому картинка остаётся «чистой» и читаемой на маленьком экране.
 *
 * Индексы в PNG-атласе: 0 — прозрачный, 1 — обводка, дальше рампы подряд по 4 цвета.
 */
export const OUTLINE = "#1c1620";

export const RAMPS = {
  // Окружение
  paper: ["#fffaf0", "#efe6cf", "#d6c9a6", "#a99a74"],
  wall: ["#e6d9b0", "#cdbd8e", "#a8976a", "#7a6c4a"],
  carpet: ["#8fa08a", "#70826e", "#536453", "#38463a"],
  wood: ["#d19a5b", "#a9733d", "#7e5229", "#56361a"],
  cardboard: ["#e0b981", "#bf9055", "#936a3a", "#634524"],
  plastic: ["#ece6d3", "#c9c1a8", "#9c947c", "#6b6553"],
  crt: ["#b8ffb0", "#5fe07a", "#2f9c52", "#185a31"],
  steel: ["#b9c0c8", "#8c95a0", "#626b77", "#3e4550"],
  glass: ["#e4f6ff", "#b3dcef", "#7fb2cc", "#4f7f99"],
  // Батраканы
  chitin: ["#c98a5e", "#a0623d", "#734127", "#4a2716"],
  shirt: ["#f7f9fb", "#d6e0ea", "#a3b3c6", "#6e7f96"],
  fabric: ["#5b5d6b", "#414350", "#2c2d38", "#1b1c24"],
  slate: ["#b3b6bd", "#8f929a", "#6b6e76", "#4a4c53"],
  blue: ["#7fb0ff", "#4f82d9", "#3159a3", "#1f3a6b"],
  teal: ["#7fd8c9", "#3fae9e", "#2a7c71", "#1b4f48"],
  olive: ["#c4c27a", "#9c9a52", "#737236", "#4c4b22"],
  navy: ["#6d7fb8", "#4a5a8f", "#334066", "#222a43"],
  red: ["#ff8a73", "#e2503a", "#a8321f", "#6b1d12"],
  green: ["#9fe39a", "#56b85a", "#357d3c", "#1f4d25"],
  burgundy: ["#d2748a", "#a6465f", "#74293f", "#461627"],
  gold: ["#fff0a0", "#ffd048", "#d19a1e", "#8a5e0e"],
  lime: ["#d6ff7a", "#9ed838", "#5e9a1e", "#37600f"],
  // Фаза 6: Склад и Конторка дизайнеров. Новые рампы — только в конец, чтобы не сдвигать индексы атласа
  orange: ["#ffb36b", "#f07f2a", "#b5561a", "#6e3210"],
  hazard: ["#fff27a", "#f2d22e", "#b89a14", "#6e5c0a"],
  concrete: ["#cfccc3", "#aeaa9f", "#8a867d", "#605d56"],
  denim: ["#8fb3d9", "#5f86b5", "#3f5f88", "#273c59"],
  pink: ["#ffc2d6", "#f58fb3", "#c45d86", "#7d3654"],
  purple: ["#c7a3ff", "#9a6fe0", "#6a46a8", "#3f2868"],
  mint: ["#c8f5e1", "#8fdcbc", "#5aa88a", "#346650"],
  birch: ["#f3dcb2", "#dcbb86", "#b38f5c", "#7a5c36"],
  studio: ["#f8f7f4", "#e3e1db", "#c2bfb6", "#8e8b83"],
} as const satisfies Record<string, readonly [string, string, string, string]>;

export type RampName = keyof typeof RAMPS;

export const RAMP_NAMES = Object.keys(RAMPS) as RampName[];

/** Индекс цвета в палитре атласа. shade: 0 — светлый … 3 — тёмный. */
export function paletteIndex(ramp: RampName, shade: number): number {
  return 2 + RAMP_NAMES.indexOf(ramp) * 4 + shade;
}

export const TRANSPARENT_INDEX = 0;
export const OUTLINE_INDEX = 1;

/** Все цвета палитры в порядке индексов (без прозрачного). */
export function paletteHex(): string[] {
  return [OUTLINE, ...RAMP_NAMES.flatMap((name) => RAMPS[name])];
}
