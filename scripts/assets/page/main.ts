/**
 * Страница-генератор: выполняется в headless Chromium. Строит все модели, рендерит кадры,
 * упаковывает атлас и собирает превью. Наружу отдаёт только индексы палитры (base64) и метаданные.
 */
import * as THREE from "three";
import { OUTLINE_INDEX, paletteIndex } from "../../../src/data/palette";
import { FONT_CHARS, glyphFrameName, glyphImage } from "../lib/font";
import { packShelves } from "../lib/pack";
import { blit, createImage, type IndexedImage, scaleNearest, trim } from "../lib/raster";
import type { AnimMeta, FrameRect, GenImage, GenResult } from "../types";
import { CAMERA_YAW, type FrameSpec, SpriteRenderer } from "./gl";
import { ANIM_FPS, ANIM_FRAMES, ANIMS, buildBatrakan, pose } from "./models/batrakan";
import { buildDesk, buildLockedDesk } from "./models/office";
import { buildDebik, buildEnvelope, buildFlask, buildIcon, buildKukish, buildNote, buildSlop } from "./models/props";
import { RANK_LOOKS } from "./looks";
import { carpetTile, wallTile } from "./tiles";

/** Пикселей на единицу мира для персонажей и мебели — общий масштаб сцены. */
const PPU = 80;
const CHAR: FrameSpec = { w: 176, h: 300, ppu: PPU, ax: 88, ay: 252 };
/** Ширина атласа: 2048 держит высоту в пределах безопасных для мобильных GPU 2048 px. */
const ATLAS_MAX_W = 2048;

interface Frame {
  readonly name: string;
  readonly img: IndexedImage;
  readonly ax: number;
  readonly ay: number;
  /** Тайлы и глифы не обрезаем: у них важны точные размеры. */
  readonly keepSize?: boolean;
}

function toB64(data: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < data.length; i += step) s += String.fromCharCode(...data.subarray(i, i + step));
  return btoa(s);
}

function image(img: IndexedImage): GenImage {
  return { w: img.w, h: img.h, b64: toB64(img.data) };
}

function facing(model: THREE.Object3D, yaw = CAMERA_YAW, tilt = 0): THREE.Object3D {
  const g = new THREE.Group();
  g.add(model);
  model.rotation.y += yaw;
  model.rotation.x += tilt;
  return g;
}

