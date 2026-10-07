/**
 * Персонажи-NPC для модалок и панелей: портреты по пояс. Внешность — наш собственный дизайн
 * в стиле батраканов (безликая хитиновая голова с усиками), а не копия персонажей оригинала.
 *  - Тося Бося, секретарша: начёс-«бабетта», очки-бабочки на цепочке, жемчуг, розовый кардиган,
 *    в руке трубка дискового телефона — она раздаёт поручения.
 *  - Кудесница Алеся из отдела квадров: длинные тёмные волосы, фиолетовая шаль со звёздами,
 *    золотые серьги-звёзды и большая печать отдела квадров — за печати она выдаёт перки.
 */
import type * as THREE from "three";
import { at, ball, box, cyl, group, type MatSpec, ring, scaled } from "../kit";
import { addHeadShape, relaxAntennae } from "./batrakan";

const CHITIN: MatSpec = { ramp: "chitin" };
const HEAD_SCALE = 1.32;

interface Bust {
  readonly root: THREE.Group;
  readonly torso: THREE.Group;
  readonly head: THREE.Group;
}

/** Торс по пояс: tops — материал одежды, рукава задаются отдельно (руки у персонажей разные). */
function bust(top: MatSpec): Bust {
  const root = group();
  const torso = group();
  root.add(torso);
  const torsoMesh = cyl(0.2, 0.15, 0.46, 8, top);
  torso.add(scaled(at(torsoMesh, 0, 0.23, 0), 1, 1, 0.74));
  torso.add(at(cyl(0.06, 0.07, 0.08, 5, CHITIN), 0, 0.49, 0));
  const head = group();
  head.position.set(0, 0.52, 0);
  head.scale.setScalar(HEAD_SCALE);
  torso.add(head);
  const { antL, antR } = addHeadShape(head, 1.1);
  relaxAntennae([antL.joints, antR.joints], -0.3, -0.25);
  return { root, torso, head };
}

function armDown(side: 1 | -1, sleeve: MatSpec): THREE.Group {
  return group(
    at(cyl(0.055, 0.05, 0.3, 6, sleeve), 0.22 * side, 0.27, 0, 0, 0, 0.12 * side),
    at(cyl(0.05, 0.045, 0.2, 6, sleeve), 0.25 * side, 0.08, 0.05, -0.5, 0, 0),
  );
}

export function buildTosya(): THREE.Group {
  const cardigan: MatSpec = { ramp: "pink" };
  const b = bust({ ramp: "shirt" });
  // Кардиган поверх блузки: две полы и воротник блузки
  for (const s of [-1, 1]) {
    b.torso.add(scaled(at(box(0.15, 0.44, 0.06, cardigan), 0.11 * s, 0.23, 0.11, 0, -0.25 * s, 0), 1, 1, 1));
    b.torso.add(at(box(0.08, 0.05, 0.03, { ramp: "shirt", bias: -0.5 }), 0.05 * s, 0.44, 0.13, 0, 0, 0.5 * s));
  }
  b.torso.add(scaled(at(cyl(0.21, 0.16, 0.44, 8, cardigan), 0, 0.22, -0.03), 1, 1, 0.7));
  // Жемчужное ожерелье
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (0.7 * i) / 8);
    b.torso.add(at(ball(0.018, 0, { ramp: "studio", bias: -0.6 }), Math.cos(a) * 0.085, 0.43 - Math.sin(a) * 0.05, 0.11 + Math.sin(a) * 0.02));
  }
  // Начёс-«бабетта»: высокий объём на затылке, пучок и бант
  const hair: MatSpec = { ramp: "orange", bias: 0.7 };
  b.head.add(scaled(at(ball(0.18, 1, hair), 0, 0.27, -0.04), 1.02, 0.9, 1));
  b.head.add(scaled(at(ball(0.15, 1, hair), 0, 0.42, -0.06), 1, 0.9, 0.95));
  b.head.add(at(ball(0.07, 1, { ramp: "orange", bias: 1 }), 0, 0.42, -0.2));
  b.head.add(at(box(0.16, 0.05, 0.04, { ramp: "red" }), 0, 0.33, -0.17, -0.3));
  for (const s of [-1, 1]) b.head.add(scaled(at(ball(0.06, 0, hair), 0.15 * s, 0.1, -0.02), 0.6, 1.4, 0.8));
  // Очки-бабочки на цепочке
  const frame: MatSpec = { ramp: "purple", bias: -0.3 };
  for (const s of [-1, 1]) {
    b.head.add(scaled(at(ring(0.05, 0.014, 8, frame), 0.06 * s, 0.17, 0.15), 1.15, 0.9, 1));
    b.head.add(at(box(0.04, 0.02, 0.012, frame), 0.11 * s, 0.205, 0.15, 0, 0, 0.5 * s));
    b.head.add(at(cyl(0.004, 0.004, 0.16, 3, { ramp: "gold" }), 0.12 * s, 0.09, 0.12, 0.2, 0, -0.1 * s));
  }
  // Левая рука опущена, правая держит у «уха» трубку телефона с витым проводом
  b.torso.add(armDown(-1, cardigan));
  const phone: MatSpec = { ramp: "red" };
  const armR = group(
    at(cyl(0.055, 0.05, 0.28, 6, cardigan), 0, -0.14, 0),
    at(group(at(cyl(0.05, 0.045, 0.22, 6, cardigan), 0, -0.11, 0), at(ball(0.055, 0, CHITIN), 0, -0.24, 0)), 0, -0.28, 0, -2.2, 0, 0),
  );
  armR.position.set(0.22, 0.42, 0);
  armR.rotation.set(0.2, 0, 0.55);
  b.torso.add(armR);
  const receiver = group(
    at(box(0.06, 0.26, 0.05, phone), 0, 0, 0),
    at(box(0.09, 0.07, 0.07, phone), 0, 0.13, 0.02),
    at(box(0.09, 0.07, 0.07, phone), 0, -0.13, 0.02),
  );
  receiver.scale.setScalar(0.7);
  b.torso.add(at(receiver, 0.25, 0.68, 0.08, 0.2, 0, -0.45));
  for (let i = 0; i < 6; i++) {
    b.torso.add(at(ring(0.02, 0.006, 6, { ramp: "red", bias: 0.6 }), 0.3 + i * 0.012, 0.52 - i * 0.05, 0.08, 0, Math.PI / 2, 0));
  }
  return b.root;
}

