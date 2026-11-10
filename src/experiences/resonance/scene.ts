import * as THREE from 'three'
import { clamp, damp, lerp } from '../../lib/math'
import { BANDS, WAVE } from './audio'

export const SECTORS = 10
export const CENTRE = -1
export const MISS = -2
/** Radius of the centre pad, where the disc's radius is 1. */
const PAD = 0.17
const RIPPLES = 12
const TAU = Math.PI * 2
const WEDGE = TAU / SECTORS
const FOV = 34
/** Radius the labels sit at, and the radius the camera keeps in view. */
const LABELS = 1.14
const FIT = 1.25

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform float uCentre;
uniform float uIdle;
uniform float uHover;
uniform float uDist;
uniform sampler2D uSpec;
uniform sampler2D uWave;
uniform vec4 uRip[${RIPPLES}];
uniform vec3 uRipCol[${RIPPLES}];
uniform float uHeld[${SECTORS}];
varying vec3 vCol;

const float TAU = 6.28318530718;
const float WEDGE = TAU / ${SECTORS}.0;
const vec3 ICE = vec3(0.61, 0.91, 1.0);

vec3 pal(float t) {
  return vec3(0.62, 0.62, 0.85) + vec3(0.38, 0.38, 0.2) * cos(TAU * (vec3(1.0, 1.0, 0.5) * t + vec3(0.5, 0.15, 0.0)));
}

// One point of the disc: where it sits and how brightly it burns. ring runs 0 (centre) to 1 (rim).
vec3 shape(float ring, float th, out vec3 p, out float lift) {
  float r = mix(0.035, 1.0, pow(ring, 0.9));
  vec2 xz = vec2(-sin(th), cos(th)) * r;
  float t = uTime;

  float outer = step(${PAD}, r);
  float sf = th / WEDGE;
  float cell = fract(sf);
  float edge = mix(1.0, smoothstep(0.0, 0.07, cell) * smoothstep(1.0, 0.93, cell), outer);
  float held = mix(uCentre, uHeld[int(clamp(floor(sf), 0.0, ${SECTORS - 1}.0))], outer);
  float hov = mix(step(abs(uHover + 1.0), 0.5), step(abs(floor(sf) - uHover), 0.5), outer);

  // Each ring listens to one band of the spectrum, bass at the centre, and stands in a mode of its own.
  float band = texture2D(uSpec, vec2(ring * 0.94 + 0.03, 0.5)).r;
  float amp = band * band;
  float breath = sin(ring * 16.0 - t * 1.1) * (0.6 + 0.4 * sin(th * 2.0 + t * 0.23));
  float h = uMotion * 0.014 * breath;
  float n = 2.0 + floor(ring * 8.0 + 0.5);
  float sgn = mod(n, 2.0) < 0.5 ? 1.0 : -1.0;
  h += amp * 0.2 * sin(n * th + t * 0.5 * sgn) * (0.65 + 0.35 * sin(t * 2.1 + ring * 9.0)) * smoothstep(0.0, 0.12, ring);
  float wv = texture2D(uWave, vec2(abs(fract(th / TAU + 0.5) * 2.0 - 1.0), 0.5)).r - 0.5;
  h += wv * 0.45 * ring * (1.0 - ring * 0.6);

  vec3 rip = vec3(0.0);
  for (int i = 0; i < ${RIPPLES}; i++) {
    vec4 q = uRip[i];
    float age = t - q.z;
    float live = q.w * step(0.0, age);
    float d = distance(xz, q.xy);
    float front = (d - age * 0.62) / 0.075;
    float g = exp(-front * front) * exp(-age * 1.15) * live;
    float hit = exp(-d * d / 0.012) * exp(-age * 6.0) * live;
    h += g * cos(front * 2.6) * 0.085 + hit * 0.07;
    rip += uRipCol[i] * (g * 1.1 + hit * 1.6);
  }
  h += held * edge * 0.012 * sin(t * 21.0 + ring * 46.0);
  p = vec3(xz.x, h, xz.y);

  vec3 col = mix(vec3(0.27, 0.4, 0.95), ICE, clamp(ring * 0.75 + 0.2 + 0.15 * sin(th + t * 0.11), 0.0, 1.0));
  col = mix(col, pal(ring * 0.42 + t * 0.03 + amp * 0.3), clamp(amp * 1.5, 0.0, 0.85));
  // Until the first note, a slow ring of light keeps leaving the centre, to show where the sound will go.
  float call = (r - fract(t * 0.17) * 1.25) / 0.09;
  float lum = 0.36 + uMotion * 0.13 * breath + amp * 1.25 + abs(wv) * 1.6 + uIdle * 0.9 * exp(-call * call) * (1.0 - fract(t * 0.17));
  lum *= mix(1.0, 0.4 + 0.6 * edge, smoothstep(0.84, 1.0, ring));
  lift = amp + held * edge + dot(rip, vec3(0.34));
  return col * lum + vec3(1.0, 0.78, 0.46) * amp * amp * 0.9 + rip + ICE * edge * (held * 0.55 + hov * 0.1);
}

