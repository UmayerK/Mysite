/** Glyph, stage 3: syntax tree → scene. A tree-walking evaluator that keeps a riso's worth of state. */
import { GlyphError } from './lexer'
import type { Expr, Program, Span, Stmt } from './parser'

export const W = 100
export const H = 140

export interface Ink {
  kind: 'ink'
  name: string
  css: string
}
export type Value = number | string | Ink

export const INKS: Record<string, string> = {
  pink: '#ff4f9a',
  blue: '#1463d9',
  yellow: '#ffd91a',
  black: '#1c1a17',
  red: '#ff5a45',
  orange: '#ff7a1a',
  teal: '#00929a',
  green: '#1fae6b',
  violet: '#7a5cd1',
  mint: '#7fd6c8',
  grey: '#8f8a80',
}
export const PAPERS: Record<string, string> = {
  cream: '#f2e8d5',
  white: '#fbf8f1',
  kraft: '#cfae84',
  blush: '#f6d3cf',
  night: '#17161b',
}
const WORDS = ['center', 'left', 'right', 'serif', 'sans', 'mono']

export interface Param {
  name: string
  type: 'num' | 'ink' | 'text'
  optional?: boolean
}
export interface Sig {
  group: 'Page' | 'Ink' | 'Place' | 'Draw'
  params: Param[]
  opts?: string[]
  /** Takes a { } block that limits its effect. */
  block?: boolean
  doc: string
  example: string
}
const num = (name: string, optional = false): Param => ({ name, type: 'num', optional })

export const COMMANDS: Record<string, Sig> = {
  paper: { group: 'Page', params: [{ name: 'colour', type: 'ink' }], doc: 'The stock: cream, white, kraft, blush, night.', example: 'paper cream' },
  grain: { group: 'Page', params: [num('amount')], doc: 'Ink speckle, 0 to 1.', example: 'grain 0.6' },
  misprint: { group: 'Page', params: [num('amount')], doc: 'How far the plates slip out of register.', example: 'misprint 0.5' },
  seed: { group: 'Page', params: [num('n')], doc: 'Restarts rand, any and noise.', example: 'seed 7' },
  ink: { group: 'Ink', params: [{ name: 'colour', type: 'ink' }, num('tint', true)], block: true, doc: 'Loads a drum. Each ink prints as its own plate.', example: 'ink pink' },
  fill: { group: 'Ink', params: [], block: true, doc: 'Shapes print solid.', example: 'fill' },
  outline: { group: 'Ink', params: [num('width', true)], block: true, doc: 'Shapes print as a line.', example: 'outline 0.8' },
  move: { group: 'Place', params: [num('x'), num('y')], block: true, doc: 'Shifts the origin.', example: 'move 50, 70' },
  turn: { group: 'Place', params: [num('degrees')], block: true, doc: 'Rotates around the origin, clockwise.', example: 'turn 15' },
  scale: { group: 'Place', params: [num('x'), num('y', true)], block: true, doc: 'Stretches around the origin.', example: 'scale 1.5' },
  group: { group: 'Place', params: [], block: true, doc: 'A block whose settings end at the brace.', example: 'group {\n  turn 10\n  rect 20, 20, 30, 30\n}' },
  circle: { group: 'Draw', params: [num('x'), num('y'), num('r')], doc: 'A disc.', example: 'circle 50, 70, 20' },
  rect: { group: 'Draw', params: [num('x'), num('y'), num('w'), num('h')], opts: ['round'], doc: 'From its top-left corner.', example: 'rect 20, 20, 60, 30, round: 4' },
  line: { group: 'Draw', params: [num('x1'), num('y1'), num('x2'), num('y2')], opts: ['width'], doc: 'A stroke between two points.', example: 'line 10, 10, 90, 130, width: 1' },
  poly: { group: 'Draw', params: [num('x'), num('y'), num('r'), num('sides')], opts: ['turn'], doc: 'A regular polygon.', example: 'poly 50, 70, 24, 3' },
  arc: { group: 'Draw', params: [num('x'), num('y'), num('r'), num('from'), num('to')], opts: ['width'], doc: 'Part of a circle, in degrees.', example: 'arc 50, 70, 30, 180, 360' },
  wedge: { group: 'Draw', params: [num('x'), num('y'), num('r'), num('from'), num('to')], doc: 'A slice of a disc.', example: 'wedge 50, 70, 30, 0, 90' },
  wave: { group: 'Draw', params: [num('x1'), num('y'), num('x2'), num('height'), num('cycles')], opts: ['phase', 'width'], doc: 'A sine line.', example: 'wave 0, 70, 100, 6, 3' },
  text: { group: 'Draw', params: [{ name: 'words', type: 'text' }, num('x'), num('y')], opts: ['size', 'weight', 'align', 'font', 'track', 'soft', 'wonk'], doc: 'Set type. x, y is the baseline.', example: 'text "HELLO", 50, 70, size: 18, align: center' },
}

