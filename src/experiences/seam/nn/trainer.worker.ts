/// <reference lib="webworker" />
import { MLP } from './mlp'
import { GRID, type Frame, type ToWorker } from './protocol'
import { rng } from '../../../lib/math'

const BATCH = 32
const FRAME_MS = 60
const SLICE_MS = 10

let net: MLP | null = null
let rand = rng(1)
let xs: Float32Array = new Float32Array(0)
let ys: Uint8Array = new Uint8Array(0)
let n = 0
let order = new Uint32Array(0)
let cursor = 0
let lr = 0.02
let l2 = 0
let rate = 240
let running = false
let pendingSteps = 0
let step = 0
let dirty = true
let credit = 0
let lastTick = performance.now()
let lastFrame = 0
let stepsSinceFrame = 0

function shuffle() {
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = order[i]
    order[i] = order[j]
    order[j] = t
  }
  cursor = 0
}

function trainOne() {
  if (!net || n === 0) return
  if (cursor >= n) shuffle()
  const count = Math.min(BATCH, n - cursor)
  net.trainBatch(xs, ys, order, cursor, count, lr, l2)
  cursor += count
  step++
  stepsSinceFrame++
  dirty = true
}

function post(now: number) {
  if (!net) return
  const grid = new Float32Array(GRID * GRID)
  net.evalGrid(grid, GRID)
  const probs = new Float32Array(n)
  const { loss, acc } = net.evaluate(xs, ys, n, probs)
  const params = Float32Array.from(net.params)
  const dt = Math.max(1, now - lastFrame)
  const frame: Frame = {
    type: 'frame',
    grid,
    probs,
    params,
    sizes: net.sizes,
    loss,
    acc,
    step,
    sps: lastFrame === 0 ? 0 : (stepsSinceFrame / dt) * 1000,
  }
  lastFrame = now
  stepsSinceFrame = 0
  dirty = false
  postMessage(frame, [grid.buffer, probs.buffer, params.buffer])
}

function tick() {
  const now = performance.now()
  const dt = Math.min(250, now - lastTick)
  lastTick = now
  if (net) {
    let quota = pendingSteps
    pendingSteps = 0
    if (running) {
      credit = Math.min(credit + (rate * dt) / 1000, Number.isFinite(rate) ? rate / 4 : 1e9)
      const whole = Math.floor(credit)
      credit -= whole
      quota += whole
    }
    const deadline = now + SLICE_MS
    while (quota-- > 0) {
      trainOne()
      if ((quota & 7) === 0 && performance.now() > deadline) break
    }
    if (dirty && now - lastFrame >= FRAME_MS) post(now)
  }
  setTimeout(tick, running ? 0 : 24)
}

onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data
  switch (m.type) {
    case 'reset':
      rand = rng(m.seed)
      net = new MLP(m.spec, rand)
      step = 0
      credit = 0
      dirty = true
      lastFrame = 0
      break
    case 'data':
      xs = m.xs
      ys = m.ys
      n = m.n
      order = new Uint32Array(n)
      for (let i = 0; i < n; i++) order[i] = i
      shuffle()
      dirty = true
      break
    case 'hyper':
      lr = m.lr
      l2 = m.l2
      rate = m.rate
      break
    case 'run':
      running = m.on
      credit = 0
      break
    case 'step':
      pendingSteps += 1
      break
  }
}

tick()