float depthFade(float z) {
  return clamp(1.0 + (z + uDist) * 0.3, 0.4, 1.3);
}
`

const LINE_VERT = /* glsl */ `
${COMMON}
void main() {
  vec3 p;
  float lift;
  vec3 c = shape(position.x, position.y, p, lift);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vCol = c * depthFade(mv.z);
  gl_Position = projectionMatrix * mv;
}
`
const POINT_VERT = /* glsl */ `
uniform float uPx;
${COMMON}
void main() {
  vec3 p;
  float lift;
  vec3 c = shape(position.x, position.y, p, lift);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 0.5 + 0.5 * sin(uTime * (0.8 + position.z * 2.4) + position.z * 61.0);
  vCol = c * (0.7 + 1.3 * tw) * depthFade(mv.z);
  gl_PointSize = uPx * (1.8 + tw * 1.6 + 10.0 * min(lift, 1.2)) * uDist / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
const LINE_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, 1.0);
}
`
const POINT_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  float a = max(0.0, 1.0 - length(gl_PointCoord - 0.5) * 2.0);
  gl_FragColor = vec4(vCol * a * a, 1.0);
}
`
const HALO_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const HALO_FRAG = /* glsl */ `
uniform float uEnergy;
uniform float uCentre;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 5.0;
  float a = exp(-d * d * 1.5) * (0.07 + uEnergy * 0.55) + exp(-d * d * 34.0) * (0.05 + uCentre * 0.35);
  vec3 c = mix(vec3(0.2, 0.24, 0.9), vec3(0.61, 0.91, 1.0), exp(-d * d * 4.0)) * a;
  // A little noise keeps the dark falloff from banding.
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}
`

export interface Pick {
  sector: number
  r: number
  x: number
  z: number
}

/** Colour of a note, from the same palette the shader uses. */
function tint(sector: number, out: THREE.Vector3) {
  const t = sector < 0 ? 0.93 : (sector / SECTORS) * 0.8
  const c = (k: number, d: number) => Math.cos(TAU * (k * t + d))
  return out.set(0.62 + 0.38 * c(1, 0.5), 0.62 + 0.38 * c(1, 0.15), 0.85 + 0.2 * c(0.5, 0))
}

