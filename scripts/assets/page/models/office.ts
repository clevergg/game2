/**
 * Мебель этажей: рабочий стол каждого отдела и «закрытый» стол под коробками (ещё не куплен).
 * Бухгалтерия — деревянный стол с ЭЛТ-монитором; Склад — верстак с коробками и сканером;
 * Конторка дизайнеров — белый стол с большим монитором, графическим планшетом и цветком.
 */
import type * as THREE from "three";
import type { RampName } from "../../../../src/data/palette";
import type { DeskKind } from "../looks";
import { at, ball, box, cyl, disc, group, type MatSpec, ring, scaled } from "../kit";

const WOOD: MatSpec = { ramp: "wood" };
const PLASTIC: MatSpec = { ramp: "plastic" };
const STEEL: MatSpec = { ramp: "steel" };

function shadow(floorRamp: RampName): THREE.Mesh {
  return scaled(at(disc(0.85, 12, { ramp: floorRamp, fixedShade: 3 }), 0, 0.002, 0.05), 1, 1, 0.62);
}

function deskBody(kind: DeskKind, floorRamp: RampName): THREE.Group {
  const g = group(shadow(floorRamp));
  if (kind === "accounting") {
    g.add(at(box(1.3, 0.06, 0.72, WOOD), 0, 0.72, 0));
    g.add(at(box(1.22, 0.5, 0.04, { ramp: "wood", bias: 0.4 }), 0, 0.44, 0.32));
    g.add(at(box(0.05, 0.69, 0.68, { ramp: "wood", bias: 0.2 }), -0.62, 0.345, 0));
    g.add(at(box(0.05, 0.69, 0.68, { ramp: "wood", bias: 0.2 }), 0.62, 0.345, 0));
    // Ящики тумбы справа
    g.add(at(box(0.02, 0.04, 0.2, { ramp: "gold", bias: 0.6 }), 0.648, 0.55, 0.05));
  } else if (kind === "warehouse") {
    // Верстак: фанерная столешница на стальной раме, внизу полка с коробкой
    g.add(at(box(1.3, 0.07, 0.72, { ramp: "birch", bias: 0.6 }), 0, 0.715, 0));
    g.add(at(box(1.3, 0.05, 0.03, { ramp: "orange" }), 0, 0.66, 0.345));
    for (const x of [-0.6, 0.6]) {
      for (const z of [-0.32, 0.32]) g.add(at(box(0.05, 0.68, 0.05, STEEL), x, 0.34, z));
    }
    g.add(at(box(1.2, 0.03, 0.62, { ramp: "steel", bias: 0.4 }), 0, 0.16, 0));
    g.add(at(box(0.42, 0.28, 0.34, { ramp: "cardboard" }), -0.3, 0.315, 0.06, 0, 0.1, 0));
    g.add(at(box(0.43, 0.012, 0.06, { ramp: "paper", bias: 0.6 }), -0.3, 0.46, 0.06, 0, 0.1, 0));
    g.add(at(box(0.3, 0.2, 0.28, { ramp: "cardboard", bias: 0.4 }), 0.3, 0.275, 0.02, 0, -0.2, 0));
  } else {
    // Белый стол на тонких стальных ногах
    g.add(at(box(1.3, 0.05, 0.72, { ramp: "studio" }), 0, 0.72, 0));
    g.add(at(box(1.3, 0.02, 0.02, { ramp: "studio", bias: 0.8 }), 0, 0.7, 0.36));
    for (const x of [-0.58, 0.58]) {
      g.add(at(box(0.04, 0.7, 0.04, STEEL), x, 0.35, 0.3, 0.06));
      g.add(at(box(0.04, 0.7, 0.04, STEEL), x, 0.35, -0.3, -0.06));
    }
    g.add(at(box(0.04, 0.04, 0.5, STEEL), -0.58, 0.12, 0));
    g.add(at(box(0.04, 0.04, 0.5, STEEL), 0.58, 0.12, 0));
  }
  return g;
}

/** ЭЛТ-монитор спиной к камере — классика бухгалтерии. */
function crtMonitor(): THREE.Group {
  const monitor = group(
    at(box(0.44, 0.38, 0.36, PLASTIC), 0, 0.2, 0),
    at(box(0.3, 0.27, 0.22, { ramp: "plastic", bias: 0.3 }), 0, 0.19, -0.26),
    at(box(0.36, 0.28, 0.02, { ramp: "crt", fixedShade: 1 }), 0, 0.21, 0.185),
    at(box(0.2, 0.04, 0.2, PLASTIC), 0, 0.0, -0.05),
  );
  monitor.scale.setScalar(0.82);
  return monitor;
}

