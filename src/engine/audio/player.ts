/**
 * Проигрывание звука. Буферы эффектов рендерятся сразу при старте (OfflineAudioContext
 * не требует жеста пользователя), а живой AudioContext создаётся на первом касании —
 * так требуют браузеры. Нет WebAudio — игра просто молчит, но работает.
 */
import { renderMusic } from "./music";
import { renderSfx, SFX_NAMES, type SfxName } from "./sfx";

const MUSIC_VOLUME = 0.35;
const SFX_VOLUME = 0.9;
/** Минимальный интервал между одинаковыми звуками: серия выплат не должна сливаться в гул. */
const MIN_GAP_MS: Partial<Record<SfxName, number>> = { kukish: 90, tap: 40, click: 40 };

export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private readonly buffers = new Map<SfxName, AudioBuffer>();
  private musicBuffer: AudioBuffer | null = null;
  private musicStarted = false;
  private readonly lastPlayed = new Map<SfxName, number>();
  private muted = false;
  private paused = false;

  /** Рендер буферов в фоне; игра не ждёт окончания. */
  prepare(): void {
    if (typeof OfflineAudioContext === "undefined") return;
    void (async () => {
      try {
        for (const name of SFX_NAMES) this.buffers.set(name, await renderSfx(name));
        this.musicBuffer = await renderMusic();
        this.tryStartMusic();
      } catch (e) {
        console.warn("Звук недоступен:", e);
      }
    })();
  }

  /** Вызывать из обработчика жеста пользователя (первый тап). */
  unlock(): void {
    try {
      if (!this.ctx) {
        if (typeof AudioContext === "undefined") return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus.gain.value = SFX_VOLUME;
        this.musicBus.gain.value = MUSIC_VOLUME;
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.applyMute();
      }
      if (this.ctx.state === "suspended" && !this.paused) void this.ctx.resume();
      this.tryStartMusic();
    } catch (e) {
      console.warn("Звук недоступен:", e);
    }
  }

  private tryStartMusic(): void {
    if (this.musicStarted || !this.ctx || !this.musicBuffer || !this.musicBus) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    src.connect(this.musicBus);
    src.start();
    this.musicStarted = true;
  }

  play(name: SfxName, rate = 1, volume = 1): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(name);
    if (!ctx || !buf || !this.sfxBus || this.muted || this.paused || ctx.state !== "running")
      return;
    const now = performance.now();
    const gap = MIN_GAP_MS[name];
    if (gap !== undefined && now - (this.lastPlayed.get(name) ?? -1e9) < gap) return;
    this.lastPlayed.set(name, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    if (volume === 1) {
      src.connect(this.sfxBus);
    } else {
      const g = ctx.createGain();
      g.gain.value = volume;
      src.connect(g).connect(this.sfxBus);
    }
    src.start();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMute();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private applyMute(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  /** Пауза для рекламы и скрытой вкладки: контекст полностью останавливается. */
  setPaused(p: boolean): void {
    this.paused = p;
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else void this.ctx.resume();
  }
}