export const FUNCTIONS: Record<string, { args: string; min: number; max: number; doc: string }> = {
  sin: { args: 'degrees', min: 1, max: 1, doc: 'Sine of an angle in degrees.' },
  cos: { args: 'degrees', min: 1, max: 1, doc: 'Cosine of an angle in degrees.' },
  abs: { args: 'n', min: 1, max: 1, doc: 'Drops the sign.' },
  floor: { args: 'n', min: 1, max: 1, doc: 'Rounds down.' },
  round: { args: 'n', min: 1, max: 1, doc: 'Rounds to the nearest whole number.' },
  sqrt: { args: 'n', min: 1, max: 1, doc: 'Square root.' },
  pow: { args: 'n, power', min: 2, max: 2, doc: 'n raised to a power.' },
  min: { args: 'a, b, …', min: 1, max: 32, doc: 'The smallest.' },
  max: { args: 'a, b, …', min: 1, max: 32, doc: 'The largest.' },
  clamp: { args: 'n, low, high', min: 3, max: 3, doc: 'Keeps n inside a range.' },
  lerp: { args: 'a, b, amount', min: 3, max: 3, doc: 'Blends two numbers.' },
  map: { args: 'n, a, b, c, d', min: 5, max: 5, doc: 'Moves n from the range a–b to c–d.' },
  rand: { args: 'low, high', min: 0, max: 2, doc: 'A seeded random number.' },
  noise: { args: 'x, y', min: 1, max: 2, doc: 'Smooth randomness, 0 to 1.' },
  pick: { args: 'i, a, b, …', min: 2, max: 32, doc: 'The i-th of the values, wrapping round.' },
  any: { args: 'a, b, …', min: 1, max: 32, doc: 'One of the values, at random.' },
}

type Mat = [number, number, number, number, number, number]
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

export interface Shape {
  /** Markup up to, but not including, the paint attributes. */
  open: string
  close: string
  tint: number
  /** Stroke width, or 0 for a solid shape. */
  outline: number
  start: number
  end: number
}
export interface Plate {
  name: string
  css: string
  shapes: Shape[]
}
export interface Scene {
  paper: Ink
  dark: boolean
  plates: Plate[]
  count: number
  grain: number
  misprint: number
  usesTime: boolean
  usesRandom: boolean
  /** Where the literal after `seed` sits, so the reroll button can rewrite it. */
  seedSpan: Span | null
  fonts: Set<'serif' | 'sans'>
}

const MAX_SHAPES = 6000
const MAX_STEPS = 120000
const MAX_PLATES = 8
const DEG = Math.PI / 180
/** Trims float noise so the SVG stays small and stable. */
export const fmt = (v: number) => String(Math.round(v * 1000) / 1000)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function nearest(word: string, pool: string[]) {
  let best: string | null = null
  let bestD = 3
  for (const cand of pool) {
    if (Math.abs(cand.length - word.length) > 2) continue
    const prev = Array.from({ length: cand.length + 1 }, (_, i) => i)
    for (let i = 1; i <= word.length; i++) {
      let diag = prev[0]
      prev[0] = i
      for (let j = 1; j <= cand.length; j++) {
        const tmp = prev[j]
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (word[i - 1] === cand[j - 1] ? 0 : 1))
        diag = tmp
      }
    }
    if (prev[cand.length] < bestD) {
      bestD = prev[cand.length]
      best = cand
    }
  }
  return best
}

