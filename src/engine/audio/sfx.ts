/**
 * Рецепты звуковых эффектов. Каждый рецепт рисует звук в переданный узел, начиная с t=0.
 * Длительность `dur` — длина буфера, в который рендерится звук.
 */
import { type Ctx, midi, mulberry32, noise, note, tone } from "./synth";

export interface SfxRecipe {
  readonly dur: number;
  render(ctx: Ctx, out: AudioNode): void;
}

const arp = (
  ctx: Ctx,
  out: AudioNode,
  notes: readonly string[],
  step: number,
  type: OscillatorType,
  vol: number,
  last = 0.25,
): void => {
  notes.forEach((n, i) => {
    const isLast = i === notes.length - 1;
    tone(ctx, out, {
      type,
      freq: midi(note(n)),
      t: i * step,
      dur: isLast ? last : step * 1.4,
      vol,
      lowpass: 5000,
    });
  });
};

export const SFX = {
  /** Тап по батракану: клац клавиши. Рантайм слегка меняет высоту, чтобы серия не звучала одинаково. */
  tap: {
    dur: 0.07,
    render(ctx, out) {
      noise(ctx, out, { t: 0, dur: 0.035, vol: 0.5, filter: "highpass", freq: 2600 });
      tone(ctx, out, { type: "square", freq: 1900, freqEnd: 1300, t: 0, dur: 0.03, vol: 0.12 });
      noise(ctx, out, {
        t: 0.012,
        dur: 0.05,
        vol: 0.18,
        filter: "bandpass",
        freq: 900,
        q: 2,
        offset: 0.3,
      });
    },
  },
  /** Упал кукиш: сухой деревянный «ток» шишечки. */
  kukish: {
    dur: 0.12,
    render(ctx, out) {
      tone(ctx, out, { type: "sine", freq: 980, freqEnd: 620, t: 0, dur: 0.07, vol: 0.45 });
      tone(ctx, out, { type: "triangle", freq: 1470, t: 0, dur: 0.04, vol: 0.18 });
      noise(ctx, out, { t: 0, dur: 0.02, vol: 0.3, filter: "bandpass", freq: 3000, q: 3 });
    },
  },
  /** Найм: шорох бумаг в отделе квадров и звоночек. */
  hire: {
    dur: 0.45,
    render(ctx, out) {
      noise(ctx, out, {
        t: 0,
        dur: 0.12,
        vol: 0.35,
        filter: "bandpass",
        freq: 1200,
        freqEnd: 3500,
        q: 1.5,
      });
      tone(ctx, out, { type: "sine", freq: midi(note("E6")), t: 0.1, dur: 0.32, vol: 0.3 });
      tone(ctx, out, { type: "sine", freq: midi(note("E7")), t: 0.1, dur: 0.18, vol: 0.08 });
    },
  },
  /** Слияние: удар печати «ПОВЫШЕНИЕ!» и восходящее арпеджио. */
  merge: {
    dur: 0.6,
    render(ctx, out) {
      tone(ctx, out, { type: "sine", freq: 150, freqEnd: 50, t: 0, dur: 0.16, vol: 0.9 });
      noise(ctx, out, { t: 0, dur: 0.09, vol: 0.55, filter: "lowpass", freq: 700 });
      noise(ctx, out, { t: 0, dur: 0.03, vol: 0.3, filter: "highpass", freq: 3000, offset: 0.2 });
      ["C6", "E6", "G6"].forEach((n, i) => {
        tone(ctx, out, {
          type: "triangle",
          freq: midi(note(n)),
          t: 0.14 + i * 0.06,
          dur: i === 2 ? 0.3 : 0.1,
          vol: 0.28,
        });
      });
    },
  },
  /** Новый ранг впервые: короткая фанфара. */
  rankUp: {
    dur: 1.0,
    render(ctx, out) {
      arp(ctx, out, ["C5", "E5", "G5", "C6"], 0.085, "square", 0.14, 0.5);
      for (const n of ["C5", "E5", "G5"]) {
        tone(ctx, out, {
          type: "square",
          freq: midi(note(n)),
          t: 0.34,
          dur: 0.6,
          vol: 0.07,
          vibrato: [6, 12],
          lowpass: 3500,
        });
      }
    },
  },
  /** Дебик пробегает: писк «деб!». */
  debik: {
    dur: 0.2,
    render(ctx, out) {
      tone(ctx, out, {
        type: "square",
        freq: 1400,
        freqEnd: 2300,
        t: 0,
        dur: 0.06,
        vol: 0.12,
        lowpass: 4000,
      });
      tone(ctx, out, {
        type: "square",
        freq: 2300,
        freqEnd: 1100,
        t: 0.06,
        dur: 0.1,
        vol: 0.12,
        lowpass: 4000,
      });
    },
  },
  /** Поймал дебика: звонкое «плинь» и кукиши. */
  debikCatch: {
    dur: 0.5,
    render(ctx, out) {
      tone(ctx, out, { type: "triangle", freq: midi(note("A6")), t: 0, dur: 0.12, vol: 0.3 });
      tone(ctx, out, { type: "triangle", freq: midi(note("D7")), t: 0.07, dur: 0.35, vol: 0.28 });
      for (let i = 0; i < 3; i++)
        tone(ctx, out, {
          type: "sine",
          freq: 900 - i * 80,
          freqEnd: 600,
          t: 0.12 + i * 0.07,
          dur: 0.06,
          vol: 0.25,
        });
    },
  },
  /** Записка падает сверху: шелест бумаги со свистом. */
  note: {
    dur: 0.55,
    render(ctx, out) {
      noise(ctx, out, {
        t: 0,
        dur: 0.5,
        vol: 0.25,
        filter: "bandpass",
        freq: 3200,
        freqEnd: 900,
        q: 2.5,
        attack: 0.05,
      });
      const rnd = mulberry32(7);
      for (let i = 0; i < 6; i++) {
        noise(ctx, out, {
          t: 0.05 + i * 0.07,
          dur: 0.04,
          vol: 0.2,
          filter: "bandpass",
          freq: 1500 + rnd() * 2000,
          q: 4,
          offset: rnd(),
        });
      }
    },
  },
  /** Премия выплачена: «медная» фанфара. */
  bonus: {
    dur: 1.2,
    render(ctx, out) {
      const seq: [string, number, number][] = [
        ["G4", 0, 0.12],
        ["C5", 0.12, 0.12],
        ["E5", 0.24, 0.12],
        ["G5", 0.36, 0.7],
      ];
      for (const [n, t, d] of seq) {
        tone(ctx, out, {
          type: "sawtooth",
          freq: midi(note(n)),
          t,
          dur: d,
          vol: 0.16,
          lowpass: 2200,
          attack: 0.02,
          vibrato: [5, 8],
        });
        tone(ctx, out, {
          type: "sawtooth",
          freq: midi(note(n)),
          t,
          dur: d,
          vol: 0.1,
          lowpass: 2200,
          attack: 0.02,
          detune: 8,
        });
      }
      tone(ctx, out, {
        type: "square",
        freq: midi(note("C4")),
        t: 0.36,
        dur: 0.7,
        vol: 0.08,
        lowpass: 900,
      });
    },
  },
  /** Калоидный ускоритель: бульканье. */
  coloid: {
    dur: 0.7,
    render(ctx, out) {
      const rnd = mulberry32(42);
      for (let i = 0; i < 7; i++) {
        const f = 350 + rnd() * 500;
        tone(ctx, out, {
          type: "sine",
          freq: f,
          freqEnd: f * 1.9,
          t: i * 0.08 + rnd() * 0.03,
          dur: 0.07,
          vol: 0.3,
        });
      }
      noise(ctx, out, { t: 0, dur: 0.6, vol: 0.06, filter: "lowpass", freq: 500 });
    },
  },
  /** Сдал в слоповину: мнётся бумага, звякает ведро. */
  trash: {
    dur: 0.7,
    render(ctx, out) {
      const rnd = mulberry32(99);
      for (let i = 0; i < 5; i++) {
        noise(ctx, out, {
          t: i * 0.035,
          dur: 0.05,
          vol: 0.3,
          filter: "bandpass",
          freq: 1500 + rnd() * 2500,
          q: 2,
          offset: rnd(),
        });
      }
      for (const [f, v] of [
        [540, 0.25],
        [830, 0.16],
        [1210, 0.1],
        [1690, 0.06],
      ] as const) {
        tone(ctx, out, { type: "sine", freq: f, t: 0.16, dur: 0.5, vol: v });
      }
    },
  },
  /** Нельзя (нет кукишей, нет мест): короткий зуммер. */
  deny: {
    dur: 0.25,
    render(ctx, out) {
      tone(ctx, out, { type: "square", freq: 150, t: 0, dur: 0.09, vol: 0.14, lowpass: 1200 });
      tone(ctx, out, { type: "square", freq: 118, t: 0.1, dur: 0.12, vol: 0.14, lowpass: 1200 });
    },
  },
  /** Нажатие кнопки интерфейса. */
  click: {
    dur: 0.05,
    render(ctx, out) {
      tone(ctx, out, { type: "sine", freq: 2100, freqEnd: 1600, t: 0, dur: 0.03, vol: 0.2 });
    },
  },
  /** Шабашка выполнена (обратная связь на успех). */
  success: {
    dur: 0.7,
    render(ctx, out) {
      arp(ctx, out, ["G5", "C6", "E6", "G6"], 0.07, "triangle", 0.24, 0.35);
    },
  },
  /** Шабашка провалена (обратная связь на провал): грустный тромбон. */
  fail: {
    dur: 1.1,
    render(ctx, out) {
      const seq: [string, number, number][] = [
        ["G4", 0, 0.22],
        ["F#4", 0.24, 0.22],
        ["F4", 0.48, 0.55],
      ];
      for (const [n, t, d] of seq) {
        tone(ctx, out, {
          type: "sawtooth",
          freq: midi(note(n)),
          t,
          dur: d,
          vol: 0.16,
          lowpass: 1300,
          attack: 0.03,
          vibrato: t > 0.4 ? [7, 30] : [5, 5],
        });
      }
    },
  },
} as const satisfies Record<string, SfxRecipe>;