function mug(ramp: RampName): THREE.Group {
  const spec: MatSpec = { ramp };
  return group(at(cyl(0.05, 0.045, 0.11, 7, spec), 0, 0, 0), at(ring(0.03, 0.01, 6, spec), 0.055, 0, 0, 0, Math.PI / 2, 0));
}

function accountingTop(g: THREE.Group): void {
  g.add(at(crtMonitor(), -0.46, 0.77, -0.04, 0, Math.PI + 0.62, 0));
  // Клавиатура — под руками батракана
  g.add(at(box(0.44, 0.03, 0.15, PLASTIC), 0, 0.765, -0.1, 0.08));
  g.add(at(box(0.38, 0.012, 0.1, { ramp: "plastic", bias: 1.2 }), 0, 0.785, -0.1, 0.08));
  // Бумаги
  g.add(at(box(0.26, 0.012, 0.32, { ramp: "paper" }), 0.38, 0.757, 0.1, 0, 0.15, 0));
  g.add(at(box(0.26, 0.012, 0.32, { ramp: "paper", bias: 0.3 }), 0.4, 0.77, 0.12, 0, -0.1, 0));
  g.add(at(box(0.26, 0.012, 0.32, { ramp: "paper" }), 0.37, 0.783, 0.1, 0, 0.3, 0));
  // Калькулятор бухгалтера
  g.add(at(box(0.14, 0.03, 0.18, { ramp: "fabric" }), 0.12, 0.765, 0.17, 0, -0.2, 0));
  g.add(at(box(0.1, 0.01, 0.04, { ramp: "crt", fixedShade: 1 }), 0.125, 0.783, 0.12, 0, -0.2, 0));
  g.add(at(mug("red"), 0.52, 0.81, -0.2));
}

function warehouseTop(g: THREE.Group): void {
  const card: MatSpec = { ramp: "cardboard" };
  const tape: MatSpec = { ramp: "hazard", bias: 0.4 };
  // Стопка коробок слева — то, что колупают
  g.add(at(box(0.4, 0.3, 0.36, card), -0.44, 0.9, -0.05, 0, 0.15, 0));
  g.add(at(box(0.41, 0.012, 0.07, tape), -0.44, 1.056, -0.05, 0, 0.15, 0));
  g.add(at(box(0.32, 0.22, 0.3, { ramp: "cardboard", bias: 0.3 }), -0.42, 1.16, -0.06, 0, -0.12, 0));
  g.add(at(box(0.33, 0.012, 0.06, tape), -0.42, 1.276, -0.06, 0, -0.12, 0));
  // Открытая посылка под руками: дно и откинутые клапаны
  g.add(at(box(0.42, 0.08, 0.2, card), 0, 0.79, -0.1));
  g.add(at(box(0.42, 0.012, 0.1, { ramp: "cardboard", bias: -0.4 }), 0, 0.84, 0.03, -0.9));
  g.add(at(box(0.36, 0.01, 0.16, { ramp: "paper", bias: 0.3 }), 0, 0.833, -0.1));
  // Сканер штрихкодов с красным лучом и накладная на планшете
  g.add(at(box(0.08, 0.05, 0.16, { ramp: "fabric" }), 0.3, 0.775, -0.12, 0, -0.4, 0));
  g.add(at(box(0.05, 0.1, 0.05, { ramp: "fabric", bias: 0.6 }), 0.33, 0.73, -0.06, 0.4, -0.4, 0));
  g.add(at(box(0.05, 0.012, 0.02, { ramp: "red", fixedShade: 0 }), 0.27, 0.78, -0.2, 0, -0.4, 0));
  g.add(at(box(0.24, 0.014, 0.32, { ramp: "wood", bias: 0.4 }), 0.4, 0.757, 0.12, 0, 0.2, 0));
  g.add(at(box(0.2, 0.01, 0.26, { ramp: "paper" }), 0.4, 0.768, 0.13, 0, 0.2, 0));
  g.add(at(box(0.08, 0.025, 0.03, STEEL), 0.37, 0.775, 0.0, 0, 0.2, 0));
  // Скотч-пистолет и термос
  g.add(at(cyl(0.06, 0.06, 0.04, 8, tape), 0.15, 0.78, 0.22, 0, 0, Math.PI / 2));
  g.add(at(box(0.06, 0.1, 0.03, { ramp: "red" }), 0.15, 0.76, 0.27));
  g.add(at(cyl(0.045, 0.045, 0.22, 7, { ramp: "teal" }), 0.56, 0.86, -0.2));
  g.add(at(cyl(0.047, 0.047, 0.04, 7, { ramp: "steel", bias: -0.4 }), 0.56, 0.99, -0.2));
}

