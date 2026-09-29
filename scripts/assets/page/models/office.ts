/** Офисная мебель: рабочий стол и «закрытый» стол под коробками (ещё не куплен). */
import type * as THREE from "three";
import { at, ball, box, cyl, disc, group, type MatSpec, ring, scaled } from "../kit";

const WOOD: MatSpec = { ramp: "wood" };
const PLASTIC: MatSpec = { ramp: "plastic" };

function deskBody(): THREE.Group {
  const g = group();
  g.add(scaled(at(disc(0.85, 12, { ramp: "carpet", fixedShade: 3 }), 0, 0.002, 0.05), 1, 1, 0.62));
  g.add(at(box(1.3, 0.06, 0.72, WOOD), 0, 0.72, 0));
  g.add(at(box(1.22, 0.5, 0.04, { ramp: "wood", bias: 0.4 }), 0, 0.44, 0.32));
  g.add(at(box(0.05, 0.69, 0.68, { ramp: "wood", bias: 0.2 }), -0.62, 0.345, 0));
  g.add(at(box(0.05, 0.69, 0.68, { ramp: "wood", bias: 0.2 }), 0.62, 0.345, 0));
  // Ящики тумбы справа
  g.add(at(box(0.02, 0.04, 0.2, { ramp: "gold", bias: 0.6 }), 0.648, 0.55, 0.05));
  return g;
}

/** Стол с ЭЛТ-монитором (спиной к камере — классика), клавиатурой, бумагами, калькулятором и кружкой. */
export function buildDesk(): THREE.Group {
  const g = deskBody();
  const monitor = group(
    at(box(0.44, 0.38, 0.36, PLASTIC), 0, 0.2, 0),
    at(box(0.3, 0.27, 0.22, { ramp: "plastic", bias: 0.3 }), 0, 0.19, -0.26),
    at(box(0.36, 0.28, 0.02, { ramp: "crt", fixedShade: 1 }), 0, 0.21, 0.185),
    at(box(0.2, 0.04, 0.2, PLASTIC), 0, 0.0, -0.05),
  );
  monitor.scale.setScalar(0.82);
  g.add(at(monitor, -0.46, 0.77, -0.04, 0, Math.PI + 0.62, 0));
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
  // Кружка
  const mug: MatSpec = { ramp: "red" };
  g.add(at(cyl(0.05, 0.045, 0.11, 7, mug), 0.52, 0.81, -0.2));
  g.add(at(ring(0.03, 0.01, 6, mug), 0.575, 0.81, -0.2, 0, Math.PI / 2, 0));
  return g;
}

/** Стол, который ещё не куплен: заставлен коробками и перемотан скотчем. */
export function buildLockedDesk(): THREE.Group {
  const g = deskBody();
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
