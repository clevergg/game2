/**
 * Конструктор low-poly моделей: примитивы с малым числом граней и привязкой к материалу-рампе.
 * Материал задаётся не цветом, а рампой палитры: оттенок выберет рендер по освещённости.
 */
import * as THREE from "three";
import type { RampName } from "../../../src/data/palette";

export interface MatSpec {
  readonly ramp: RampName;
  /** Сдвиг оттенка: отрицательный — светлее, положительный — темнее. */
  readonly bias?: number;
  /** Фиксированный оттенок без освещения (экраны, нимб, тени). */
  readonly fixedShade?: 0 | 1 | 2 | 3;
}

const specs = new WeakMap<THREE.Object3D, MatSpec>();
const occluders = new WeakSet<THREE.Object3D>();

export function specOf(obj: THREE.Object3D): MatSpec | undefined {
  return specs.get(obj);
}

export function isOccluder(obj: THREE.Object3D): boolean {
  return occluders.has(obj);
}

/** Помечает всю иерархию как «невидимую маску глубины»: закрывает то, что за ней, но не рисуется. */
export function markOccluder(root: THREE.Object3D): THREE.Object3D {
  root.traverse((o) => occluders.add(o));
  return root;
}

export function mesh(geo: THREE.BufferGeometry, spec: MatSpec): THREE.Mesh {
  const m = new THREE.Mesh(geo);
  specs.set(m, spec);
  return m;
}

export const box = (w: number, h: number, d: number, spec: MatSpec): THREE.Mesh =>
  mesh(new THREE.BoxGeometry(w, h, d), spec);

export const cyl = (rTop: number, rBottom: number, h: number, seg: number, spec: MatSpec): THREE.Mesh =>
  mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), spec);

/** Сектор цилиндра: полы жилета и т.п. Угол 0 смотрит на камеру (+z). */
export const cylArc = (
  rTop: number,
  rBottom: number,
  h: number,
  seg: number,
  spec: MatSpec,
  start: number,
  length: number,
): THREE.Mesh => mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, false, start, length), spec);

export const ball = (r: number, detail: number, spec: MatSpec): THREE.Mesh =>
  mesh(new THREE.IcosahedronGeometry(r, detail), spec);

export const ring = (r: number, tube: number, seg: number, spec: MatSpec, arc = Math.PI * 2): THREE.Mesh =>
  mesh(new THREE.TorusGeometry(r, tube, 4, seg, arc), spec);

export const disc = (r: number, seg: number, spec: MatSpec): THREE.Mesh => {
  const geo = new THREE.CircleGeometry(r, seg);
  geo.rotateX(-Math.PI / 2);
  return mesh(geo, spec);
};

/** Плоская треугольная призма (клапан конверта и т.п.). */
export const prism = (w: number, h: number, depth: number, spec: MatSpec): THREE.Mesh => {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, -h);
  shape.closePath();
  return mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), spec);
};

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

export function scaled<T extends THREE.Object3D>(o: T, sx: number, sy: number, sz: number): T {
  o.scale.set(sx, sy, sz);
  return o;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  if (children.length > 0) g.add(...children);
  return g;
}