export class DiscScene {
  /** Sector under the mouse, CENTRE, or MISS. */
  hover = MISS
  /** Sector the microphone is singing, or MISS. */
  sing = MISS
  /** 1 for full motion, lower when the visitor asks for less. */
  motion = 1
  /** Set once the instrument has been played; the idle invitation fades out. */
  awake = false
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50)
  private uniforms: Record<string, THREE.IUniform>
  private spec: THREE.DataTexture
  private wave: THREE.DataTexture
  private held = new Float32Array(SECTORS + 1)
  private holds = new Int16Array(SECTORS + 1)
  private slot = 0
  private time = 0
  private energy = 0
  private dist = 5
  private elevation = 0.7
  private look = { x: 0, y: 0, tx: 0, ty: 0 }
  private size = { w: 1, h: 1 }
  private ray = new THREE.Raycaster()
  private v2 = new THREE.Vector2()
  private v3 = new THREE.Vector3()
  private disposed = false

  constructor(canvas: HTMLCanvasElement, opts: { coarse: boolean }) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.coarse, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x050507, 1)
    this.renderer = renderer

    const tex = (n: number, fill: number) => {
      const t = new THREE.DataTexture(new Uint8Array(n).fill(fill), n, 1, THREE.RedFormat, THREE.UnsignedByteType)
      t.minFilter = t.magFilter = THREE.LinearFilter
      t.needsUpdate = true
      return t
    }
    this.spec = tex(BANDS, 0)
    this.wave = tex(WAVE, 128)
    this.uniforms = {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uCentre: { value: 0 },
      uIdle: { value: 1 },
      uHover: { value: MISS },
      uDist: { value: 5 },
      uEnergy: { value: 0 },
      uPx: { value: renderer.getPixelRatio() },
      uSpec: { value: this.spec },
      uWave: { value: this.wave },
      uRip: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uRipCol: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector3()) },
      uHeld: { value: new Float32Array(SECTORS) },
    }
    const material = (vertexShader: string, fragmentShader: string) =>
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader,
        fragmentShader,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })

    // The disc: concentric rings, each a closed loop of short segments. position carries (ring, angle, seed).
    const rings = opts.coarse ? 64 : 92
    const segs = opts.coarse ? 180 : 256
    const pos = new Float32Array(rings * segs * 3)
    const index = new Uint32Array(rings * segs * 2)
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const i = r * segs + s
        pos[i * 3] = r / (rings - 1)
        pos[i * 3 + 1] = (s / segs) * TAU
        index[i * 2] = i
        index[i * 2 + 1] = r * segs + ((s + 1) % segs)
      }
    }
    const lines = new THREE.BufferGeometry()
    lines.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    lines.setIndex(new THREE.BufferAttribute(index, 1))
    const disc = new THREE.LineSegments(lines, material(LINE_VERT, LINE_FRAG))

    const count = opts.coarse ? 1500 : 2800
    const dust = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      dust[i * 3] = Math.round(Math.random() ** 0.8 * (rings - 1)) / (rings - 1)
      dust[i * 3 + 1] = Math.random() * TAU
      dust[i * 3 + 2] = Math.random()
    }
    const motes = new THREE.BufferGeometry()
    motes.setAttribute('position', new THREE.BufferAttribute(dust, 3))
    const sparks = new THREE.Points(motes, material(POINT_VERT, POINT_FRAG))

    const halo = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), material(HALO_VERT, HALO_FRAG))
    halo.position.y = -0.04

    // The rim, the pad's edge, and a tick where each sector meets the next.
    const rim: number[] = []
    const circle = (radius: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU
        const b = ((i + 1) / n) * TAU
        rim.push(Math.sin(a) * radius, 0, Math.cos(a) * radius, Math.sin(b) * radius, 0, Math.cos(b) * radius)
      }
    }
    circle(1.045, 200)
    circle(PAD, 72)
    for (let i = 0; i < SECTORS; i++) {
      const a = i * WEDGE
      rim.push(-Math.sin(a) * 1.045, 0, Math.cos(a) * 1.045, -Math.sin(a) * 1.09, 0, Math.cos(a) * 1.09)
    }
    const frame = new THREE.BufferGeometry()
    frame.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3))
    const marks = new THREE.LineSegments(
      frame,
      new THREE.LineBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthTest: false }),
    )

    for (const o of [halo, disc, sparks, marks]) {
      o.frustumCulled = false
      this.scene.add(o)
    }
  }

  /** Fits the disc into the part of the canvas the interface leaves free. */
  resize(w: number, h: number, pad: { t: number; b: number; l: number; r: number }) {
    if (this.disposed || w < 2 || h < 2) return
    this.size = { w, h }
    this.renderer.setSize(w, h, false)
    const aw = Math.max(80, w - pad.l - pad.r)
    const ah = Math.max(80, h - pad.t - pad.b)
    // Wide rooms see the disc at a slant; a tall phone looks almost straight down so every note stays in reach.
    this.elevation = lerp(1.15, 0.66, clamp((aw / ah - 0.7) / 0.9))
    // Find the closest camera from which the disc and its ring of labels still fit, then centre what it sees.
    const scale = h / 2 / Math.tan((FOV * Math.PI) / 360)
    const sin = Math.sin(this.elevation)
    const cos = Math.cos(this.elevation)
    const extent = (dist: number) => {
      let up = 0
      let down = 0
      let half = 0
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU
        const x = Math.sin(a) * FIT
        const z = Math.cos(a) * FIT
        const k = scale / (dist - z * cos)
        up = Math.max(up, -z * sin * k)
        down = Math.max(down, z * sin * k)
        half = Math.max(half, Math.abs(x) * k)
      }
      return { up, down, half }
    }
    let near = FIT + 0.5
    let far = 40
    for (let i = 0; i < 26; i++) {
      const mid = (near + far) / 2
      const e = extent(mid)
      if (e.half * 2 <= aw && e.up + e.down <= ah) far = mid
      else near = mid
    }
    this.dist = far
    const e = extent(far)
    this.uniforms.uDist.value = this.dist
    this.camera.aspect = w / h
    this.camera.setViewOffset(w, h, w / 2 - (pad.l + aw / 2), h / 2 - (pad.t + e.up + (ah - e.up - e.down) / 2), w, h)
    this.place()
  }

  private place() {
    const el = this.elevation + this.look.y * 0.05
    const az = this.look.x * 0.09
    this.camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(this.dist)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
  }

  /** Pointer position across the stage, -1 to 1, for a slight lean of the camera. */
  lean(x: number, y: number) {
    this.look.tx = x
    this.look.ty = y
  }

  /** A sector is lit while anything holds it: a finger, a key, a looped note. */
  hold(sector: number, on: boolean) {
    const i = sector < 0 ? SECTORS : sector
    this.holds[i] = Math.max(0, this.holds[i] + (on ? 1 : -1))
  }

  ripple(x: number, z: number, strength: number, sector: number) {
    const i = this.slot++ % RIPPLES
    this.uniforms.uRip.value[i].set(x, z, this.time, strength)
    tint(sector, this.uniforms.uRipCol.value[i])
  }

  /** A point inside a sector, at a given radius. */
  point(sector: number, r: number): [number, number] {
    if (sector < 0) return [0, 0]
    const a = (sector + 0.5) * WEDGE
    return [-Math.sin(a) * r, Math.cos(a) * r]
  }

  /** What lies under a stage position, in CSS pixels. */
  pick(px: number, py: number): Pick {
    const { w, h } = this.size
    this.ray.setFromCamera(this.v2.set((px / w) * 2 - 1, 1 - (py / h) * 2), this.camera)
    const { origin, direction } = this.ray.ray
    if (direction.y >= 0) return { sector: MISS, r: 9, x: 0, z: 0 }
    const k = -origin.y / direction.y
    const x = origin.x + direction.x * k
    const z = origin.z + direction.z * k
    const r = Math.hypot(x, z)
    let a = Math.atan2(-x, z)
    if (a < 0) a += TAU
    const sector = r > 1.1 ? MISS : r < PAD ? CENTRE : Math.min(SECTORS - 1, Math.floor(a / WEDGE))
    return { sector, r, x, z }
  }

  /** Where a sector's label belongs, in CSS pixels. */
  label(sector: number, out: { x: number; y: number }) {
    const a = (sector + 0.5) * WEDGE
    const v = this.v3.set(-Math.sin(a) * LABELS, 0, Math.cos(a) * LABELS).project(this.camera)
    out.x = (v.x * 0.5 + 0.5) * this.size.w
    out.y = (0.5 - v.y * 0.5) * this.size.h
  }

  frame(dt: number, bands: Uint8Array, wave: Uint8Array, level: number) {
    if (this.disposed) return
    const u = this.uniforms
    this.time += dt
    u.uTime.value = this.time
    u.uMotion.value = this.motion
    u.uHover.value = this.hover
    u.uIdle.value = damp(u.uIdle.value, this.awake ? 0 : 1, 2, dt)
    this.energy = damp(this.energy, level, level > this.energy ? 14 : 3, dt)
    u.uEnergy.value = this.energy

    for (let i = 0; i <= SECTORS; i++) {
      const on = this.holds[i] > 0 ? 1 : this.sing === (i === SECTORS ? CENTRE : i) ? 0.6 : 0
      this.held[i] = damp(this.held[i], on, on > this.held[i] ? 30 : 5, dt)
      if (i < SECTORS) u.uHeld.value[i] = this.held[i]
    }
    u.uCentre.value = this.held[SECTORS]

    // Bands rise at once and fall slowly, so a struck note lingers on the disc as it does in the ear.
    const spec = this.spec.image.data as Uint8Array
    const fall = dt * 150
    for (let i = 0; i < BANDS; i++) spec[i] = Math.max(bands[i], spec[i] - fall)
    this.spec.needsUpdate = true
    ;(this.wave.image.data as Uint8Array).set(wave)
    this.wave.needsUpdate = true

    const k = this.look
    if (Math.abs(k.tx - k.x) + Math.abs(k.ty - k.y) > 1e-4) {
      k.x = damp(k.x, k.tx, 3, dt)
      k.y = damp(k.y, k.ty, 3, dt)
      this.place()
    }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      ;(m.material as THREE.Material | undefined)?.dispose()
    })
    this.spec.dispose()
    this.wave.dispose()
    this.renderer.dispose()
  }
}
