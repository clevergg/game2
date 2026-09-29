/**
 * Фоновая музыка: бодрый «офисный MIDI» в духе игр начала 2000-х.
 * 8 тактов, 118 BPM, до мажор: C | Am | F | G | C | Am | Dm G | C.
 * Секвенсор рендерит луп в буфер один раз, дальше он играет по кругу бесшовно.
 */
import { type Ctx, midi, noise, note, tone } from "./synth";

const BPM = 118;
const STEP = 60 / BPM / 4; // шестнадцатая
const BAR = 16;
const BARS = 8;
export const MUSIC_SECONDS = STEP * BAR * BARS;

/** [шаг в такте, нота, длина в шагах] */
type Ev = readonly [number, string, number];

const MELODY: readonly (readonly Ev[])[] = [
  [
    [0, "E5", 2],
    [2, "G5", 2],
    [4, "C6", 2],
    [6, "G5", 2],
    [8, "E5", 4],
    [12, "D5", 2],
    [14, "E5", 2],
  ],
  [
    [0, "C5", 2],
    [2, "E5", 2],
    [4, "A5", 4],
    [8, "G5", 2],
    [10, "E5", 2],
    [12, "C5", 4],
  ],
  [
    [0, "F5", 2],
    [2, "A5", 2],
    [4, "C6", 2],
    [6, "A5", 2],
    [8, "F5", 4],
    [12, "G5", 2],
    [14, "A5", 2],
  ],
  [
    [0, "B5", 4],
    [4, "A5", 2],
    [6, "G5", 2],
    [8, "D5", 6],
    [14, "G5", 2],
  ],
  [
    [0, "E5", 2],
    [2, "G5", 2],
    [4, "C6", 2],
    [6, "G5", 2],
    [8, "E5", 4],
    [12, "D5", 2],
    [14, "E5", 2],
  ],
  [
    [0, "C6", 2],
    [2, "B5", 2],
    [4, "A5", 2],
    [6, "E5", 2],
    [8, "A5", 4],
    [12, "G5", 4],
  ],
  [
    [0, "F5", 2],
    [2, "A5", 2],
    [4, "D6", 4],
    [8, "B5", 2],
    [10, "G5", 2],
    [12, "D5", 4],
  ],
  [
    [0, "C6", 6],
    [6, "G5", 2],
    [8, "E5", 2],
    [10, "G5", 2],
    [12, "C5", 3],
  ],
];

/** Аккорды по половинам такта: [первая половина, вторая половина]. */
const CHORDS: readonly (readonly [readonly string[], readonly string[]])[] = [
  [
    ["C4", "E4", "G4"],
    ["C4", "E4", "G4"],
  ],
  [
    ["A3", "C4", "E4"],
    ["A3", "C4", "E4"],
  ],
  [
    ["F3", "A3", "C4"],
    ["F3", "A3", "C4"],
  ],
  [
    ["G3", "B3", "D4"],
    ["G3", "B3", "D4"],
  ],
  [
    ["C4", "E4", "G4"],
    ["C4", "E4", "G4"],
  ],
  [
    ["A3", "C4", "E4"],
    ["A3", "C4", "E4"],
  ],
  [
    ["D4", "F4", "A4"],
    ["G3", "B3", "D4"],
  ],
  [
    ["C4", "E4", "G4"],
    ["C4", "E4", "G4"],
  ],
];

function root(chord: readonly string[]): number {
  return note(chord[0] ?? "C4") - 12;
}

export function renderMusicInto(ctx: Ctx, out: AudioNode): void {
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(out);

  for (let bar = 0; bar < BARS; bar++) {
    const t0 = bar * BAR * STEP;
    const [c1, c2] = CHORDS[bar] ?? [[], []];

    // Мелодия: квадратная волна с вибрато, слегка приглушённая
    for (const [step, n, len] of MELODY[bar] ?? []) {
      tone(ctx, master, {
        type: "square",
        freq: midi(note(n)),
        t: t0 + step * STEP,
        dur: len * STEP * 0.92,
        vol: 0.075,
        vibrato: [5.5, 10],
        lowpass: 3200,
        attack: 0.008,
      });
    }
    // Бас: корень и квинта, «шагающий»
    for (const [step, chord] of [
      [0, c1],
      [4, c1],
      [8, c2],
      [12, c2],
    ] as const) {
      const r = root(chord);
      const n = step === 4 || step === 12 ? r + 7 : r;
      tone(ctx, master, {
        type: "triangle",
        freq: midi(n - 12),
        t: t0 + step * STEP,
        dur: STEP * 3.2,
        vol: 0.32,
        attack: 0.005,
      });
    }
    // Аккорды на слабые доли — «офисный ска»
    for (const step of [2, 6, 10, 14]) {
      const chord = step < 8 ? c1 : c2;
      for (const n of chord) {
        tone(ctx, master, {
          type: "square",
          freq: midi(note(n)),
          t: t0 + step * STEP,
          dur: STEP * 1.3,
          vol: 0.022,
          lowpass: 1800,
        });
      }
    }
    // Ударные
    for (let step = 0; step < BAR; step++) {
      const t = t0 + step * STEP;
      if (step === 0 || step === 8 || (step === 10 && bar % 2 === 1)) {
        tone(ctx, master, { type: "sine", freq: 150, freqEnd: 45, t, dur: 0.14, vol: 0.55 });
      }
      if (step === 4 || step === 12) {
        noise(ctx, master, {
          t,
          dur: 0.11,
          vol: 0.2,
          filter: "bandpass",
          freq: 1800,
          q: 0.8,
          offset: step * 0.01,
        });
        tone(ctx, master, { type: "triangle", freq: 190, freqEnd: 140, t, dur: 0.07, vol: 0.12 });
      }
      if (step % 2 === 0) {
        noise(ctx, master, {
          t,
          dur: step === 14 ? 0.09 : 0.03,
          vol: 0.06,
          filter: "highpass",
          freq: 7000,
          offset: 0.5 + step * 0.013,
        });
      }
    }
  }
}

export async function renderMusic(sampleRate = 22050): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(MUSIC_SECONDS * sampleRate), sampleRate);
  renderMusicInto(ctx, ctx.destination);
  return ctx.startRendering();
}
