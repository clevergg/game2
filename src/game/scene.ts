/**
 * Сцена офиса: рисует пол, столы, батраканов, слоповину, частицы и всплывающие числа;
 * превращает события core в «сок» (анимации, тряску, звуки) и отвечает на вопросы ввода
 * («какой стол под пальцем?»). Состояние игры сцена только читает.
 */
import { BALANCE, LIVE } from "../data/balance";
import { FLOOR_COUNT } from "../data/floors";
import { MAX_RANK } from "../data/ranks";
import { EV } from "../core/events";
import { NOTE } from "../core/live-state";
import type { FloorState, OfficeState } from "../core/state";
import { type Anim, Atlas } from "../engine/atlas";
import type { AudioPlayer } from "../engine/audio/player";
import type { FloatingNumbers, Particles } from "../engine/particles";
import type { Renderer } from "../engine/renderer";
import { HUD_BOTTOM, HUD_TOP, type Layout } from "./layout";

const ANIM = { idle: 0, work: 1, joy: 2, sad: 3 } as const;
const ANIM_NAMES = ["idle", "work", "joy", "sad"] as const;
const STYLE_GOLD = 0;
const POP_TIME = 0.35;

/** Что под пальцем, кроме батраканов: события на этаже. */
export const HIT = { none: 0, note: 1, debik: 2, kredik: 3 } as const;

/** События конкретного этажа; остальные (записки, дебики, баффы…) видны на любом этаже. */
const FLOOR_EVENTS = new Set<number>([
  EV.payout,
  EV.tap,
  EV.hired,
  EV.merged,
  EV.moved,
  EV.swapped,
  EV.trashed,
  EV.rareAppeared,
  EV.qualBought,
  EV.equipBought,
  EV.deskBought,
]);

export interface SceneSignals {
  /** Слияние: показать штамп «ПОВЫШЕНИЕ!» в точке экрана. */
  stamp(x: number, y: number): void;
  rankUnlocked(rank: number): void;
  denied(reason: number): void;
}

export class OfficeScene {
  /** Кадры мебели и пола по этажам. */
  private readonly deskFrames = new Int16Array(FLOOR_COUNT);
  private readonly lockedFrames = new Int16Array(FLOOR_COUNT);
  private readonly floorFrames = new Int16Array(FLOOR_COUNT);
  private readonly wallFrames = new Int16Array(FLOOR_COUNT);
  private readonly slopFrame: number;
  private readonly kukishFrame: number;
  private readonly plusFrame: number;
  private readonly noteAnim: Anim;
  private readonly debikAnim: Anim;
  private readonly kredikAnim: Anim;
  /** Сколько секунд бежит текущий дебик (−1 — дебика нет). */
  private debikT = -1;
  private noteT = 0;
  private sparkleIn = 0;
  private readonly greenDigits: Int16Array;
  /** anims[этаж][ранг][ANIM.*] */
  private readonly anims: Anim[][][] = [];

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
  /** Этаж, который сейчас на экране. */
  floor = 0;
  private seed = 12345;

