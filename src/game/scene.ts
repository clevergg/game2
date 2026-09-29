/**
 * Сцена офиса: рисует пол, столы, батраканов, слоповину, частицы и всплывающие числа;
 * превращает события core в «сок» (анимации, тряску, звуки) и отвечает на вопросы ввода
 * («какой стол под пальцем?»). Состояние игры сцена только читает.
 */
import { BALANCE } from "../data/balance";
import { MAX_RANK } from "../data/ranks";
import { EV } from "../core/events";
import type { OfficeState } from "../core/state";
import { type Anim, Atlas } from "../engine/atlas";
import type { AudioPlayer } from "../engine/audio/player";
import type { FloatingNumbers, Particles } from "../engine/particles";
import type { Renderer } from "../engine/renderer";
import type { Layout } from "./layout";

const ANIM = { idle: 0, work: 1, joy: 2, sad: 3 } as const;
const ANIM_NAMES = ["idle", "work", "joy", "sad"] as const;
const STYLE_GOLD = 0;
const POP_TIME = 0.35;

export interface SceneSignals {
  /** Слияние: показать штамп «ПОВЫШЕНИЕ!» в точке экрана. */
  stamp(x: number, y: number): void;
  rankUnlocked(rank: number): void;
  denied(reason: number): void;
}

export class OfficeScene {
  private readonly deskFrame: number;
  private readonly lockedFrame: number;
  private readonly slopFrame: number;
  private readonly floorFrame: number;
  private readonly wallFrame: number;
  private readonly kukishFrame: number;
  private readonly greenDigits: Int16Array;
  /** anims[rank][ANIM.*] */
  private readonly anims: Anim[][] = [];

  private readonly anim: Uint8Array;
  private readonly animT: Float32Array;
  private readonly animLeft: Float32Array;
  private readonly pop: Float32Array;
  private readonly popMerge: Uint8Array;
  private readonly squash: Float32Array;

  private dragFrom = -1;
  private dragX = 0;
  private dragY = 0;
  private dragTarget = -1;
  private dragOverSlop = false;
  private shake = 0;
  private slopBounce = 0;
  private rankUpDelay = -1;
  private time = 0;
  private seed = 12345;

