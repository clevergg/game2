/**
 * Кирпичики синтеза на WebAudio: тон с огибающей и глиссандо, фильтрованный шум.
 * Звуки не хранятся файлами: при старте рендерятся в буферы через OfflineAudioContext.
 * Шум детерминированный (свой ГСЧ), поэтому звук одинаков на всех устройствах.
 */
export type Ctx = BaseAudioContext;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseCache = new WeakMap<Ctx, AudioBuffer>();

function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = mulberry32(1337);
    for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

/** Огибающая: быстрый подъём, экспоненциальный спад до тишины. */
function envelope(ctx: Ctx, t: number, dur: number, vol: number, attack: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

export interface ToneOpts {
  readonly type: OscillatorType;
  readonly freq: number;
  /** Частота в конце звука (глиссандо). */
  readonly freqEnd?: number;
  readonly t: number;
  readonly dur: number;
  readonly vol: number;
  readonly attack?: number;
  /** Вибрато: [частота Гц, глубина в центах]. */
  readonly vibrato?: readonly [number, number];
  readonly lowpass?: number;
  readonly detune?: number;
}

export function tone(ctx: Ctx, out: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
  if (o.detune !== undefined) osc.detune.value = o.detune;
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.vibrato[0];
    depth.gain.value = o.vibrato[1];
    lfo.connect(depth).connect(osc.detune);
    lfo.start(o.t);
    lfo.stop(o.t + o.dur);
  }
  let node: AudioNode = osc;
  if (o.lowpass !== undefined) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lowpass;
    node = node.connect(f);
  }
  node.connect(envelope(ctx, o.t, o.dur, o.vol, o.attack ?? 0.004)).connect(out);
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.01);
}

export interface NoiseOpts {
  readonly t: number;
  readonly dur: number;
  readonly vol: number;
  readonly filter: BiquadFilterType;
  readonly freq: number;
  readonly freqEnd?: number;
  readonly q?: number;
  readonly attack?: number;
  /** Смещение в буфере шума, чтобы соседние удары не звучали одинаково. */
  readonly offset?: number;
}

export function noise(ctx: Ctx, out: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter;
  f.frequency.setValueAtTime(o.freq, o.t);
  if (o.freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
  f.Q.value = o.q ?? 1;
  src
    .connect(f)
    .connect(envelope(ctx, o.t, o.dur, o.vol, o.attack ?? 0.002))
    .connect(out);
  src.start(o.t, o.offset ?? 0);
  src.stop(o.t + o.dur + 0.01);
}

/** Нота по номеру MIDI (69 = ля первой октавы, 440 Гц). */
export function midi(n: number): number {
  return 440 * 2 ** ((n - 69) / 12);
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** «C5», «F#4», «Bb3» → номер MIDI. */
export function note(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new RangeError(`Нота «${name}»`);
  const [, letter = "C", acc = "", oct = "4"] = m;
  const shift = acc === "#" ? 1 : acc === "b" ? -1 : 0;
  return (NOTE_INDEX[letter] ?? 0) + shift + (Number(oct) + 1) * 12;
}