function designTop(g: THREE.Group): void {
  const white: MatSpec = { ramp: "studio" };
  // Большой плоский монитор спиной к камере, на тонкой ножке, со стикерами
  const monitor = group(
    at(box(0.62, 0.4, 0.04, white), 0, 0.36, 0),
    at(box(0.58, 0.36, 0.02, { ramp: "glass", fixedShade: 1 }), 0, 0.36, 0.022),
    at(box(0.06, 0.2, 0.06, STEEL), 0, 0.1, -0.04, -0.15),
    at(box(0.22, 0.02, 0.16, STEEL), 0, 0.01, -0.02),
    at(box(0.07, 0.07, 0.01, { ramp: "hazard" }), 0.18, 0.47, -0.028, 0, 0, 0.1),
    at(box(0.07, 0.07, 0.01, { ramp: "pink" }), -0.2, 0.3, -0.028, 0, 0, -0.08),
    at(box(0.07, 0.07, 0.01, { ramp: "mint" }), 0.06, 0.24, -0.028, 0, 0, 0.05),
  );
  g.add(at(monitor, -0.32, 0.745, 0.1, 0, Math.PI + 0.3, 0));
  // Графический планшет со стилусом под руками
  g.add(at(box(0.44, 0.02, 0.2, { ramp: "fabric" }), 0, 0.755, -0.1, 0.06));
  g.add(at(box(0.36, 0.008, 0.14, { ramp: "fabric", bias: -0.6 }), 0, 0.768, -0.1, 0.06));
  g.add(at(cyl(0.008, 0.008, 0.16, 4, { ramp: "purple" }), 0.16, 0.775, -0.04, 0, 0.5, Math.PI / 2));
  // Цветок в горшке и кофе навынос
  g.add(at(cyl(0.07, 0.055, 0.12, 7, { ramp: "orange", bias: 0.4 }), 0.52, 0.8, -0.18));
  const leaf: MatSpec = { ramp: "green" };
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(scaled(at(ball(0.06, 0, leaf), 0.52 + Math.cos(a) * 0.05, 0.92 + (i % 2) * 0.05, -0.18 + Math.sin(a) * 0.05), 0.7, 1.5, 0.7));
  }
  g.add(at(cyl(0.045, 0.035, 0.14, 7, white), 0.4, 0.82, 0.18));
  g.add(at(cyl(0.047, 0.042, 0.05, 7, { ramp: "cardboard" }), 0.4, 0.81, 0.18));
  g.add(at(cyl(0.048, 0.048, 0.02, 7, { ramp: "fabric", bias: -0.4 }), 0.4, 0.9, 0.18));
  // Скетчбук
  g.add(at(box(0.22, 0.02, 0.28, { ramp: "purple", bias: 0.4 }), 0.36, 0.755, -0.02, 0, -0.25, 0));
}

export function buildDesk(kind: DeskKind = "accounting", floorRamp: RampName = "carpet"): THREE.Group {
  const g = deskBody(kind, floorRamp);
  if (kind === "accounting") accountingTop(g);
  else if (kind === "warehouse") warehouseTop(g);
  else designTop(g);
  return g;
}

/** Стол, который ещё не куплен: заставлен коробками и перемотан скотчем. */
export function buildLockedDesk(kind: DeskKind = "accounting", floorRamp: RampName = "carpet"): THREE.Group {
  const g = deskBody(kind, floorRamp);
  const card: MatSpec = { ramp: "cardboard" };
  const tape: MatSpec = { ramp: "paper", bias: 0.6 };
  const crate = (w: number, h: number, d: number): THREE.Group =>
    group(at(box(w, h, d, card), 0, h / 2, 0), at(box(w + 0.005, 0.012, 0.06, tape), 0, h + 0.004, 0));
  g.add(at(crate(0.5, 0.34, 0.44), -0.28, 0.75, -0.05, 0, 0.12, 0));
  g.add(at(crate(0.42, 0.3, 0.4), 0.3, 0.75, 0.02, 0, -0.18, 0));
  g.add(at(crate(0.38, 0.26, 0.36), -0.18, 1.09, 0.0, 0, -0.3, 0));
  g.add(at(crate(0.4, 0.3, 0.38), 0.7, 0, 0.45, 0, 0.4, 0));
  g.add(at(ball(0.05, 0, { ramp: "paper" }), 0.1, 0.8, 0.28));
  return g;
}