  constructor(
    atlas: Atlas,
    private readonly r: Renderer,
    private readonly particles: Particles,
    private readonly numbers: FloatingNumbers,
    private readonly audio: AudioPlayer,
    private readonly state: OfficeState,
    private layout: Layout,
    private readonly signals: SceneSignals,
  ) {
    this.deskFrame = atlas.frame("desk");
    this.lockedFrame = atlas.frame("desk_locked");
    this.slopFrame = atlas.frame("slop");
    this.floorFrame = atlas.frame("floor_carpet");
    this.wallFrame = atlas.frame("wall_panel");
    this.kukishFrame = atlas.frame("kukish");
    this.greenDigits = Int16Array.from({ length: 10 }, (_, d) =>
      atlas.frame(`font_green_${(48 + d).toString(16)}`),
    );
    for (let rank = 0; rank <= MAX_RANK; rank++) {
      this.anims.push(rank === 0 ? [] : ANIM_NAMES.map((a) => atlas.anim(`b${rank}_${a}`)));
    }
    const n = BALANCE.desksMax;
    this.anim = new Uint8Array(n).fill(ANIM.work);
    this.animT = new Float32Array(n);
    this.animLeft = new Float32Array(n);
    this.pop = new Float32Array(n).fill(-1);
    this.popMerge = new Uint8Array(n);
    this.squash = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.animT[i] = this.rand() * 2;
      this.animLeft[i] = 1 + this.rand() * 3;
    }
  }

  setLayout(l: Layout): void {
    this.layout = l;
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private setAnim(desk: number, a: number, duration: number): void {
    this.anim[desk] = a;
    this.animT[desk] = 0;
    this.animLeft[desk] = duration;
  }

  /** Верх головы батракана над якорем стола, в CSS-пикселях. */
  private headY(desk: number): number {
    return (this.layout.deskY[desk] ?? 0) - 150 * this.layout.scale;
  }

  onEvent(kind: number, a: number, b: number, value: number): void {
    const L = this.layout;
    const s = L.scale;
    const x = L.deskX[a] ?? 0;
    switch (kind) {
      case EV.payout:
        this.numbers.spawn(value, x, this.headY(a) + 8 * s, STYLE_GOLD, s * 1.2);
        this.audio.play("kukish", 1, 0.55);
        break;
      case EV.tap: {
        this.numbers.spawn(
          value,
          x + (this.rand() - 0.5) * 30,
          this.headY(a) - 6,
          STYLE_GOLD,
          s * 1.5,
        );
        const ky = (L.deskY[a] ?? 0) - 95 * s;
        for (let k = 0; k < 3; k++) {
          const f = this.greenDigits[Math.floor(this.rand() * 10)] ?? 0;
          this.particles.spawn(
            f,
            x + (this.rand() - 0.5) * 20 * s,
            ky,
            (this.rand() - 0.5) * 140,
            -140 - this.rand() * 90,
            0.7,
            420,
            s * 1.2,
          );
        }
        this.squash[a] = 0.14;
        if (this.anim[a] !== ANIM.joy) this.setAnim(a, ANIM.work, 2);
        this.audio.play("tap", 0.9 + this.rand() * 0.25);
        break;
      }
      case EV.hired:
        this.pop[a] = 0;
        this.popMerge[a] = 0;
        this.setAnim(a, ANIM.idle, 0.8);
        this.audio.play("hire");
        break;
      case EV.merged: {
        this.pop[a] = 0;
        this.popMerge[a] = 1;
        this.setAnim(a, ANIM.joy, 1.5);
        this.shake = 7;
        const cy = (L.deskY[a] ?? 0) - 90 * s;
        for (let k = 0; k < 10; k++) {
          const ang = this.rand() * Math.PI * 2;
          const sp = 120 + this.rand() * 160;
          const frame =
            k % 2 === 0 ? this.kukishFrame : (this.greenDigits[Math.floor(this.rand() * 10)] ?? 0);
          this.particles.spawn(
            frame,
            x,
            cy,
            Math.cos(ang) * sp,
            Math.sin(ang) * sp - 160,
            0.9,
            520,
            s,
          );
        }
        this.audio.play("merge");
        this.signals.stamp(x, cy - 20 * s);
        break;
      }
      case EV.moved:
        this.pop[b] = 0;
        this.popMerge[b] = 0;
        this.audio.play("click");
        break;
      case EV.swapped:
        this.pop[a] = 0;
        this.pop[b] = 0;
        this.popMerge[a] = 0;
        this.popMerge[b] = 0;
        this.audio.play("click");
        break;
      case EV.trashed:
        this.slopBounce = 0.4;
        this.numbers.spawn(value, L.slopX, L.slopY - 80, STYLE_GOLD, s);
        this.audio.play("trash");
        break;
      case EV.rankUnlocked:
        this.rankUpDelay = 0.35;
        this.signals.rankUnlocked(b);
        break;
      case EV.denied:
        this.audio.play("deny");
        this.signals.denied(b);
        break;
    }
  }

  /** Визуальные таймеры — в частоте кадров, чтобы анимации были плавными. */
  update(dt: number): void {
    this.time += dt;
    const n = this.state.deskCount;
    for (let i = 0; i < n; i++) {
      this.animT[i] = (this.animT[i] ?? 0) + dt;
      const left = (this.animLeft[i] ?? 0) - dt;
      this.animLeft[i] = left;
      if (left <= 0) {
        // Офис «живёт»: батраканы то колупают, то отдыхают
        this.setAnim(i, this.rand() < 0.72 ? ANIM.work : ANIM.idle, 2 + this.rand() * 3);
      }
      const p = this.pop[i] ?? -1;
      if (p >= 0) this.pop[i] = p + dt > POP_TIME ? -1 : p + dt;
      const sq = this.squash[i] ?? 0;
      if (sq > 0) this.squash[i] = Math.max(0, sq - dt);
    }
    this.shake = Math.max(0, this.shake - dt * 40);
    this.slopBounce = Math.max(0, this.slopBounce - dt);
    if (this.rankUpDelay >= 0) {
      this.rankUpDelay -= dt;
      if (this.rankUpDelay < 0) this.audio.play("rankUp");
    }
    this.particles.update(dt);
    this.numbers.update(dt);
  }

  private popScale(i: number): number {
    const p = this.pop[i] ?? -1;
    if (p < 0) return 1;
    const k = p / POP_TIME;
    if (this.popMerge[i] === 1) return 1 + 0.45 * Math.sin(k * Math.PI) * (1 - k); // упругий «поп»
    return k < 0.6 ? (k / 0.6) * 1.15 : 1.15 - 0.15 * ((k - 0.6) / 0.4); // появление из точки
  }

  draw(): void {
    const L = this.layout;
    const s = L.scale;
    const r = this.r;
    const sx = this.shake > 0 ? (this.rand() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (this.rand() - 0.5) * this.shake : 0;
    r.begin(sx, sy);
    r.tile(this.floorFrame, -8, -8, L.w + 16, L.h + 16, s);
    const wallH = 96 * s;
    r.tile(this.wallFrame, -8, 64 + 24 * s - wallH, L.w + 16, wallH, s);

    const st = this.state;
    const cols = L.cols;
    const total = L.rows * cols;
    for (let i = 0; i < total && i < BALANCE.desksMax; i++) {
      const x = L.deskX[i] ?? 0;
      const y = L.deskY[i] ?? 0;
      if (i >= st.deskCount) {
        r.sprite(this.lockedFrame, x, y, s, s, 1);
        continue;
      }
      if (this.dragFrom >= 0 && i === this.dragTarget) {
        const mergeable = st.desks[i] === st.desks[this.dragFrom] && (st.desks[i] ?? 0) < MAX_RANK;
        const pulse = 0.45 + 0.25 * Math.sin(this.time * 10);
        r.ellipse(x, y - 4 * s, 70 * s, 26 * s, mergeable ? "#ffd048" : "#fffaf0", pulse);
      }
      r.sprite(this.deskFrame, x, y, s, s, 1);
      const rank = st.desks[i] ?? 0;
      if (rank === 0 || i === this.dragFrom) continue;
      const a = this.anims[rank]?.[this.anim[i] ?? ANIM.work];
      if (!a) continue;
      const ps = this.popScale(i);
      const sq = this.squash[i] ?? 0;
      const squashY = sq > 0 ? 1 - 0.6 * sq : 1;
      r.sprite(
        Atlas.frameAt(a, this.animT[i] ?? 0),
        x,
        y,
        s * ps * (sq > 0 ? 1 + 0.3 * sq : 1),
        s * ps * squashY,
        1,
      );
      // Цифра ранга — на передней панели стола, крупно: ранг читается без знания силуэтов
      this.numbers.drawInt(
        r,
        rank,
        x - (rank >= 10 ? 9 : 4) * s * 1.6,
        y - 44 * s,
        s * 1.6,
        STYLE_GOLD,
      );
    }

    // Слоповина — в нижней панели слева от кнопки найма
    const slopPulse =
      this.dragFrom >= 0 ? (this.dragOverSlop ? 1.25 : 1.05 + 0.05 * Math.sin(this.time * 8)) : 1;
    const bounce =
      1 + 0.3 * Math.sin((this.slopBounce / 0.4) * Math.PI) * (this.slopBounce > 0 ? 1 : 0);
    if (this.dragOverSlop) r.ellipse(L.slopX, L.slopY - 4, 48, 16, "#e2503a", 0.55);
    r.sprite(
      this.slopFrame,
      L.slopX,
      L.slopY,
      0.85 * slopPulse * bounce,
      0.85 * slopPulse * bounce,
      1,
    );

    this.particles.draw(r);
    this.numbers.draw(r);

    if (this.dragFrom >= 0) {
      const rank = st.desks[this.dragFrom] ?? 0;
      const a = this.anims[rank]?.[ANIM.idle];
      if (a) {
        r.ellipse(this.dragX, this.dragY + 30 * s, 36 * s, 12 * s, "#1c1620", 0.3);
        r.sprite(
          Atlas.frameAt(a, this.time),
          this.dragX,
          this.dragY + 40 * s,
          s * 1.08,
          s * 1.08,
          1,
        );
      }
    }
  }

  // ——— Вопросы ввода ———

  /** Какой батракан под пальцем. Передние ряды перекрывают задние, поэтому ищем спереди назад. */
  hitDesk(x: number, y: number): number {
    const L = this.layout;
    const s = L.scale;
    for (let i = this.state.deskCount - 1; i >= 0; i--) {
      if ((this.state.desks[i] ?? 0) === 0) continue;
      const dx = x - (L.deskX[i] ?? 0);
      const dy = y - (L.deskY[i] ?? 0);
      if (Math.abs(dx) <= 58 * s && dy <= 12 * s && dy >= -165 * s) return i;
    }
    return -1;
  }

  /** Куда уронить: ближайший стол к «ногам» перетаскиваемого батракана. */
  private deskNear(x: number, y: number): number {
    const L = this.layout;
    const s = L.scale;
    let best = -1;
    let bestD = 80 * s;
    for (let i = 0; i < this.state.deskCount; i++) {
      const d = Math.hypot(x - (L.deskX[i] ?? 0), y + 40 * s - ((L.deskY[i] ?? 0) - 40 * s));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  isOverSlop(x: number, y: number): boolean {
    return Math.hypot(x - this.layout.slopX, y - (this.layout.slopY - 36)) < 52;
  }

  beginDrag(desk: number, x: number, y: number): void {
    this.dragFrom = desk;
    this.moveDrag(x, y);
  }

  moveDrag(x: number, y: number): void {
    this.dragX = x;
    this.dragY = y;
    this.dragOverSlop = this.isOverSlop(x, y);
    const t = this.dragOverSlop ? -1 : this.deskNear(x, y);
    this.dragTarget = t === this.dragFrom ? -1 : t;
  }

  /** Заканчивает драг и возвращает, куда уронили: стол, −2 — слоповина, −1 — никуда. */
  endDrag(): { from: number; to: number } {
    const res = { from: this.dragFrom, to: this.dragOverSlop ? -2 : this.dragTarget };
    this.dragFrom = -1;
    this.dragTarget = -1;
    this.dragOverSlop = false;
    return res;
  }

  get dragging(): boolean {
    return this.dragFrom >= 0;
  }
}
