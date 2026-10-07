/**
 * Батракан — наш собственный дизайн (не копия моделей ООО «Слоп»):
 * безликая голова с «маской», тараканьи усики, офисная одежда по рангу, кресло на колёсиках.
 * Мир: начало координат — центр стола на полу, камера смотрит с +z, батракан сидит за столом лицом к камере.
 */
import * as THREE from "three";
import type { RampName } from "../../../../src/data/palette";
import type { RankLook } from "../looks";
import { at, ball, box, cyl, cylArc, disc, group, type MatSpec, mesh, ring, scaled } from "../kit";

export const SEAT_Z = -0.6;
/** Общий масштаб батракана относительно мебели: персонаж важнее стола. */
const BODY_SCALE = 1.1;
/** «Чибишная» голова: крупнее — читаемее на маленьком экране и смешнее. */
const HEAD_SCALE = 1.32;

export type Anim = "idle" | "work" | "joy" | "sad";
export const ANIMS: readonly Anim[] = ["idle", "work", "joy", "sad"];
export const ANIM_FRAMES: Record<Anim, number> = { idle: 4, work: 6, joy: 4, sad: 4 };
export const ANIM_FPS: Record<Anim, number> = { idle: 5, work: 12, joy: 8, sad: 5 };

export interface Rig {
  readonly root: THREE.Group;
  readonly body: THREE.Group;
  readonly torso: THREE.Group;
  readonly head: THREE.Group;
  /** [левый, правый] усик, каждый — цепочка шарниров. */
  readonly antennae: readonly [readonly THREE.Group[], readonly THREE.Group[]];
  readonly shoulders: readonly [THREE.Group, THREE.Group];
  readonly elbows: readonly [THREE.Group, THREE.Group];
}

const CHITIN: MatSpec = { ramp: "chitin" };
const TROUSERS: MatSpec = { ramp: "fabric", bias: -0.3 };
const STEEL: MatSpec = { ramp: "steel" };

/** Передняя плоскость торса (шестигранный цилиндр, сплюснутый по z) на высоте y от пояса. */
function chestZ(y: number): number {
  const r = 0.16 + 0.04 * (y / 0.44);
  return r * Math.cos(Math.PI / 6) * 0.72 + 0.012;
}