export type SfxName = keyof typeof SFX;

export const SFX_NAMES = Object.keys(SFX) as SfxName[];

export const SFX_SAMPLE_RATE = 22050;

/**
 * Целевой пик каждого эффекта после нормализации. Частые звуки (тап, кукиш, клик) тише,
 * чтобы не утомлять; редкие награды (премия, новый ранг, слияние) громче — это «событие».
 */
const SFX_LEVEL: Record<SfxName, number> = {
  tap: 0.32,
  kukish: 0.3,
  click: 0.3,
  hire: 0.5,
  merge: 0.7,
  rankUp: 0.65,
  debik: 0.45,
  debikCatch: 0.55,
  note: 0.45,
  bonus: 0.7,
  coloid: 0.5,
  trash: 0.5,
  deny: 0.45,
  success: 0.6,
  fail: 0.55,
};

/** Рендер эффекта в буфер с нормализацией громкости. На старте игры так рендерятся все эффекты. */
export async function renderSfx(name: SfxName, sampleRate = SFX_SAMPLE_RATE): Promise<AudioBuffer> {
  const recipe: SfxRecipe = SFX[name];
  const ctx = new OfflineAudioContext(1, Math.ceil(recipe.dur * sampleRate), sampleRate);
  recipe.render(ctx, ctx.destination);
  const buf = await ctx.startRendering();
  const data = buf.getChannelData(0);
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) {
    const k = SFX_LEVEL[name] / peak;
    for (let i = 0; i < data.length; i++) data[i] = (data[i] ?? 0) * k;
  }
  return buf;
}
