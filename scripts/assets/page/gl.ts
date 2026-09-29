/**
 * Рендер спрайта в палитровое изображение в два прохода:
 *  1) ID-проход: каждый пиксель получает код материала (рампа, сдвиг, фиксированный оттенок);
 *  2) проход освещения: плоская нормаль грани · направление света → яркость.
 * Потом каждый пиксель красится оттенком СВОЕЙ рампы по яркости с дизерингом Байера.
 */
import * as THREE from "three";
import { OUTLINE_INDEX, paletteIndex, RAMP_NAMES } from "../../../src/data/palette";
import { addOutline, createImage, type IndexedImage } from "../lib/raster";
import { shadeLevel } from "../lib/shade";
import { isOccluder, markOccluder, type MatSpec, specOf } from "./kit";

THREE.ColorManagement.enabled = false;

/** Камера: взгляд сверху под углом и чуть сбоку — «3/4», как в играх начала 2000-х. */
export const CAMERA_PITCH = (32 * Math.PI) / 180;
export const CAMERA_YAW = (20 * Math.PI) / 180;
const LIGHT_DIR = new THREE.Vector3(-0.55, 0.9, 0.65).normalize();
const AMBIENT = 0.42;
const DIFFUSE = 0.85;

const VS = /* glsl */ `
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const ID_FS = /* glsl */ `
uniform vec3 uId;
void main() { gl_FragColor = vec4(uId, 1.0); }`;

const LIGHT_FS = /* glsl */ `
uniform vec3 uLightDir;
varying vec3 vView;
void main() {
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  float d = max(dot(n, uLightDir), 0.0);
  float i = ${AMBIENT.toFixed(3)} + ${DIFFUSE.toFixed(3)} * d;
  gl_FragColor = vec4(clamp(i / 2.0, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

export interface FrameSpec {
  /** Размер кадра в пикселях до обрезки. */
  readonly w: number;
  readonly h: number;
  /** Пикселей на единицу мира. */
  readonly ppu: number;
  /** Куда в кадре проецируется начало координат мира (якорь спрайта). */
  readonly ax: number;
  readonly ay: number;
  /** Поворот камеры вокруг вертикали (по умолчанию общий для всей игры). */
  readonly yaw?: number;
  readonly pitch?: number;
}

export class SpriteRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly idMaterials = new Map<string, THREE.ShaderMaterial>();
  private readonly lightMaterial: THREE.ShaderMaterial;
  private readonly occluderMaterial: THREE.MeshBasicMaterial;

  constructor() {
    const canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.lightMaterial = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: LIGHT_FS,
      uniforms: { uLightDir: { value: new THREE.Vector3() } },
      side: THREE.DoubleSide,
    });
    this.occluderMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  }

  private idMaterial(spec: MatSpec): THREE.ShaderMaterial {
    const key = `${spec.ramp}|${spec.bias ?? 0}|${spec.fixedShade ?? -1}`;
    let m = this.idMaterials.get(key);
    if (!m) {
      const ramp = RAMP_NAMES.indexOf(spec.ramp) + 1;
      const bias = Math.round(((spec.bias ?? 0) + 2) * 50);
      const fixed = spec.fixedShade === undefined ? 0 : spec.fixedShade + 1;
      m = new THREE.ShaderMaterial({
        vertexShader: VS,
        fragmentShader: ID_FS,
        uniforms: { uId: { value: new THREE.Vector3(ramp / 255, bias / 255, fixed / 255) } },
        side: THREE.DoubleSide,
      });
      this.idMaterials.set(key, m);
    }
    return m;
  }

  private camera(f: FrameSpec): THREE.OrthographicCamera {
    const cam = new THREE.OrthographicCamera(
      -f.ax / f.ppu,
      (f.w - f.ax) / f.ppu,
      f.ay / f.ppu,
      -(f.h - f.ay) / f.ppu,
      0.1,
      100,
    );
    const yaw = f.yaw ?? CAMERA_YAW;
    const pitch = f.pitch ?? CAMERA_PITCH;
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * 20, Math.sin(pitch) * 20, Math.cos(yaw) * Math.cos(pitch) * 20);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    return cam;
  }

  private pass(scene: THREE.Scene, cam: THREE.Camera, rt: THREE.WebGLRenderTarget, mode: "id" | "light"): Uint8Array {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (isOccluder(o)) {
        o.material = this.occluderMaterial;
        return;
      }
      const spec = specOf(o);
      if (!spec) throw new Error("Меш без материала-рампы");
      o.material = mode === "id" ? this.idMaterial(spec) : this.lightMaterial;
    });
    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(scene, cam);
    const buf = new Uint8Array(rt.width * rt.height * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
    return buf;
  }

  /** Рендерит модель в палитровый кадр с обводкой. Кадр не должен упираться в края. */
  render(name: string, model: THREE.Object3D, f: FrameSpec, occluder?: THREE.Object3D): IndexedImage {
    const scene = new THREE.Scene();
    scene.add(model);
    if (occluder) scene.add(markOccluder(occluder));
    const cam = this.camera(f);
    const lightView = LIGHT_DIR.clone().transformDirection(cam.matrixWorldInverse);
    const uLight = this.lightMaterial.uniforms["uLightDir"];
    if (uLight) uLight.value = lightView;

    const rt = new THREE.WebGLRenderTarget(f.w, f.h, { depthBuffer: true });
    const ids = this.pass(scene, cam, rt, "id");
    const light = this.pass(scene, cam, rt, "light");
    rt.dispose();
    scene.remove(model);
    if (occluder) scene.remove(occluder);

    const img = createImage(f.w, f.h);
    for (let y = 0; y < f.h; y++) {
      const srcRow = (f.h - 1 - y) * f.w; // WebGL читает снизу вверх
      for (let x = 0; x < f.w; x++) {
        const s = (srcRow + x) * 4;
        const ramp = ids[s] ?? 0;
        if ((ids[s + 3] ?? 0) === 0 || ramp === 0) continue;
        const rampName = RAMP_NAMES[ramp - 1];
        if (!rampName) throw new Error(`Неизвестная рампа ${ramp}`);
        const bias = (ids[s + 1] ?? 100) / 50 - 2;
        const fixed = ids[s + 2] ?? 0;
        const intensity = ((light[s] ?? 0) / 255) * 2;
        const shade = fixed > 0 ? fixed - 1 : shadeLevel(intensity, x, y, bias);
        img.data[y * f.w + x] = paletteIndex(rampName, shade);
      }
    }
    const outlined = addOutline(img, OUTLINE_INDEX);
    assertInside(name, outlined);
    return outlined;
  }
}

function assertInside(name: string, img: IndexedImage): void {
  for (let x = 0; x < img.w; x++) {
    if (img.data[x] !== 0 || img.data[(img.h - 1) * img.w + x] !== 0) throw new Error(`Спрайт «${name}» обрезан по вертикали`);
  }
  for (let y = 0; y < img.h; y++) {
    if (img.data[y * img.w] !== 0 || img.data[y * img.w + img.w - 1] !== 0) {
      throw new Error(`Спрайт «${name}» обрезан по горизонтали`);
    }
  }
}
