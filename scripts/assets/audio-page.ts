/** Страница превью звука: рендерит все эффекты и музыку тем же кодом, что и игра. */
import { MUSIC_SECONDS, renderMusic } from "../../src/engine/audio/music";
import { renderSfx, SFX_NAMES } from "../../src/engine/audio/sfx";

export interface AudioClip {
  readonly name: string;
  readonly sampleRate: number;
  /** Float32 PCM моно, base64. */
  readonly b64: string;
  readonly peak: number;
}

function toB64(buf: AudioBuffer): { b64: string; peak: number } {
  const data = buf.getChannelData(0);
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { b64: btoa(s), peak };
}

async function renderAll(): Promise<AudioClip[]> {
  const clips: AudioClip[] = [];
  for (const name of SFX_NAMES) {
    const buf = await renderSfx(name);
    clips.push({ name, sampleRate: buf.sampleRate, ...toB64(buf) });
  }
  const music = await renderMusic();
  clips.push({ name: `music_${MUSIC_SECONDS.toFixed(1)}s`, sampleRate: music.sampleRate, ...toB64(music) });
  return clips;
}

declare global {
  interface Window {
    __audio?: { renderAll(): Promise<AudioClip[]> };
  }
}

window.__audio = { renderAll };