function chair(kind: RankLook["chair"], floorRamp: RampName): THREE.Group {
  const g = group();
  const seatSpec: MatSpec =
    kind === "throne" ? { ramp: "burgundy" } : kind === "manager" ? { ramp: "fabric", bias: -0.4 } : { ramp: "fabric" };
  g.add(at(box(0.48, 0.08, 0.46, seatSpec), 0, 0.46, 0));
  g.add(at(cyl(0.03, 0.03, 0.36, 5, STEEL), 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = at(box(0.3, 0.03, 0.05, STEEL), Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, 0, -a, 0);
    g.add(spoke);
    g.add(at(ball(0.035, 0, { ramp: "fabric", bias: 1 }), Math.cos(a) * 0.29, 0.035, Math.sin(a) * 0.29));
  }
  if (kind === "basic") {
    g.add(at(box(0.05, 0.3, 0.04, STEEL), 0, 0.62, -0.25));
    g.add(at(box(0.44, 0.42, 0.07, seatSpec), 0, 0.84, -0.27, -0.08));
  } else if (kind === "manager") {
    g.add(at(box(0.52, 0.78, 0.09, seatSpec), 0, 1.0, -0.29, -0.1));
    g.add(at(box(0.36, 0.14, 0.1, seatSpec), 0, 1.44, -0.33, -0.1));
  } else {
    const gold: MatSpec = { ramp: "gold" };
    g.add(at(box(0.6, 0.98, 0.1, seatSpec), 0, 1.1, -0.3, -0.08));
    g.add(at(box(0.66, 0.07, 0.13, gold), 0, 1.6, -0.34, -0.08));
    g.add(at(box(0.07, 1.0, 0.12, gold), -0.31, 1.1, -0.3, -0.08));
    g.add(at(box(0.07, 1.0, 0.12, gold), 0.31, 1.1, -0.3, -0.08));
    g.add(at(ball(0.06, 0, gold), 0, 1.68, -0.35));
    g.add(at(box(0.07, 0.07, 0.42, gold), -0.3, 0.68, -0.04));
    g.add(at(box(0.07, 0.07, 0.42, gold), 0.3, 0.68, -0.04));
  }
  g.add(scaled(at(disc(0.36, 10, { ramp: floorRamp, fixedShade: 3 }), 0, 0.003, 0), 1, 1, 0.75));
  return g;
}

function arm(side: 1 | -1, sleeve: MatSpec, hand: MatSpec): { shoulder: THREE.Group; elbow: THREE.Group } {
  const elbow = group(
    at(cyl(0.045, 0.04, 0.25, 5, sleeve), 0, -0.125, 0),
    at(ball(0.055, 0, hand), 0, -0.27, 0),
  );
  elbow.position.set(0, -0.27, 0);
  const shoulder = group(at(cyl(0.052, 0.047, 0.28, 5, sleeve), 0, -0.135, 0), elbow);
  shoulder.position.set(0.21 * side, 0.4, 0);
  return { shoulder, elbow };
}

function antenna(side: 1 | -1, len: number): { root: THREE.Group; joints: THREE.Group[] } {
  const spec: MatSpec = { ramp: "chitin", bias: 1 };
  const segLen = 0.13 * len;
  const joints: THREE.Group[] = [];
  let parent: THREE.Group | null = null;
  let root: THREE.Group | null = null;
  for (let i = 0; i < 3; i++) {
    const j = group(at(cyl(0.011, 0.014, segLen, 4, spec), 0, segLen / 2, 0));
    if (parent) {
      j.position.set(0, segLen, 0);
      parent.add(j);
    } else {
      j.position.set(0.06 * side, 0.3, 0.05);
      root = j;
    }
    joints.push(j);
    parent = j;
  }
  parent?.add(at(ball(0.022, 0, spec), 0, segLen, 0));
  if (!root) throw new Error("Пустой усик");
  return { root, joints };
}

export function buildBatrakan(look: RankLook, floorRamp: RampName = "carpet"): Rig {
  const root = group(chair(look.chair, floorRamp));
  root.position.set(0, 0, SEAT_Z);
  root.scale.setScalar(look.scale * BODY_SCALE);

  const body = group();
  root.add(body);

  // Ноги (в основном закрыты столом)
  body.add(at(box(0.36, 0.14, 0.34, TROUSERS), 0, 0.56, 0));
  for (const s of [-1, 1] as const) {
    body.add(at(box(0.14, 0.13, 0.38, TROUSERS), 0.09 * s, 0.54, 0.2));
    body.add(at(box(0.12, 0.5, 0.12, TROUSERS), 0.09 * s, 0.28, 0.36));
    body.add(at(box(0.12, 0.07, 0.2, { ramp: "fabric", bias: 1 }), 0.09 * s, 0.04, 0.42));
  }

  // Торс
  const topSpec: MatSpec = { ramp: look.topRamp };
  const shirtSpec: MatSpec = { ramp: "shirt" };
  const underSpec: MatSpec = { ramp: look.underRamp };
  const sleeve =
    look.top === "jacket" || look.top === "tee" || look.top === "hoodie"
      ? topSpec
      : look.top === "hivis"
        ? underSpec
        : shirtSpec;
  const torso = group();
  torso.position.set(0, 0.62, 0);
  body.add(torso);
  const torsoSpec = look.top === "shirt" ? shirtSpec : look.top === "hivis" ? underSpec : topSpec;
  const torsoMesh = cyl(0.2, 0.16, 0.44, 6, torsoSpec);
  torsoMesh.geometry.rotateY(Math.PI / 6);
  torso.add(scaled(at(torsoMesh, 0, 0.22, 0), 1, 1, 0.72));

  if (look.top === "hivis") {
    // Сигнальный жилет: две полы поверх футболки и светоотражающие полосы
    const reflect: MatSpec = { ramp: "steel", bias: -1.2 };
    for (const start of [Math.PI * 0.09, Math.PI]) {
      torso.add(scaled(at(cylArc(0.208, 0.168, 0.4, 5, topSpec, start, Math.PI * 0.91), 0, 0.21, 0), 1, 1, 0.76));
    }
    for (const y of [0.13, 0.27]) {
      for (const s of [-1, 1] as const) {
        torso.add(at(box(0.11, 0.035, 0.012, reflect), 0.1 * s, y, chestZ(y) + 0.01, 0, 0.25 * s, 0));
      }
    }
  }
  if (look.top === "hoodie") {
    const dark: MatSpec = { ramp: look.topRamp, bias: 0.8 };
    // Капюшон лежит на плечах за шеей, карман-кенгуру и шнурки спереди
    torso.add(scaled(at(ring(0.13, 0.055, 10, topSpec, Math.PI), 0, 0.44, -0.02, -Math.PI / 2 + 0.25, 0, Math.PI), 1, 1, 0.9));
    torso.add(at(box(0.2, 0.09, 0.015, dark), 0, 0.09, chestZ(0.09) + 0.006));
    for (const s of [-1, 1]) {
      torso.add(at(cyl(0.008, 0.008, 0.12, 3, { ramp: "studio" }), 0.035 * s, 0.33, chestZ(0.33) + 0.012));
    }
  }
  if (look.scarf) {
    const scarf: MatSpec = { ramp: look.scarf };
    torso.add(scaled(at(ring(0.1, 0.04, 10, scarf), 0, 0.45, 0.01, Math.PI / 2), 1, 1, 0.9));
    torso.add(at(box(0.07, 0.2, 0.03, scarf), 0.06, 0.32, chestZ(0.32) + 0.02, 0, 0, 0.12));
    torso.add(at(box(0.07, 0.025, 0.035, { ramp: look.scarf, bias: 0.8 }), 0.072, 0.23, chestZ(0.23) + 0.022, 0, 0, 0.12));
  }

  if (look.top === "vest" || look.top === "jacket") {
    torso.add(at(box(look.top === "vest" ? 0.1 : 0.13, 0.2, 0.01, shirtSpec), 0, 0.33, chestZ(0.33)));
  }
  if (look.top === "jacket") {
    const lapel: MatSpec = { ramp: look.topRamp, bias: 0.8 };
    torso.add(at(box(0.05, 0.22, 0.02, lapel), -0.065, 0.31, chestZ(0.31) + 0.006, 0, 0, -0.35));
    torso.add(at(box(0.05, 0.22, 0.02, lapel), 0.065, 0.31, chestZ(0.31) + 0.006, 0, 0, 0.35));
  }
  if (look.tie) {
    const tie: MatSpec = { ramp: look.tie };
    torso.add(at(box(0.06, 0.05, 0.03, tie), 0, 0.41, chestZ(0.41) + 0.008));
    torso.add(at(box(0.055, 0.24, 0.015, tie), 0, 0.26, chestZ(0.26) + 0.01));
    torso.add(at(box(0.04, 0.04, 0.015, tie), 0, 0.14, chestZ(0.14) + 0.01, 0, 0, Math.PI / 4));
  }
  if (look.badge) {
    torso.add(at(box(0.075, 0.095, 0.012, { ramp: "paper" }), 0.085, 0.22, chestZ(0.22) + 0.006));
    torso.add(at(box(0.03, 0.02, 0.014, { ramp: "red" }), 0.085, 0.275, chestZ(0.275) + 0.008));
  }
  if (look.pen) {
    torso.add(at(cyl(0.011, 0.011, 0.11, 4, { ramp: "gold" }), -0.1, 0.32, chestZ(0.32) + 0.01, 0, 0, 0.15));
  }

  const hand: MatSpec = look.gloves ? { ramp: look.gloves } : CHITIN;
  const armL = arm(-1, sleeve, hand);
  const armR = arm(1, sleeve, hand);
  torso.add(armL.shoulder, armR.shoulder);

  // Голова
  torso.add(at(cyl(0.06, 0.07, 0.08, 5, CHITIN), 0, 0.47, 0));
  const head = group();
  head.position.set(0, 0.5, 0);
  head.scale.setScalar(HEAD_SCALE);
  torso.add(head);
  const { antL, antR } = addHeadShape(head, look.antenna);

  if (look.glasses !== "none") {
    const frame: MatSpec = look.glasses === "gold" ? { ramp: "gold", bias: 0.4 } : { ramp: "fabric", bias: 1 };
    head.add(at(ring(0.045, 0.011, 8, frame), -0.055, 0.17, 0.155));
    head.add(at(ring(0.045, 0.011, 8, frame), 0.055, 0.17, 0.155));
    head.add(at(box(0.03, 0.012, 0.012, frame), 0, 0.175, 0.16));
  }
  if (look.headset) {
    const band: MatSpec = { ramp: "steel", bias: 0.6 };
    head.add(at(ring(0.175, 0.016, 10, band, Math.PI), 0, 0.16, 0));
    for (const s of [-1, 1]) head.add(at(cyl(0.05, 0.05, 0.045, 6, { ramp: "fabric" }), 0.17 * s, 0.14, 0, 0, 0, Math.PI / 2));
    head.add(at(cyl(0.008, 0.008, 0.17, 4, band), -0.14, 0.08, 0.09, 0.9, 0, 0.35));
    head.add(at(ball(0.022, 0, { ramp: "fabric" }), -0.09, 0.03, 0.16));
  }
  if (look.visor) {
    const visor: MatSpec = { ramp: "green", bias: -0.6 };
    head.add(scaled(at(ring(0.16, 0.018, 12, visor), 0, 0.24, 0, Math.PI / 2), 0.97, 0.94, 1));
    head.add(at(brimMesh(visor), 0, 0.235, 0.05, 0.35));
  }
  if (look.cap) {
    const cap: MatSpec = { ramp: look.capRamp };
    head.add(scaled(at(ball(0.165, 1, cap), 0, 0.25, -0.01), 1, 0.55, 1));
    head.add(at(box(0.16, 0.02, 0.14, { ramp: look.capRamp, bias: 0.6 }), 0, 0.25, -0.2, -0.25));
  }
  if (look.phones) {
    const band: MatSpec = { ramp: "fabric", bias: -0.4 };
    const cup: MatSpec = { ramp: look.topRamp === "fabric" ? "studio" : "fabric" };
    head.add(at(ring(0.18, 0.022, 10, band, Math.PI), 0, 0.17, 0));
    for (const s of [-1, 1]) {
      head.add(at(cyl(0.075, 0.075, 0.06, 8, cup), 0.175 * s, 0.14, 0, 0, 0, Math.PI / 2));
      head.add(at(cyl(0.05, 0.05, 0.065, 8, { ramp: "pink", fixedShade: 1 }), 0.18 * s, 0.14, 0, 0, 0, Math.PI / 2));
    }
  }
  if (look.hat === "hardhat") {
    const hat: MatSpec = { ramp: look.hatRamp };
    head.add(scaled(at(ball(0.175, 1, hat), 0, 0.27, -0.005), 1, 0.72, 1));
    head.add(at(cyl(0.215, 0.215, 0.02, 12, { ramp: look.hatRamp, bias: 0.5 }), 0, 0.255, 0.015));
    head.add(at(box(0.045, 0.035, 0.3, { ramp: look.hatRamp, bias: -0.4 }), 0, 0.39, -0.005));
  } else if (look.hat === "beanie") {
    const hat: MatSpec = { ramp: look.hatRamp };
    head.add(scaled(at(ball(0.172, 1, hat), 0, 0.27, -0.01), 1, 0.78, 1));
    head.add(at(ring(0.163, 0.03, 12, { ramp: look.hatRamp, bias: 0.6 }), 0, 0.235, -0.005, Math.PI / 2));
    head.add(at(ball(0.05, 0, { ramp: "studio" }), 0, 0.42, -0.01));
  } else if (look.hat === "beret") {
    const hat: MatSpec = { ramp: look.hatRamp };
    head.add(at(cyl(0.2, 0.17, 0.06, 12, hat), 0.03, 0.33, -0.01, 0.1, 0, -0.22));
    head.add(at(cyl(0.012, 0.016, 0.05, 4, { ramp: look.hatRamp, bias: 0.8 }), 0.05, 0.38, -0.01, 0, 0, -0.22));
  }
  if (look.halo) {
    head.add(at(ring(0.17, 0.025, 12, { ramp: "gold", fixedShade: 0 }), 0, 0.52, -0.02, Math.PI / 2 - 0.35));
  }

  return {
    root,
    body,
    torso,
    head,
    antennae: [antL.joints, antR.joints],
    shoulders: [armL.shoulder, armR.shoulder],
    elbows: [armL.elbow, armR.elbow],
  };
}

/** Голова батракана: хитиновый шар, безликая «маска» и усики. Общая для рангов и персонажей. */
export function addHeadShape(
  head: THREE.Group,
  antennaLen: number,
): { antL: { joints: THREE.Group[] }; antR: { joints: THREE.Group[] } } {
  head.add(scaled(at(ball(0.16, 1, CHITIN), 0, 0.16, 0), 0.95, 1.15, 0.92));
  // «Маска» без черт лица: светлее основного хитина, задаёт направление взгляда
  head.add(scaled(at(ball(0.13, 1, { ramp: "chitin", bias: -1.3 }), 0, 0.15, 0.09), 0.82, 1, 0.38));
  const antL = antenna(-1, antennaLen);
  const antR = antenna(1, antennaLen);
  head.add(antL.root, antR.root);
  return { antL, antR };
}

/** Изгиб усиков (как в позе idle): основание назад, кончики вперёд. */
export function relaxAntennae(chains: readonly (readonly THREE.Group[])[], back = -0.45, curl = -0.35): void {
  chains.forEach((chain, k) => {
    const side = k === 0 ? -1 : 1;
    chain.forEach((j, i) => {
      if (i === 0) j.rotation.set(back, 0, side * -0.35);
      else j.rotation.set(curl, 0, side * -0.1 * i);
    });
  });
}

/** Козырёк бухгалтера: полукруглый край только спереди. */
function brimMesh(spec: MatSpec): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 10, 1, false, -Math.PI / 2, Math.PI), spec);
}