  constructor(
    private readonly atlas: Atlas,
    private readonly r: Renderer,
    private readonly particles: Particles,
    private readonly numbers: FloatingNumbers,
    private readonly audio: AudioPlayer,
    private readonly state: OfficeState,
    private layout: Layout,
    private readonly signals: SceneSignals,
  ) {
    for (let fi = 0; fi < FLOOR_COUNT; fi++) {
      const p = `f${fi}_`;
      this.deskFrames[fi] = atlas.frame(`${p}desk`);
      this.lockedFrames[fi] = atlas.frame(`${p}desk_locked`);
      this.floorFrames[fi] = atlas.frame(`${p}floor`);
      this.wallFrames[fi] = atlas.frame(`${p}wall`);
      const ranks: Anim[][] = [];
      for (let rank = 0; rank <= MAX_RANK; rank++) {
        ranks.push(rank === 0 ? [] : ANIM_NAMES.map((a) => atlas.anim(`${p}b${rank}_${a}`)));
      }
      this.anims.push(ranks);
    }
    this.slopFrame = atlas.frame("slop");
    this.kukishFrame = atlas.frame("kukish");
    this.plusFrame = atlas.frame("font_gold_2b");
    this.noteAnim = atlas.anim("note");
    this.debikAnim = atlas.anim("debik_run");
    this.kredikAnim = atlas.anim("kredik");
    this.greenDigits = Int16Array.from({ length: 10 }, (_, d) =>
      atlas.frame(`font_green_${(48 + d).toString(16)}`),
    );
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

  private get fs(): FloorState {
    const f = this.state.floors[this.floor] ?? this.state.floors[0];
    if (!f) throw new Error("Нет этажей");
    return f;
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

  onEvent(kind: number, f: number, a: number, b: number, value: number): void {
    // События чужого этажа не рисуем: игрок их не видит
    if (f !== this.floor && FLOOR_EVENTS.has(kind)) return;
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
      case EV.rareAppeared:
        this.shake = 4;
        this.sparkleBurst(x, (L.deskY[a] ?? 0) - 100 * s, 14);
        this.audio.play("bonus");
        break;
      case EV.noteSpawned:
        this.noteT = 0;
        this.audio.play("note");
        break;
      case EV.debikSpawned:
        this.debikT = 0;
        this.audio.play("debik");
        break;
      case EV.debikLeft:
        this.debikT = -1;
        break;
      case EV.debikCaught: {
        this.debikPos();
        this.debikT = -1;
        this.numbers.spawn(value, this.ex, this.ey - 40 * s, STYLE_GOLD, s * 1.6);
        this.sparkleBurst(this.ex, this.ey - 20 * s, 10);
        this.audio.play("debikCatch");
        break;
      }
      case EV.noteOpened:
      case EV.shabashkaWon:
      case EV.inspectionWon:
      case EV.kredikAccepted:
        this.audio.play("bonus");
        break;
      case EV.shiftDone:
      case EV.taskDone:
        this.audio.play("success");
        break;
      case EV.shabashkaLost:
      case EV.inspectionLost:
        this.audio.play("fail");
        break;
      case EV.buffStarted:
        if (b === 2) this.audio.play("coloid");
        break;
      case EV.rewardClaimed:
      case EV.qualBought:
      case EV.equipBought:
      case EV.deskBought:
      case EV.perkBought:
        this.audio.play("kukish", 1.2, 0.9);
        break;
      case EV.floorUnlocked:
      case EV.reorganized:
        this.shake = 9;
        this.audio.play("rankUp");
        break;
    }
  }

  private sparkleBurst(x: number, y: number, n: number): void {
    const s = this.layout.scale;
    for (let k = 0; k < n; k++) {
      const ang = this.rand() * Math.PI * 2;
      const sp = 80 + this.rand() * 140;
      this.particles.spawn(
        this.plusFrame,
        x,
        y,
        Math.cos(ang) * sp,
        Math.sin(ang) * sp - 120,
        0.8,
        380,
        s * 1.4,
      );
    }
  }

  // ——— Записка, дебик, кредик: позиции на экране (пишутся в ex/ey, без аллокаций) ———

  private ex = 0;
  private ey = 0;

  private notePos(): void {
    const L = this.layout;
    this.ex = L.contentLeft + L.contentW - 46;
    this.ey = HUD_TOP + 58 + 6 * Math.sin(this.time * 3);
  }

  private debikPos(): void {
    const L = this.layout;
    const k = Math.min(1, Math.max(0, this.debikT / LIVE.debikTtl));
    this.ex = L.contentLeft + 30 + k * (L.contentW - 60);
    this.ey = L.h - HUD_BOTTOM - 10;
  }

  private kredikPos(): void {
    this.ex = this.layout.contentLeft + 52;
    this.ey = HUD_TOP + 150;
  }

  /** Где стоит кредик — для пузыря с предложением (DOM). */
  kredikAnchor(): { x: number; y: number } {
    this.kredikPos();
    return { x: this.ex, y: this.ey };
  }

  /** Что из событий под пальцем. Проверяется раньше батраканов: события поверх офиса. */
  hitEvent(x: number, y: number): number {
    const live = this.state.live;
    if (live.debikTtl > 0 && this.debikT >= 0) {
      this.debikPos();
      if (Math.hypot(x - this.ex, y - (this.ey - 20)) < 44) return HIT.debik;
    }
    if (live.note !== NOTE.none) {
      this.notePos();
      if (Math.hypot(x - this.ex, y - this.ey) < 40) return HIT.note;
    }
    if (live.kredikOffer > 0) {
      this.kredikPos();
      if (Math.hypot(x - this.ex, y - (this.ey - 50)) < 48) return HIT.kredik;
    }
    return HIT.none;
  }

  /** Визуальные таймеры — в частоте кадров, чтобы анимации были плавными. */
  update(dt: number): void {
    this.time += dt;
    const n = this.fs.deskCount;
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
    if (this.debikT >= 0) {
      this.debikT += dt;
      if (this.state.live.debikTtl <= 0) this.debikT = -1;
    } else if (this.state.live.debikTtl > 0) {
      // Дебик пришёл из сохранения или во время паузы — бежит с текущей точки
      this.debikT = LIVE.debikTtl - this.state.live.debikTtl;
    }
    this.noteT += dt;
    // Премированные батраканы искрят
    this.sparkleIn -= dt;
    if (this.sparkleIn <= 0) {
      this.sparkleIn = 0.35;
      const st = this.fs;
      for (let i = 0; i < st.deskCount; i++) {
        if (st.rare[i] === 1 && (st.desks[i] ?? 0) > 0 && this.rand() < 0.6) {
          const s = this.layout.scale;
          this.particles.spawn(
            this.plusFrame,
            (this.layout.deskX[i] ?? 0) + (this.rand() - 0.5) * 70 * s,
            (this.layout.deskY[i] ?? 0) - (60 + this.rand() * 90) * s,
            0,
            -40,
            0.9,
            0,
            s * 1.2,
          );
        }
      }
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
    const fi = this.floor;
    r.tile(this.floorFrames[fi] ?? 0, -8, -8, L.w + 16, L.h + 16, s);
    const wallH = 96 * s;
    r.tile(this.wallFrames[fi] ?? 0, -8, 64 + 24 * s - wallH, L.w + 16, wallH, s);
    const deskFrame = this.deskFrames[fi] ?? 0;
    const anims = this.anims[fi] ?? [];

    const st = this.fs;
    const cols = L.cols;
    const total = L.rows * cols;
    for (let i = 0; i < total && i < BALANCE.desksMax; i++) {
      const x = L.deskX[i] ?? 0;
      const y = L.deskY[i] ?? 0;
      if (i >= st.deskCount || fi >= this.state.floorsUnlocked) {
        r.sprite(this.lockedFrames[fi] ?? 0, x, y, s, s, 1);
        continue;
      }
      if (this.dragFrom >= 0 && i === this.dragTarget) {
        const mergeable = st.desks[i] === st.desks[this.dragFrom] && (st.desks[i] ?? 0) < MAX_RANK;
        const pulse = 0.45 + 0.25 * Math.sin(this.time * 10);
        r.ellipse(x, y - 4 * s, 70 * s, 26 * s, mergeable ? "#ffd048" : "#fffaf0", pulse);
      }
      const rank = st.desks[i] ?? 0;
      if (rank > 0 && st.rare[i] === 1) {
        // Премированный: золотое свечение под столом
        r.ellipse(
          x,
          y - 6 * s,
          74 * s,
          28 * s,
          "#ffd048",
          0.35 + 0.2 * Math.sin(this.time * 4 + i),
        );
      }
      r.sprite(deskFrame, x, y, s, s, 1);
      if (rank === 0 || i === this.dragFrom) continue;
      const a = anims[rank]?.[this.anim[i] ?? ANIM.work];
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

    this.drawEvents();
    this.particles.draw(r);
    this.numbers.draw(r);

    if (this.dragFrom >= 0) {
      const rank = st.desks[this.dragFrom] ?? 0;
      const a = anims[rank]?.[ANIM.idle];
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

  private drawEvents(): void {
    const r = this.r;
    const live = this.state.live;
    if (live.kredikOffer > 0) {
      this.kredikPos();
      r.ellipse(this.ex, this.ey - 4, 30, 9, "#1c1620", 0.25);
      r.sprite(Atlas.frameAt(this.kredikAnim, this.time), this.ex, this.ey, 0.9, 0.9, 1);
    }
    if (live.note !== NOTE.none) {
      this.notePos();
      const nx = this.ex;
      const ny = this.ey;
      // Записка пульсирует сильнее, когда скоро исчезнет
      const urgent = live.noteTtl < 4 ? 1 + 0.12 * Math.sin(this.time * 14) : 1;
      const k = Math.min(1, this.noteT * 4) * urgent;
      r.ellipse(nx, ny + 4, 34 * k, 34 * k, "#fff0a0", 0.35 + 0.15 * Math.sin(this.time * 6));
      r.sprite(Atlas.frameAt(this.noteAnim, this.time), nx, ny, 1.1 * k, 1.1 * k, 1);
    }
    if (live.debikTtl > 0 && this.debikT >= 0) {
      this.debikPos();
      r.ellipse(this.ex, this.ey - 2, 26, 7, "#1c1620", 0.25);
      r.sprite(Atlas.frameAt(this.debikAnim, this.time), this.ex, this.ey, 1, 1, 1);
    }
  }

  // ——— Вопросы ввода ———

  /** Какой батракан под пальцем. Передние ряды перекрывают задние, поэтому ищем спереди назад. */
  hitDesk(x: number, y: number): number {
    const L = this.layout;
    const s = L.scale;
    for (let i = this.fs.deskCount - 1; i >= 0; i--) {
      if ((this.fs.desks[i] ?? 0) === 0) continue;
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
    for (let i = 0; i < this.fs.deskCount; i++) {
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

  /** Загружен ли лист атласа с этажом на экране (листы этажей грузятся лениво). */
  get floorReady(): boolean {
    return this.atlas.isLoaded(this.atlas.sheet[this.deskFrames[this.floor] ?? 0] ?? 0);
  }

  get dragging(): boolean {
    return this.dragFrom >= 0;
  }
}
