import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { clamp, damp, lerp } from '../../../lib/math'
import { GRID } from '../nn/protocol'
import { MAX_SAMPLES } from '../nn/datasets'

/** World height of a fully confident "defect" prediction. The plane spans [-1, 1] in x and z. */
const HEIGHT = 0.62
const EMBERS = 140

const terrainVert = /* glsl */ `
  attribute float aP;
  attribute vec2 aG;
  uniform float uH;
  varying float vP;
  varying vec2 vG;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vP = aP;
    vG = aG;
    vUv = uv;
    vec3 p = vec3(position.x, aP * uH, position.z);
    vN = normalize(vec3(-aG.x * uH, 1.0, aG.y * uH));
    vW = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`

const terrainFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCam;
  varying float vP;
  varying vec2 vG;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 heat(float t) {
    vec3 c = mix(vec3(0.07, 0.012, 0.006), vec3(0.62, 0.07, 0.012), smoothstep(0.0, 0.34, t));
    c = mix(c, vec3(1.0, 0.36, 0.07), smoothstep(0.26, 0.62, t));
    c = mix(c, vec3(1.0, 0.78, 0.42), smoothstep(0.58, 0.88, t));
    return mix(c, vec3(1.0, 0.97, 0.9), smoothstep(0.86, 1.0, t));
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(uCam - vW);
    vec3 L = normalize(vec3(0.45, 0.8, 0.35));
    vec3 Hh = normalize(L + V);

    // Cold side: brushed, blued steel.
    float brush = noise(vec2(vW.x * 260.0, vW.z * 7.0)) * 0.6 + noise(vec2(vW.x * 90.0, vW.z * 3.0)) * 0.4;
    vec3 steel = mix(vec3(0.078, 0.088, 0.108), vec3(0.17, 0.19, 0.225), brush);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, Hh), 0.0), 42.0) * (0.35 + 0.65 * brush);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 cold = steel * (0.5 + 0.9 * diff) + vec3(0.36, 0.44, 0.58) * (spec * 0.55 + fres * 0.18);

    // Hot side: a cooling crust over metal that is still moving, white-hot only near the seam.
    float flow = noise(vW.xz * 5.0 + vec2(uTime * 0.11, -uTime * 0.07)) * 0.6 + noise(vW.xz * 13.0 - uTime * 0.16) * 0.4;
    float hot = smoothstep(0.5, 1.0, vP);
    float veins = pow(flow, 2.5);
    float nearSeam = 1.0 - smoothstep(0.0, 0.42, abs(vP - 0.5));
    vec3 molten = heat(clamp(0.2 + 0.2 * hot + veins * 0.42 + nearSeam * 0.3, 0.0, 1.0));
    molten *= mix(0.5, 1.05, smoothstep(0.25, 0.62, flow));
    molten += vec3(1.0, 0.62, 0.34) * spec * 0.22;

    vec3 col = mix(cold, molten, smoothstep(0.47, 0.6, vP));

    // Iso-lines every 0.1 of probability, constant width on screen.
    float lv = vP * 10.0;
    float iso = 1.0 - clamp(abs(fract(lv - 0.5) - 0.5) / max(fwidth(lv), 1e-5) - 0.2, 0.0, 1.0);
    col = mix(col, mix(vec3(0.3, 0.34, 0.4), vec3(0.16, 0.03, 0.0), step(0.5, vP)), iso * 0.34);

    // Feature-plane graticule on the cold side.
    vec2 gq = vUv * 10.0;
    vec2 gl = abs(fract(gq - 0.5) - 0.5) / max(fwidth(gq), vec2(1e-5));
    float grid = 1.0 - clamp(min(gl.x, gl.y), 0.0, 1.0);
    col += vec3(0.46, 0.52, 0.62) * grid * 0.1 * (1.0 - smoothstep(0.4, 0.55, vP));

    // The seam: p = 0.5, where the model changes its mind.
    float slope = length(vG);
    float ds = abs(vP - 0.5) / max(fwidth(vP), 1e-5);
    float decided = smoothstep(0.04, 0.5, slope);
    float core = exp(-ds * ds * 0.22);
    float halo = exp(-ds * 0.16) * 0.42;
    col += vec3(1.0, 0.74, 0.38) * (core * 1.7 + halo) * decided;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const pointVert = /* glsl */ `
  attribute float aClass;
  attribute float aWrong;
  uniform float uScale;
  uniform float uSize;
  varying float vClass;
  varying float vWrong;
  void main() {
    vClass = aClass;
    vWrong = aWrong;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uScale * (1.0 + aWrong * 0.9) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const pointFrag = /* glsl */ `
  uniform float uTime;
  varying float vClass;
  varying float vWrong;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float s = 1.0 + vWrong * 0.9;
    float r = length(q) * s;
    float aa = fwidth(r) * 1.2;
    // Defect: solid ember. Sound: open ring. Shape, not just colour, carries the class.
    float disc = 1.0 - smoothstep(0.62 - aa, 0.62, r);
    float ring = smoothstep(0.42 - aa, 0.42, r) * (1.0 - smoothstep(0.66 - aa, 0.66, r));
    float shape = mix(ring, disc, vClass);
    vec3 col = mix(vec3(0.80, 0.88, 1.0), mix(vec3(1.0, 0.92, 0.78), vec3(1.0, 0.45, 0.1), smoothstep(0.1, 0.6, r)), vClass);
    float edge = (1.0 - smoothstep(0.72 - aa, 0.72, r)) - shape;
    vec4 outc = vec4(col * 1.25, shape) + vec4(0.02, 0.02, 0.03, max(edge, 0.0) * 0.55 * vClass);
    // Misclassified: a pulsing outer bracket.
    float pulse = 0.55 + 0.45 * sin(uTime * 6.0);
    float halo = smoothstep(1.5 - aa, 1.5, r) * (1.0 - smoothstep(1.78 - aa, 1.78, r)) * vWrong;
    outc = mix(outc, vec4(1.0, 1.0, 1.0, 1.0), halo * pulse);
    outc.a = max(outc.a, halo * pulse);
    if (outc.a < 0.02) discard;
    gl_FragColor = outc;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const emberVert = /* glsl */ `
  attribute float aLife;
  uniform float uScale;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uScale * 13.0 * (0.4 + aLife * 0.6) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const emberFrag = /* glsl */ `
  varying float vLife;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * vLife;
    gl_FragColor = vec4(mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.85, 0.6), vLife) * a * 1.8, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export type Mode = 'orbit' | 'paint'