/** Выставляет позу скелета для анимации anim в фазе t ∈ [0, 1). */
export function pose(rig: Rig, anim: Anim, t: number): void {
  const w = Math.PI * 2 * t;
  const s = Math.sin(w);
  const [shL, shR] = rig.shoulders;
  const [elL, elR] = rig.elbows;
  const [antL, antR] = rig.antennae;

  // База: печатает на клавиатуре
  rig.body.position.y = 0;
  rig.torso.rotation.set(0.04, 0, 0);
  rig.torso.scale.set(1, 1, 1);
  rig.head.rotation.set(0.05, 0, 0);
  shL.rotation.set(-0.7, 0, 0.25);
  shR.rotation.set(-0.7, 0, -0.25);
  elL.rotation.set(-0.85, 0, 0);
  elR.rotation.set(-0.85, 0, 0);
  let antSway = 0.1 * s;
  let antBack = -0.45;
  let antCurl = -0.35;

  switch (anim) {
    case "idle":
      rig.torso.scale.y = 1 + 0.02 * s;
      rig.head.rotation.z = 0.05 * s;
      antCurl = -0.35 + 0.08 * Math.sin(w + 1);
      break;
    case "work": {
      const l = Math.max(0, s);
      const r = Math.max(0, -s);
      shL.rotation.x = -0.7 - 0.12 * l;
      elL.rotation.x = -0.85 + 0.45 * l;
      shR.rotation.x = -0.7 - 0.12 * r;
      elR.rotation.x = -0.85 + 0.45 * r;
      rig.torso.rotation.x = 0.1;
      rig.head.rotation.x = 0.16 + 0.07 * Math.sin(w * 2);
      antSway = 0.14 * Math.sin(w * 2);
      antCurl = -0.35 + 0.15 * Math.sin(w * 2 + 0.5);
      break;
    }
    case "joy":
      rig.body.position.y = 0.06 * Math.abs(s);
      rig.torso.rotation.x = -0.14;
      rig.head.rotation.x = -0.28;
      shL.rotation.set(-2.7, 0, -0.45 - 0.15 * s);
      shR.rotation.set(-2.7, 0, 0.45 + 0.15 * s);
      elL.rotation.x = -0.35;
      elR.rotation.x = -0.35;
      antBack = -0.12;
      antSway = 0.2 * s;
      antCurl = -0.1 + 0.25 * s;
      break;
    case "sad":
      rig.torso.rotation.x = 0.34;
      rig.torso.scale.y = 0.97;
      rig.head.rotation.set(0.5 + 0.03 * s, 0, 0.08);
      shL.rotation.set(-0.15, 0, 0.08);
      shR.rotation.set(-0.15, 0, -0.08);
      elL.rotation.x = -0.2;
      elR.rotation.x = -0.2;
      antBack = 0.5;
      antCurl = 0.6 + 0.08 * s;
      antSway = 0.04 * s;
      break;
  }

  for (const [chain, side] of [
    [antL, -1],
    [antR, 1],
  ] as const) {
    chain.forEach((j, i) => {
      if (i === 0) j.rotation.set(antBack, 0, side * -0.35 + side * antSway);
      else j.rotation.set(antCurl, 0, side * -0.1 * i);
    });
  }
}