export function buildAlesya(): THREE.Group {
  const blouse: MatSpec = { ramp: "purple", bias: 0.5 };
  const shawl: MatSpec = { ramp: "purple" };
  const gold: MatSpec = { ramp: "gold" };
  const b = bust(blouse);
  // Длинные прямые тёмные волосы с чёлкой
  const hair: MatSpec = { ramp: "fabric", bias: 0.2 };
  b.head.add(scaled(at(ball(0.175, 1, hair), 0, 0.24, -0.03), 1.02, 0.85, 1));
  // Чёлка набок и пряди до плеч
  b.head.add(scaled(at(ball(0.09, 1, { ramp: "fabric", bias: -0.2 }), -0.05, 0.3, 0.11), 1.4, 0.5, 0.6));
  for (const s of [-1, 1]) b.head.add(scaled(at(ball(0.07, 1, hair), 0.15 * s, 0.04, -0.01), 0.75, 2.4, 1.1));
  b.head.add(scaled(at(ball(0.12, 1, hair), 0, 0.04, -0.1), 1.3, 1.9, 0.6));
  // Серьги-звёзды
  for (const s of [-1, 1]) b.head.add(at(ball(0.025, 0, gold), 0.17 * s, 0.03, 0.04));
  // Шаль на плечах со звёздочками
  b.torso.add(scaled(at(ring(0.17, 0.07, 12, shawl), 0, 0.42, 0, Math.PI / 2 - 0.15), 1.1, 1, 0.8));
  b.torso.add(at(box(0.12, 0.24, 0.04, shawl), -0.06, 0.28, 0.13, 0.1, 0, 0.3));
  b.torso.add(at(box(0.12, 0.2, 0.04, { ramp: "purple", bias: 0.4 }), 0.07, 0.3, 0.14, 0.1, 0, -0.3));
  for (const [x, y] of [
    [-0.16, 0.42],
    [0.08, 0.46],
    [0.18, 0.4],
    [-0.04, 0.24],
  ] as const) {
    b.torso.add(at(ball(0.016, 0, { ramp: "gold", fixedShade: 0 }), x, y, 0.15));
  }
  // Руки: левая опущена, правая держит перед собой большую печать отдела квадров
  b.torso.add(armDown(-1, blouse));
  b.torso.add(at(cyl(0.055, 0.05, 0.28, 6, blouse), 0.2, 0.28, 0.06, -0.6, 0, 0.15));
  b.torso.add(at(cyl(0.05, 0.045, 0.2, 6, blouse), 0.14, 0.2, 0.2, -1.4, 0, -0.4));
  const stamp = group(
    at(cyl(0.09, 0.09, 0.05, 10, { ramp: "red" }), 0, 0, 0),
    at(cyl(0.035, 0.05, 0.1, 8, gold), 0, 0.075, 0),
    at(ball(0.055, 1, gold), 0, 0.16, 0),
    at(ball(0.05, 0, CHITIN), 0.05, 0.12, 0.03),
  );
  b.torso.add(at(stamp, 0.05, 0.18, 0.28, 0.35, 0, -0.1));
  // Волшебные искры вокруг печати
  for (const [x, y, z] of [
    [-0.08, 0.34, 0.32],
    [0.18, 0.3, 0.3],
    [0.1, 0.42, 0.26],
  ] as const) {
    b.torso.add(at(ball(0.018, 0, { ramp: "hazard", fixedShade: 0 }), x, y, z));
  }
  return b.root;
}