export interface PaintEvent {
  x: number
  y: number
  phase: 'start' | 'move' | 'end'
}

export class TerrainScene {
  onPaint: (e: PaintEvent) => void = () => {}
  onInteract: () => void = () => {}

  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40)
  private terrain: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  private points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private embers: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private brush: THREE.Mesh

  private target: Float32Array = new Float32Array(GRID * GRID).fill(0.5)
  private shown = new Float32Array(GRID * GRID).fill(0.5)
  private aP: THREE.BufferAttribute
  private aG: THREE.BufferAttribute

  private n = 0
  private xs: Float32Array = new Float32Array(0)
  private ys: Uint8Array = new Uint8Array(0)
  private probs = new Float32Array(MAX_SAMPLES).fill(0.5)
  private ptPos: THREE.BufferAttribute
  private ptClass: THREE.BufferAttribute
  private ptWrong: THREE.BufferAttribute

  private emPos: THREE.BufferAttribute
  private emLife: THREE.BufferAttribute
  private emVel = new Float32Array(EMBERS * 3)
  private emNext = 0

  // Camera rig (spherical around a target), with damped goals.
  private theta = 0.7
  private phi = 1.02
  private radius = 4.4
  private gTheta = 0.7
  private gPhi = 1.02
  private gRadius = 4.4
  private fit = 4.4
  private top = false
  private mode: Mode = 'orbit'
  private idle = 0
  private pointers = new Map<number, { x: number; y: number }>()
  private pinch = 0
  private pinchAngle = 0
  private painting = false
  private frameAvg = 16
  private frames = 0
  /** 0: bloom composer. 1: direct render. Rises (and resolution falls) if frames are slow. */
  private tier = 0
  private bgDirect: THREE.Color
  private bgComposer: THREE.Color
  private pinned = false
  private quality = 1
  private size: [number, number, number, number] = [1, 1, 1, 1]
  private ray = new THREE.Raycaster()
  private disposed = false

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: { reduced: boolean; coarse: boolean; bg: string; bgComposer: string },
  ) {
    const q = new URLSearchParams(location.search)
    // ?gl=0|1 pins the render tier (used for captures on software GL); otherwise it adapts.
    if (q.has('gl')) {
      this.tier = Number(q.get('gl')) || 0
      this.pinned = true
    }
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.coarse && q.get('aa') !== '0', powerPreference: 'high-performance' })
    this.renderer = renderer
    // The composer tone-maps the whole frame, background included, so that tier needs a
    // pre-compensated colour to land on the page background.
    this.bgDirect = new THREE.Color(opts.bg)
    this.bgComposer = new THREE.Color(opts.bgComposer)
    this.scene.background = this.bgDirect
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05

    // --- terrain ---
    const geo = new THREE.PlaneGeometry(2, 2, GRID - 1, GRID - 1)
    geo.rotateX(-Math.PI / 2) // row 0 lands at z = -1; flipped below so row 0 is x2 = -1 (near the viewer)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const k = j * GRID + i
        pos.setXYZ(k, -1 + (2 * i) / (GRID - 1), 0, 1 - (2 * j) / (GRID - 1))
      }
    }
    this.aP = new THREE.BufferAttribute(new Float32Array(GRID * GRID).fill(0.5), 1).setUsage(THREE.DynamicDrawUsage)
    this.aG = new THREE.BufferAttribute(new Float32Array(GRID * GRID * 2), 2).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aP', this.aP)
    geo.setAttribute('aG', this.aG)
    geo.setIndex(this.gridIndex())
    this.terrain = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: terrainVert,
        fragmentShader: terrainFrag,
        side: THREE.DoubleSide,
        uniforms: {
          uH: { value: HEIGHT },
          uTime: { value: 0 },
          uCam: { value: new THREE.Vector3() },
        },
      }),
    )
    this.terrain.frustumCulled = false
    this.scene.add(this.terrain)

    // --- bed plate and frame ---
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.05, 2.3),
      new THREE.MeshBasicMaterial({ color: 0x15171b }),
    )
    plate.position.y = -0.031
    this.scene.add(plate)
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.3, 0.05, 2.3)),
      new THREE.LineBasicMaterial({ color: 0x3a4048 }),
    )
    frame.position.y = -0.031
    this.scene.add(frame)
    this.scene.add(this.ticks())

    // --- samples ---
    const pg = new THREE.BufferGeometry()
    this.ptPos = new THREE.BufferAttribute(new Float32Array(MAX_SAMPLES * 3), 3).setUsage(THREE.DynamicDrawUsage)
    this.ptClass = new THREE.BufferAttribute(new Float32Array(MAX_SAMPLES), 1)
    this.ptWrong = new THREE.BufferAttribute(new Float32Array(MAX_SAMPLES), 1).setUsage(THREE.DynamicDrawUsage)
    pg.setAttribute('position', this.ptPos)
    pg.setAttribute('aClass', this.ptClass)
    pg.setAttribute('aWrong', this.ptWrong)
    pg.setDrawRange(0, 0)
    this.points = new THREE.Points(
      pg,
      new THREE.ShaderMaterial({
        vertexShader: pointVert,
        fragmentShader: pointFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { uScale: { value: 1 }, uSize: { value: opts.coarse ? 0.062 : 0.05 }, uTime: { value: 0 } },
      }),
    )
    this.points.frustumCulled = false
    this.scene.add(this.points)

    // --- embers ---
    const eg = new THREE.BufferGeometry()
    this.emPos = new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3).setUsage(THREE.DynamicDrawUsage)
    this.emLife = new THREE.BufferAttribute(new Float32Array(EMBERS), 1).setUsage(THREE.DynamicDrawUsage)
    eg.setAttribute('position', this.emPos)
    eg.setAttribute('aLife', this.emLife)
    this.embers = new THREE.Points(
      eg,
      new THREE.ShaderMaterial({
        vertexShader: emberVert,
        fragmentShader: emberFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uScale: { value: 1 } },
      }),
    )
    this.embers.frustumCulled = false
    this.embers.visible = !opts.reduced
    this.scene.add(this.embers)

    // --- paint brush reticle ---
    this.brush = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.064, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }),
    )
    this.brush.rotation.x = -Math.PI / 2
    this.brush.visible = false
    this.brush.renderOrder = 10
    this.scene.add(this.brush)

    // --- post ---
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), opts.coarse ? 0.4 : 0.5, 0.5, 0.86)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onUp)
    canvas.addEventListener('pointerleave', this.onLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private gridIndex() {
    const idx = new Uint32Array((GRID - 1) * (GRID - 1) * 6)
    let k = 0
    for (let j = 0; j < GRID - 1; j++) {
      for (let i = 0; i < GRID - 1; i++) {
        const a = j * GRID + i
        const b = a + 1
        const c = a + GRID
        const d = c + 1
        idx[k++] = a
        idx[k++] = b
        idx[k++] = c
        idx[k++] = b
        idx[k++] = d
        idx[k++] = c
      }
    }
    return new THREE.BufferAttribute(idx, 1)
  }

  /** Engraved tick marks around the bed, every 0.1 feature units. */
  private ticks() {
    const v: number[] = []
    for (let i = 0; i <= 20; i++) {
      const t = -1 + i * 0.1
      const len = i % 5 === 0 ? 0.075 : 0.035
      v.push(t, 0, 1.03, t, 0, 1.03 + len, t, 0, -1.03, t, 0, -1.03 - len)
      v.push(1.03, 0, t, 1.03 + len, 0, t, -1.03, 0, t, -1.03 - len, 0, t)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6a717c }))
  }

  // ---------- data in ----------

  setGrid(grid: Float32Array) {
    this.target = grid
  }

  setSamples(xs: Float32Array, ys: Uint8Array, n: number) {
    this.xs = xs
    this.ys = ys
    // New points start at the surface height where they land rather than popping up from zero.
    for (let i = this.n; i < n; i++) this.probs[i] = this.sample(xs[2 * i], xs[2 * i + 1])
    this.n = n
    const cls = this.ptClass.array as Float32Array
    for (let i = 0; i < n; i++) cls[i] = ys[i]
    this.ptClass.needsUpdate = true
    this.points.geometry.setDrawRange(0, n)
  }

  private latest: Float32Array | null = null
  setProbs(probs: Float32Array) {
    this.latest = probs
  }

  setTop(top: boolean) {
    this.top = top
    this.gPhi = top ? 0.0015 : 1.02
    if (top) this.gTheta = Math.round(this.gTheta / (Math.PI * 2)) * Math.PI * 2
    this.gRadius = this.fit * (top ? 1.04 : 1)
    this.idle = 0
  }

  setMode(mode: Mode) {
    this.mode = mode
    this.brush.visible = false
    this.canvas.style.cursor = mode === 'paint' ? 'crosshair' : 'grab'
  }

  setBrushColor(hex: number) {
    ;(this.brush.material as THREE.MeshBasicMaterial).color.setHex(hex)
  }

  /** `usable` is the aspect ratio of the part of the canvas not covered by panels. */
  resize(width: number, height: number, dpr: number, usable = width / height) {
    if (width < 2 || height < 2) return
    this.size = [width, height, dpr, usable]
    dpr *= this.quality
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(width, height)
    this.bloom.resolution.set(width / 2, height / 2)
    const aspect = width / height
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    // Keep the whole bed in frame: portrait phones pull the camera back.
    const prev = this.fit
    this.fit = usable >= 1.35 ? 4.4 : clamp(4.4 * (1.35 / usable) * 0.86, 4.4, 9)
    this.gRadius *= this.fit / prev
    this.radius *= this.fit / prev
    const s = (height * dpr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360))
    this.points.material.uniforms.uScale.value = s
    this.embers.material.uniforms.uScale.value = s * 0.01
  }

  // ---------- sampling ----------

  /** Bilinear lookup of the displayed probability at a feature-plane position. */
  private sample(x: number, y: number) {
    const fx = clamp((x + 1) * 0.5, 0, 1) * (GRID - 1)
    const fy = clamp((y + 1) * 0.5, 0, 1) * (GRID - 1)
    const i = Math.min(GRID - 2, Math.floor(fx))
    const j = Math.min(GRID - 2, Math.floor(fy))
    const tx = fx - i
    const ty = fy - j
    const s = this.shown
    const k = j * GRID + i
    return lerp(lerp(s[k], s[k + 1], tx), lerp(s[k + GRID], s[k + GRID + 1], tx), ty)
  }

  private ndc = new THREE.Vector2()
  /** Screen position → feature-plane coordinates, following the surface height. */
  private pick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    const { origin, direction } = this.ray.ray
    if (Math.abs(direction.y) < 1e-4) return null
    let h = HEIGHT * 0.3
    let x = 0
    let z = 0
    for (let k = 0; k < 4; k++) {
      const t = (h - origin.y) / direction.y
      if (t < 0) return null
      x = origin.x + direction.x * t
      z = origin.z + direction.z * t
      h = this.sample(clamp(x, -1, 1), clamp(-z, -1, 1)) * HEIGHT
    }
    if (Math.abs(x) > 1.02 || Math.abs(z) > 1.02) return null
    return { x: clamp(x, -0.98, 0.98), y: clamp(-z, -0.98, 0.98), h }
  }

  // ---------- input ----------

  private onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.idle = 0
    this.onInteract()
    if (this.pointers.size === 2) {
      // A second finger always means "move the camera", even while painting.
      if (this.painting) {
        this.painting = false
        this.onPaint({ x: 0, y: 0, phase: 'end' })
      }
      const [a, b] = [...this.pointers.values()]
      this.pinch = Math.hypot(a.x - b.x, a.y - b.y)
      this.pinchAngle = Math.atan2(b.y - a.y, b.x - a.x)
    } else if (this.mode === 'paint' && e.button === 0) {
      const hit = this.pick(e.clientX, e.clientY)
      if (hit) {
        this.painting = true
        this.onPaint({ x: hit.x, y: hit.y, phase: 'start' })
      }
    } else if (this.mode === 'orbit') {
      this.canvas.style.cursor = 'grabbing'
    }
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId)
    if (this.mode === 'paint') {
      const hit = this.pick(e.clientX, e.clientY)
      this.brush.visible = !!hit && e.pointerType !== 'touch'
      if (hit) {
        this.brush.position.set(hit.x, hit.h + 0.012, -hit.y)
        if (this.painting && p) this.onPaint({ x: hit.x, y: hit.y, phase: 'move' })
      }
    }
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    this.idle = 0
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      if (this.pinch > 0) this.gRadius = clamp(this.gRadius * (this.pinch / d), this.fit * 0.45, this.fit * 1.6)
      let da = ang - this.pinchAngle
      if (da > Math.PI) da -= Math.PI * 2
      if (da < -Math.PI) da += Math.PI * 2
      this.gTheta -= da
      this.pinch = d
      this.pinchAngle = ang
    } else if (this.mode === 'orbit' || (this.mode === 'paint' && e.buttons === 2)) {
      this.gTheta -= dx * 0.006
      if (!this.top) this.gPhi = clamp(this.gPhi - dy * 0.005, 0.18, 1.45)
    }
  }

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinch = 0
    if (this.painting && this.pointers.size === 0) {
      this.painting = false
      this.onPaint({ x: 0, y: 0, phase: 'end' })
    }
    if (this.mode === 'orbit') this.canvas.style.cursor = 'grab'
  }

  private onLeave = () => {
    this.brush.visible = false
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.idle = 0
    this.gRadius = clamp(this.gRadius * Math.exp(e.deltaY * 0.0012), this.fit * 0.45, this.fit * 1.6)
  }

  /** Keyboard-accessible camera nudges. */
  nudge(dTheta: number, dZoom: number) {
    this.idle = 0
    this.gTheta += dTheta
    this.gRadius = clamp(this.gRadius * dZoom, this.fit * 0.45, this.fit * 1.6)
  }

  // ---------- frame ----------

  frame(dt: number, t: number) {
    if (this.disposed) return
    const { shown, target } = this
    const P = this.aP.array as Float32Array
    const G = this.aG.array as Float32Array

    // Flow toward the newest network output instead of stepping.
    const k = 1 - Math.exp(-(this.opts.reduced ? 30 : 7) * dt)
    for (let i = 0; i < shown.length; i++) shown[i] += (target[i] - shown[i]) * k
    P.set(shown)
    const inv = (GRID - 1) / 4 // 1 / (2 * step), step = 2 / (GRID - 1)
    for (let j = 0; j < GRID; j++) {
      const jm = j > 0 ? j - 1 : j
      const jp = j < GRID - 1 ? j + 1 : j
      for (let i = 0; i < GRID; i++) {
        const im = i > 0 ? i - 1 : i
        const ip = i < GRID - 1 ? i + 1 : i
        const o = (j * GRID + i) * 2
        G[o] = (shown[j * GRID + ip] - shown[j * GRID + im]) * inv
        G[o + 1] = (shown[jp * GRID + i] - shown[jm * GRID + i]) * inv
      }
    }
    this.aP.needsUpdate = true
    this.aG.needsUpdate = true

    // Samples ride the surface.
    const pp = this.ptPos.array as Float32Array
    const wrong = this.ptWrong.array as Float32Array
    const latest = this.latest
    for (let i = 0; i < this.n; i++) {
      const x = this.xs[2 * i]
      const y = this.xs[2 * i + 1]
      pp[3 * i] = x
      pp[3 * i + 1] = this.sample(x, y) * HEIGHT + 0.022
      pp[3 * i + 2] = -y
      if (latest && i < latest.length) this.probs[i] = latest[i]
      wrong[i] = (this.probs[i] > 0.5 ? 1 : 0) === this.ys[i] ? 0 : 1
    }
    this.ptPos.needsUpdate = true
    this.ptWrong.needsUpdate = true

    if (this.embers.visible) this.stepEmbers(dt)

    // Camera.
    this.idle += dt
    if (!this.opts.reduced && !this.top && this.mode === 'orbit' && this.idle > 2.5 && this.pointers.size === 0) {
      this.gTheta += dt * 0.07 * Math.min(1, (this.idle - 2.5) / 2)
    }
    const lam = this.opts.reduced ? 40 : 6
    this.theta = damp(this.theta, this.gTheta, lam, dt)
    this.phi = damp(this.phi, this.gPhi, lam * 0.8, dt)
    this.radius = damp(this.radius, this.gRadius, lam, dt)
    const sp = Math.sin(this.phi)
    const ty = lerp(0.02, 0.2, clamp(this.phi / 1.0))
    this.camera.position.set(
      this.radius * sp * Math.sin(this.theta),
      ty + this.radius * Math.cos(this.phi),
      this.radius * sp * Math.cos(this.theta),
    )
    this.camera.up.set(0, 1, 0)
    if (this.phi < 0.05) this.camera.up.set(-Math.sin(this.theta), 0, -Math.cos(this.theta))
    this.camera.lookAt(0, ty, 0)

    const u = this.terrain.material.uniforms
    u.uTime.value = t
    u.uCam.value.copy(this.camera.position)
    this.points.material.uniforms.uTime.value = t

    // Shed load on devices that can't afford it: bloom first, then resolution.
    this.frameAvg = lerp(this.frameAvg, dt * 1000, 0.12)
    // Very slow frames (software rendering) are acted on at once, ordinary jank after a second.
    this.frames++
    if (this.pinned) {
      // fixed quality
    } else if ((this.frameAvg > 34 && this.frames % 30 === 0 && this.frames > 30) || (dt > 0.09 && this.frames % 3 === 0)) {
      if (this.tier === 0) this.tier = 1
      else if (this.quality > 0.4) {
        this.quality *= 0.7
        this.resize(...this.size)
      }
      this.frameAvg = 20
    }
    this.scene.background = this.tier === 0 ? this.bgComposer : this.bgDirect
    if (this.tier === 0) this.composer.render(dt)
    else this.renderer.render(this.scene, this.camera)
  }

  private stepEmbers(dt: number) {
    const pos = this.emPos.array as Float32Array
    const life = this.emLife.array as Float32Array
    const vel = this.emVel
    const s = this.shown
    // Spawn where neighbouring lattice cells straddle p = 0.5.
    for (let tries = 0; tries < 10; tries++) {
      const i = 1 + Math.floor(Math.random() * (GRID - 2))
      const j = 1 + Math.floor(Math.random() * (GRID - 2))
      const k = j * GRID + i
      if ((s[k] - 0.5) * (s[k + 1] - 0.5) >= 0 && (s[k] - 0.5) * (s[k + GRID] - 0.5) >= 0) continue
      if (Math.abs(s[k + 1] - s[k]) + Math.abs(s[k + GRID] - s[k]) < 0.02) continue
      const e = this.emNext
      this.emNext = (e + 1) % EMBERS
      pos[3 * e] = -1 + (2 * i) / (GRID - 1)
      pos[3 * e + 1] = 0.5 * HEIGHT
      pos[3 * e + 2] = -(-1 + (2 * j) / (GRID - 1))
      vel[3 * e] = (Math.random() - 0.5) * 0.12
      vel[3 * e + 1] = 0.16 + Math.random() * 0.3
      vel[3 * e + 2] = (Math.random() - 0.5) * 0.12
      life[e] = 1
      if (Math.random() < 0.6) break
    }
    for (let e = 0; e < EMBERS; e++) {
      if (life[e] <= 0) continue
      life[e] = Math.max(0, life[e] - dt * 0.75)
      vel[3 * e + 1] -= dt * 0.1
      pos[3 * e] += vel[3 * e] * dt
      pos[3 * e + 1] += vel[3 * e + 1] * dt
      pos[3 * e + 2] += vel[3 * e + 2] * dt
    }
    this.emPos.needsUpdate = true
    this.emLife.needsUpdate = true
  }

  dispose() {
    this.disposed = true
    const c = this.canvas
    c.removeEventListener('pointerdown', this.onDown)
    c.removeEventListener('pointermove', this.onMove)
    c.removeEventListener('pointerup', this.onUp)
    c.removeEventListener('pointercancel', this.onUp)
    c.removeEventListener('pointerleave', this.onLeave)
    c.removeEventListener('wheel', this.onWheel)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