function generate(): GenResult {
  const t0 = performance.now();
  const r = new SpriteRenderer();
  const frames: Frame[] = [];
  const anims: Record<string, AnimMeta> = {};
  const add = (name: string, img: IndexedImage, f: { ax: number; ay: number }, keepSize = false): void => {
    frames.push({ name, img, ax: f.ax, ay: f.ay, keepSize });
  };
  const loop = (name: string, count: number, fps: number, make: (i: number, t: number) => [IndexedImage, FrameSpec]): void => {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const [img, f] = make(i, i / count);
      const n = `${name}_${i}`;
      add(n, img, f);
      names.push(n);
    }
    anims[name] = { frames: names, fps, loop: true };
  };

  // Батраканы: 10 рангов × 4 анимации. Стол — невидимая маска: срезает то, что им закрыто.
  RANK_LOOKS.forEach((look, i) => {
    const rank = i + 1;
    for (const anim of ANIMS) {
      loop(`b${rank}_${anim}`, ANIM_FRAMES[anim], ANIM_FPS[anim], (_k, t) => {
        const rig = buildBatrakan(look);
        pose(rig, anim, t);
        return [r.render(`b${rank}_${anim}`, rig.root, CHAR, buildDesk()), CHAR];
      });
    }
  });

  add("desk", r.render("desk", buildDesk(), CHAR), CHAR);
  add("desk_locked", r.render("desk_locked", buildLockedDesk(), CHAR), CHAR);

  const DEBIK: FrameSpec = { w: 96, h: 80, ppu: 120, ax: 48, ay: 60 };
  loop("debik_run", 4, 12, (_i, t) => [r.render("debik", facing(buildDebik(t)), DEBIK), DEBIK]);

  const KUKISH: FrameSpec = { w: 36, h: 40, ppu: 100, ax: 18, ay: 33 };
  add("kukish", r.render("kukish", buildKukish(), KUKISH), KUKISH);
  const KUKISH_ICON: FrameSpec = { w: 72, h: 80, ppu: 220, ax: 36, ay: 68 };
  add("icon_kukish", r.render("icon_kukish", buildKukish(), KUKISH_ICON), KUKISH_ICON);

  const NOTE: FrameSpec = { w: 80, h: 72, ppu: 170, ax: 40, ay: 40 };
  loop("note", 4, 8, (_i, t) => {
    const note = buildNote();
    note.rotation.set(0.25 * Math.cos(t * Math.PI * 2), 0, 0.28 * Math.sin(t * Math.PI * 2));
    return [r.render("note", facing(note), NOTE), NOTE];
  });

  const ENVELOPE: FrameSpec = { w: 96, h: 84, ppu: 180, ax: 48, ay: 44 };
  add("envelope", r.render("envelope", facing(buildEnvelope(), CAMERA_YAW, -0.35), ENVELOPE), ENVELOPE);

  const FLASK: FrameSpec = { w: 80, h: 132, ppu: 150, ax: 40, ay: 116 };
  loop("coloid", 4, 8, (_i, t) => [r.render("coloid", buildFlask(t), FLASK), FLASK]);

  const SLOP: FrameSpec = { w: 100, h: 100, ppu: 150, ax: 50, ay: 80 };
  add("slop", r.render("slop", buildSlop(), SLOP), SLOP);

  const ICON: FrameSpec = { w: 96, h: 108, ppu: 100, ax: 48, ay: 90 };
  for (const kind of ["hire", "cards", "board", "settings"] as const) {
    add(`icon_${kind}`, r.render(`icon_${kind}`, facing(buildIcon(kind), 0.2), ICON), ICON);
  }

  add("floor_carpet", carpetTile(), { ax: 0, ay: 0 }, true);
  add("wall_panel", wallTile(), { ax: 0, ay: 0 }, true);

  const fontStyles = { gold: paletteIndex("gold", 1), green: paletteIndex("crt", 0) } as const;
  for (const [style, fill] of Object.entries(fontStyles)) {
    for (const ch of FONT_CHARS) add(glyphFrameName(style, ch), glyphImage(ch, fill, OUTLINE_INDEX), { ax: 0, ay: 0 }, true);
  }

  // Обрезка и упаковка атласа
  const trimmed = frames.map((f) => {
    if (f.keepSize) return { name: f.name, img: f.img, ax: f.ax, ay: f.ay };
    const t = trim(f.img);
    return { name: f.name, img: t.img, ax: f.ax - t.x, ay: f.ay - t.y };
  });
  const packed = packShelves(
    trimmed.map((f) => ({ w: f.img.w, h: f.img.h })),
    ATLAS_MAX_W,
    1,
  );
  const atlas = createImage(packed.width, packed.height);
  const rects: Record<string, FrameRect> = {};
  const byName = new Map<string, { img: IndexedImage; ax: number; ay: number }>();
  trimmed.forEach((f, i) => {
    const p = packed.positions[i];
    if (!p) throw new Error(`Нет позиции для ${f.name}`);
    blit(atlas, f.img, p.x, p.y);
    rects[f.name] = [p.x, p.y, f.img.w, f.img.h, f.ax, f.ay];
    byName.set(f.name, f);
  });

  const renderMs = Math.round(performance.now() - t0);
  const scene = previewScene(byName, anims);
  return {
    atlas: image(atlas),
    ppu: PPU,
    frames: rects,
    anims,
    sheet: image(scaleNearest(scene.sheet, 2)),
    animSheet: image(scene.animSheet),
    office: { w: scene.office[0]?.w ?? 0, h: scene.office[0]?.h ?? 0, frames: scene.office.map((f) => toB64(f.data)), delayMs: 83 },
    stats: { renderMs, frameCount: frames.length },
  };
}

type FrameMap = Map<string, { img: IndexedImage; ax: number; ay: number }>;