const luminance = (hex: string) => {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex
  const v = parseInt(h.slice(1), 16)
  return (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255
}
const describe = (v: Value) => (typeof v === 'number' ? 'a number' : typeof v === 'string' ? 'text' : 'an ink')

export function run(program: Program, env: { t: number }): Scene {
  const scene: Scene = {
    paper: { kind: 'ink', name: 'cream', css: PAPERS.cream },
    dark: false,
    plates: [],
    count: 0,
    grain: 0.5,
    misprint: 0.25,
    usesTime: false,
    usesRandom: false,
    seedSpan: null,
    fonts: new Set(),
  }
  const fail = (msg: string, at: Span): never => {
    throw new GlyphError(msg, at.start, at.end, 'run')
  }

  let seed = 1
  let rs = 1
  const reseed = (n: number) => {
    seed = n | 0
    rs = (seed * 2654435761) >>> 0 || 1
  }
  reseed(1)
  const random = () => {
    rs = (rs + 0x6d2b79f5) | 0
    let x = Math.imul(rs ^ (rs >>> 15), 1 | rs)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  const hash = (x: number, y: number) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 1274126177)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const u = fx * fx * (3 - 2 * fx)
    const v = fy * fy * (3 - 2 * fy)
    const a = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u
    const b = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u
    return a + (b - a) * v
  }

  const scopes: Map<string, Value>[] = [new Map()]
  let state = { ink: { kind: 'ink', name: 'black', css: INKS.black } as Ink, tint: 1, outline: 0, m: [1, 0, 0, 1, 0, 0] as Mat }
  let steps = 0

  const lookup = (name: string, at: Span): Value => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const v = scopes[i].get(name)
      if (v !== undefined) return v
    }
    if (name === 't') {
      scene.usesTime = true
      return env.t
    }
    if (name === 'W') return W
    if (name === 'H') return H
    if (name === 'PI') return Math.PI
    if (name in INKS) return { kind: 'ink', name, css: INKS[name] }
    if (name in PAPERS) return { kind: 'ink', name, css: PAPERS[name] }
    if (WORDS.includes(name)) return name
    const pool = [...scopes.flatMap((s) => [...s.keys()]), 't', 'W', 'H', ...Object.keys(INKS), ...Object.keys(PAPERS), ...WORDS]
    const hint = nearest(name, pool)
    if (name in COMMANDS) return fail(`“${name}” is a command, so it has to start its own line.`, at)
    return fail(hint ? `Nothing is called “${name}”. Did you mean ${hint}?` : `Nothing is called “${name}”. Name a value first: let ${name} = 10`, at)
  }

  const number = (e: Expr, what: string): number => {
    const v = ev(e)
    if (typeof v !== 'number') return fail(`${what} needs a number, but this is ${describe(v)}.`, e)
    if (!Number.isFinite(v)) return fail(`${what} works out to ${Number.isNaN(v) ? 'something that is not a number' : 'infinity'}. Check for a division by zero.`, e)
    return v
  }

  function ev(e: Expr): Value {
    switch (e.type) {
      case 'Num':
      case 'Str':
        return e.value
      case 'Color':
        return { kind: 'ink', name: e.value.toLowerCase(), css: e.value.toLowerCase() }
      case 'Ident':
        return lookup(e.name, e)
      case 'Unary':
        return -number(e.arg, 'The minus sign')
      case 'Binary': {
        const l = ev(e.left)
        const r = ev(e.right)
        if (e.op === '==' || e.op === '!=') {
          const same = typeof l === 'object' && typeof r === 'object' ? l.css === r.css : l === r
          return same === (e.op === '==') ? 1 : 0
        }
        if (e.op === '+' && (typeof l === 'string' || typeof r === 'string') && typeof l !== 'object' && typeof r !== 'object') {
          return (typeof l === 'number' ? fmt(l) : l) + (typeof r === 'number' ? fmt(r) : r)
        }
        if (typeof l !== 'number') return fail(`${e.op} works on numbers, but the left side is ${describe(l)}.`, e.left)
        if (typeof r !== 'number') return fail(`${e.op} works on numbers, but the right side is ${describe(r)}.`, e.right)
        switch (e.op) {
          case '+':
            return l + r
          case '-':
            return l - r
          case '*':
            return l * r
          case '/':
            return l / r
          case '%':
            return r === 0 ? fail('The remainder of a division by zero is not a number.', e.right) : l - r * Math.floor(l / r)
          case '<':
            return l < r ? 1 : 0
          case '>':
            return l > r ? 1 : 0
          case '<=':
            return l <= r ? 1 : 0
          default:
            return l >= r ? 1 : 0
        }
      }
      case 'Call':
        return call(e)
    }
  }

  function call(e: Extract<Expr, { type: 'Call' }>): Value {
    const def = FUNCTIONS[e.name]
    if (!def) {
      const hint = nearest(e.name, Object.keys(FUNCTIONS))
      return fail(hint ? `There is no function called “${e.name}”. Did you mean ${hint}?` : `There is no function called “${e.name}”.`, e)
    }
    if (e.args.length < def.min || e.args.length > def.max) return fail(`${e.name}(${def.args}) was given ${e.args.length} value${e.args.length === 1 ? '' : 's'}.`, e)
    if (e.name === 'pick') {
      const i = number(e.args[0], 'pick')
      const n = e.args.length - 1
      return ev(e.args[1 + (((Math.floor(i) % n) + n) % n)])
    }
    if (e.name === 'any') {
      scene.usesRandom = true
      return ev(e.args[Math.floor(random() * e.args.length)])
    }
    const a = e.args.map((x) => number(x, e.name))
    switch (e.name) {
      case 'sin':
        return Math.sin(a[0] * DEG)
      case 'cos':
        return Math.cos(a[0] * DEG)
      case 'abs':
        return Math.abs(a[0])
      case 'floor':
        return Math.floor(a[0])
      case 'round':
        return Math.round(a[0])
      case 'sqrt':
        return a[0] < 0 ? fail('sqrt needs a number that is not negative.', e.args[0]) : Math.sqrt(a[0])
      case 'pow':
        return Math.pow(a[0], a[1])
      case 'min':
        return Math.min(...a)
      case 'max':
        return Math.max(...a)
      case 'clamp':
        return Math.min(Math.max(a[0], a[1]), a[2])
      case 'lerp':
        return a[0] + (a[1] - a[0]) * a[2]
      case 'map':
        return a[1] === a[2] ? a[3] : a[3] + ((a[0] - a[1]) / (a[2] - a[1])) * (a[4] - a[3])
      case 'rand': {
        scene.usesRandom = true
        const lo = a.length === 2 ? a[0] : 0
        const hi = a.length === 2 ? a[1] : a.length === 1 ? a[0] : 1
        return lo + random() * (hi - lo)
      }
      default:
        return noise(a[0], a[1] ?? 0)
    }
  }

  const plateOf = (ink: Ink, at: Span) => {
    let plate = scene.plates.find((p) => p.css === ink.css)
    if (!plate) {
      if (scene.plates.length >= MAX_PLATES) fail(`This press has ${MAX_PLATES} drums and the poster already uses all of them. Reuse an ink.`, at)
      plate = { name: ink.name, css: ink.css, shapes: [] }
      scene.plates.push(plate)
    }
    return plate
  }
  const put = (open: string, close: string, outline: number, at: Span) => {
    if (++scene.count > MAX_SHAPES) fail(`That is more than ${MAX_SHAPES.toLocaleString('en')} shapes. The press would jam; draw fewer.`, at)
    const m = state.m
    const tf = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0 ? '' : ` transform="matrix(${m.map(fmt).join(' ')})"`
    plateOf(state.ink, at).shapes.push({ open: open + tf, close, tint: state.tint, outline, start: at.start, end: at.end })
  }

  function block(body: Stmt[], scoped: boolean) {
    const saved = state
    if (scoped) state = { ...state }
    scopes.push(new Map())
    try {
      for (const s of body) exec(s)
    } finally {
      scopes.pop()
      if (scoped) state = saved
    }
  }

  function exec(s: Stmt) {
    if (++steps > MAX_STEPS) fail('This program runs for too long. Lower a repeat count.', s)
    switch (s.type) {
      case 'Let':
        scopes[scopes.length - 1].set(s.name, ev(s.value))
        return
      case 'Assign': {
        for (let i = scopes.length - 1; i >= 0; i--) {
          if (scopes[i].has(s.name)) {
            scopes[i].set(s.name, ev(s.value))
            return
          }
        }
        return fail(`“${s.name}” has not been named yet. Start with: let ${s.name} = …`, s)
      }
      case 'Repeat': {
        const n = Math.floor(number(s.count, 'repeat'))
        if (n > 5000) fail('repeat stops at 5,000 turns.', s.count)
        for (let i = 0; i < n; i++) {
          const saved = state
          state = { ...state }
          scopes.push(new Map(s.as ? [[s.as, i]] : []))
          try {
            for (const b of s.body) exec(b)
          } finally {
            scopes.pop()
            state = saved
          }
        }
        return
      }
      case 'If': {
        const v = ev(s.test)
        if (v !== 0 && v !== '') block(s.then, false)
        else if (s.else) block(s.else, false)
        return
      }
      case 'Command':
        return command(s)
    }
  }

  function command(s: Extract<Stmt, { type: 'Command' }>) {
    const sig = COMMANDS[s.name]
    if (!sig) {
      const hint = nearest(s.name, Object.keys(COMMANDS))
      fail(hint ? `Glyph has no command called “${s.name}”. Did you mean ${hint}?` : `Glyph has no command called “${s.name}”.`, s.nameSpan)
    }
    const pos = s.args.filter((a) => a.key === null)
    const need = sig.params.filter((p) => !p.optional).length
    const shape = `${s.name}${sig.params.length ? ' ' + sig.params.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ') : ''}`
    if (pos.length < need || pos.length > sig.params.length) {
      fail(`${s.name} is written “${shape}”. This line gives it ${pos.length} value${pos.length === 1 ? '' : 's'}.`, pos.length > sig.params.length ? pos[sig.params.length] : s.nameSpan)
    }
    const opt: Record<string, Expr> = {}
    for (const a of s.args) {
      if (a.key === null) continue
      if (!sig.opts?.includes(a.key)) {
        fail(sig.opts ? `${s.name} has no option called “${a.key}”. It takes ${sig.opts.join(', ')}.` : `${s.name} takes no options, so “${a.key}:” has nowhere to go.`, a)
      }
      opt[a.key] = a.value
    }
    if (s.body && !sig.block) fail(`${s.name} draws or sets one thing, so it cannot own a { } block.`, s.nameSpan)
    const N = (i: number) => number(pos[i].value, `${s.name}'s ${sig.params[i].name}`)
    const O = (key: string, fallback: number) => (opt[key] ? number(opt[key], `${s.name}'s ${key}`) : fallback)
    const inkArg = (i: number): Ink => {
      const v = ev(pos[i].value)
      if (typeof v !== 'object') return fail(`${s.name} needs a colour such as pink, blue or #ff4f9a, but this is ${describe(v)}.`, pos[i].value)
      return v
    }
    const stroke = () => Math.max(0.05, O('width', state.outline || 0.6))

    // Settings: with a block they last until its closing brace, otherwise until the enclosing one.
    if (sig.block) {
      const saved = state
      state = { ...state }
      if (s.name === 'ink') {
        state.ink = inkArg(0)
        state.tint = pos[1] ? Math.min(1, Math.max(0, N(1))) : 1
      } else if (s.name === 'fill') state.outline = 0
      else if (s.name === 'outline') state.outline = Math.max(0.05, pos[0] ? N(0) : 0.6)
      else if (s.name === 'move') state.m = mul(state.m, [1, 0, 0, 1, N(0), N(1)])
      else if (s.name === 'turn') {
        const a = N(0) * DEG
        state.m = mul(state.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
      } else if (s.name === 'scale') state.m = mul(state.m, [N(0), 0, 0, pos[1] ? N(1) : N(0), 0, 0])
      else if (!s.body) fail('group needs a { } block to hold.', s.nameSpan)
      if (s.body) {
        try {
          block(s.body, false)
        } finally {
          state = saved
        }
      }
      return
    }

    switch (s.name) {
      case 'paper':
        scene.paper = inkArg(0)
        scene.dark = luminance(scene.paper.css) < 0.3
        return
      case 'grain':
        scene.grain = Math.min(1, Math.max(0, N(0)))
        return
      case 'misprint':
        scene.misprint = Math.min(4, Math.max(0, N(0)))
        return
      case 'seed':
        reseed(Math.floor(N(0)))
        if (pos[0].value.type === 'Num' && !scene.seedSpan) scene.seedSpan = pos[0].value
        return
      case 'circle':
        return put(`<circle cx="${fmt(N(0))}" cy="${fmt(N(1))}" r="${fmt(Math.abs(N(2)))}"`, '/>', state.outline, s)
      case 'rect': {
        const w = N(2)
        const h = N(3)
        const r = Math.max(0, O('round', 0))
        return put(
          `<rect x="${fmt(Math.min(N(0), N(0) + w))}" y="${fmt(Math.min(N(1), N(1) + h))}" width="${fmt(Math.abs(w))}" height="${fmt(Math.abs(h))}"${r ? ` rx="${fmt(r)}"` : ''}`,
          '/>',
          state.outline,
          s,
        )
      }
      case 'line':
        return put(`<line x1="${fmt(N(0))}" y1="${fmt(N(1))}" x2="${fmt(N(2))}" y2="${fmt(N(3))}"`, '/>', stroke(), s)
      case 'poly': {
        const sides = Math.min(64, Math.max(3, Math.round(N(3))))
        const r = N(2)
        const a0 = (O('turn', 0) - 90) * DEG
        let pts = ''
        for (let i = 0; i < sides; i++) {
          const a = a0 + (i / sides) * Math.PI * 2
          pts += `${i ? ' ' : ''}${fmt(N(0) + Math.cos(a) * r)},${fmt(N(1) + Math.sin(a) * r)}`
        }
        return put(`<polygon points="${pts}"`, '/>', state.outline, s)
      }
      case 'arc':
      case 'wedge': {
        const [x, y, r, from, to] = [N(0), N(1), Math.abs(N(2)), N(3), N(4)]
        const wedge = s.name === 'wedge'
        if (Math.abs(to - from) >= 360) return put(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}"`, '/>', wedge ? state.outline : stroke(), s)
        const p = (a: number) => `${fmt(x + Math.cos(a * DEG) * r)} ${fmt(y + Math.sin(a * DEG) * r)}`
        const curve = `A${fmt(r)} ${fmt(r)} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 1 : 0} ${p(to)}`
        return wedge
          ? put(`<path d="M${fmt(x)} ${fmt(y)}L${p(from)}${curve}Z"`, '/>', state.outline, s)
          : put(`<path d="M${p(from)}${curve}"`, '/>', stroke(), s)
      }
      case 'wave': {
        const [x1, y, x2, amp, cycles] = [N(0), N(1), N(2), N(3), N(4)]
        const phase = O('phase', 0) * DEG
        const n = Math.round(Math.min(360, Math.max(12, Math.abs(cycles) * 20)))
        let d = ''
        for (let i = 0; i <= n; i++) {
          const u = i / n
          d += `${i ? 'L' : 'M'}${fmt(x1 + (x2 - x1) * u)} ${fmt(y + Math.sin(phase + u * cycles * Math.PI * 2) * amp)}`
        }
        return put(`<path d="${d}" stroke-linejoin="round"`, '/>', stroke(), s)
      }
      default: {
        const v = ev(pos[0].value)
        if (typeof v === 'object') fail('text needs words in quotes or a number, but this is an ink.', pos[0].value)
        const words = typeof v === 'number' ? fmt(v) : (v as string)
        const word = (key: string, allowed: string[], fallback: string) => {
          if (!opt[key]) return fallback
          const got = ev(opt[key])
          if (typeof got !== 'string' || !allowed.includes(got)) fail(`text's ${key} is one of ${allowed.join(', ')}.`, opt[key])
          return got as string
        }
        const size = Math.max(0.5, O('size', 10))
        const weight = Math.round(Math.min(1000, Math.max(100, O('weight', 600))))
        const align = word('align', ['left', 'center', 'right'], 'left')
        const font = word('font', ['serif', 'sans', 'mono'], 'serif')
        const track = O('track', 0)
        scene.fonts.add(font === 'serif' ? 'serif' : 'sans')
        const family =
          font === 'serif'
            ? `font-family="'Fraunces Variable',Fraunces,Georgia,serif" style="font-variation-settings:'opsz' ${fmt(Math.min(144, Math.max(9, size * 5)))},'SOFT' ${fmt(Math.min(100, Math.max(0, O('soft', 0))))},'WONK' ${O('wonk', 0) ? 1 : 0}"`
            : `font-family="'Recursive Variable',Recursive,${font === 'mono' ? 'ui-monospace,monospace' : 'system-ui,sans-serif'}" style="font-variation-settings:'MONO' ${font === 'mono' ? 1 : 0},'CASL' ${fmt(Math.min(1, Math.max(0, O('soft', 0) / 100)))}"`
        return put(
          `<text x="${fmt(N(1))}" y="${fmt(N(2))}" font-size="${fmt(size)}" font-weight="${weight}" text-anchor="${align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'}"${track ? ` letter-spacing="${fmt(track * size)}"` : ''} ${family}`,
          `>${esc(words)}</text>`,
          state.outline,
          s,
        )
      }
    }
  }

  for (const s of program.body) exec(s)
  return scene
}