/** Превью: офис с 10 рангами за столами (статичный лист) и анимированный офис (APNG). */
function previewScene(byName: FrameMap, anims: Record<string, AnimMeta>): { sheet: IndexedImage; office: IndexedImage[]; animSheet: IndexedImage } {
  const W = 640;
  const H = 560;
  const put = (dst: IndexedImage, name: string, x: number, y: number): void => {
    const f = byName.get(name);
    if (!f) throw new Error(`Превью: нет кадра ${name}`);
    blit(dst, f.img, Math.round(x - f.ax), Math.round(y - f.ay));
  };
  const text = (dst: IndexedImage, s: string, x: number, y: number): void => {
    let cx = x;
    for (const ch of s) {
      const f = byName.get(glyphFrameName("gold", ch));
      if (!f) continue;
      blit(dst, f.img, cx, y);
      cx += f.img.w - 1;
    }
  };
  const background = (): IndexedImage => {
    const img = createImage(W, H);
    const carpet = byName.get("floor_carpet");
    const wall = byName.get("wall_panel");
    if (!carpet || !wall) throw new Error("Нет тайлов");
    for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 64) blit(img, carpet.img, x, y);
    for (let x = 0; x < W; x += 64) blit(img, wall.img, x, 0);
    return img;
  };
  const desks = (img: IndexedImage, frameOf: (rank: number) => string): void => {
    for (let i = 0; i < 10; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 70 + col * 125;
      const y = 250 + row * 175;
      put(img, "desk", x, y);
      put(img, frameOf(i + 1), x, y);
    }
    // Подписи рангов — поверх всего, иначе их закрывают столы следующего ряда
    for (let i = 0; i < 10; i++) text(img, String(i + 1), 67 + (i % 5) * 125, 264 + Math.floor(i / 5) * 175);
  };

  const sheet = background();
  desks(sheet, (rank) => `b${rank}_idle_0`);
  put(sheet, "debik_run_0", 60, 548);
  put(sheet, "icon_kukish", 130, 548);
  put(sheet, "note_0", 200, 530);
  put(sheet, "envelope", 280, 530);
  put(sheet, "coloid_0", 350, 548);
  put(sheet, "slop", 425, 548);
  put(sheet, "icon_hire", 500, 548);
  put(sheet, "icon_cards", 560, 548);
  put(sheet, "icon_board", 610, 548);

  const office: IndexedImage[] = [];
  const FRAMES = 12;
  for (let k = 0; k < FRAMES; k++) {
    const img = background();
    desks(img, (rank) => {
      const anim = rank === 4 ? "joy" : rank === 8 ? "sad" : rank === 2 || rank === 6 ? "idle" : "work";
      const meta = anims[`b${rank}_${anim}`];
      const names = meta?.frames ?? [];
      const step = anim === "work" ? k : Math.floor(k / 2);
      return names[step % names.length] ?? `b${rank}_idle_0`;
    });
    put(img, `debik_run_${k % 4}`, 40 + (k * 560) / FRAMES, 540);
    put(img, `coloid_${Math.floor(k / 3) % 4}`, 600, 540);
    office.push(img);
  }
  // Раскадровка: строки — (ранг, анимация), столбцы — кадры
  const rows: [number, string][] = [
    [1, "work"],
    [5, "idle"],
    [5, "work"],
    [5, "joy"],
    [5, "sad"],
    [10, "joy"],
  ];
  const CELL_W = 118;
  const CELL_H = 214;
  const animSheet = createImage(CELL_W * 6 + 20, CELL_H * rows.length + 10);
  const carpet = byName.get("floor_carpet");
  if (carpet) for (let y = 0; y < animSheet.h; y += 64) for (let x = 0; x < animSheet.w; x += 64) blit(animSheet, carpet.img, x, y);
  rows.forEach(([rank, anim], row) => {
    const names = anims[`b${rank}_${anim}`]?.frames ?? [];
    names.forEach((n, col) => {
      const x = 70 + col * CELL_W;
      const y = 190 + row * CELL_H;
      put(animSheet, "desk", x, y);
      put(animSheet, n, x, y);
    });
  });
  return { sheet, office, animSheet };
}

declare global {
  interface Window {
    __assets?: { generate(): GenResult };
  }
}

window.__assets = { generate };
