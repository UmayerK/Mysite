/** Canvas 2D readouts: the loss curve and the live weight diagram. */

function fit(c: HTMLCanvasElement) {
  const w = c.clientWidth
  const h = c.clientHeight
  if (w < 4 || h < 4) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
  }
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  return { ctx, w, h }
}

const MONO = "500 9px 'Geist Mono Variable', ui-monospace, monospace"

/** Loss against optimiser steps on a log axis, one gridline per decade. */
export function drawLoss(c: HTMLCanvasElement, steps: number[], loss: number[]) {
  const f = fit(c)
  if (!f) return
  const { ctx, w, h } = f
  const padL = 30
  const padT = 5
  const padB = 5
  let min = 0.05
  let max = 1
  for (const v of loss) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const lo = Math.floor(Math.log10(Math.max(min, 1e-5)))
  const hi = Math.ceil(Math.log10(max) - 1e-9)
  const y = (v: number) => padT + ((hi - Math.log10(Math.max(v, 1e-5))) / (hi - lo)) * (h - padT - padB)
  ctx.font = MONO
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 1
  for (let d = lo; d <= hi; d++) {
    const yy = Math.round(y(Math.pow(10, d))) + 0.5
    ctx.strokeStyle = 'rgba(233,228,220,0.11)'
    ctx.beginPath()
    ctx.moveTo(padL, yy)
    ctx.lineTo(w, yy)
    ctx.stroke()
    ctx.fillStyle = 'rgba(233,228,220,0.5)'
    const label = d >= 0 ? String(Math.pow(10, d)) : d >= -3 ? Math.pow(10, d).toFixed(-d).slice(1) : `1e${d}`
    ctx.fillText(label, 0, Math.min(h - 5, Math.max(5, yy)))
  }
  const n = steps.length
  if (n < 2) return
  const last = steps[n - 1]
  const x = (s: number) => padL + (s / last) * (w - padL - 3)
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const px = x(steps[i])
    const py = y(loss[i])
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.strokeStyle = '#ff6a1a'
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.lineTo(x(last), h)
  ctx.lineTo(x(steps[0]), h)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(255,106,26,0.26)')
  g.addColorStop(1, 'rgba(255,106,26,0)')
  ctx.fillStyle = g
  ctx.fill()
  // The current value: a white-hot bead at the end of the trace.
  ctx.fillStyle = '#fff3e0'
  ctx.beginPath()
  ctx.arc(x(last), y(loss[n - 1]), 2.5, 0, Math.PI * 2)
  ctx.fill()
}

/** Every weight in the network as a line: orange positive, steel blue negative, weight → opacity. */
export function drawNet(c: HTMLCanvasElement, sizes: number[], params: Float32Array) {
  const f = fit(c)
  if (!f) return
  const { ctx, w, h } = f
  const L = sizes.length - 1
  const padX = 16
  const xAt = (l: number) => padX + (l / L) * (w - padX * 2)
  const yAt = (l: number, j: number) => {
    const s = sizes[l]
    const gap = Math.min(15, (h - 12) / Math.max(1, s))
    return h / 2 + (j - (s - 1) / 2) * gap
  }
  let off = 0
  const wOff: number[] = []
  const bOff: number[] = []
  for (let l = 0; l < L; l++) {
    wOff.push(off)
    off += sizes[l] * sizes[l + 1]
    bOff.push(off)
    off += sizes[l + 1]
  }
  if (params.length < off) return

  ctx.lineCap = 'round'
  for (let l = 0; l < L; l++) {
    const nin = sizes[l]
    const nout = sizes[l + 1]
    let max = 1e-6
    for (let k = 0; k < nin * nout; k++) max = Math.max(max, Math.abs(params[wOff[l] + k]))
    const x0 = xAt(l)
    const x1 = xAt(l + 1)
    for (let j = 0; j < nout; j++) {
      for (let i = 0; i < nin; i++) {
        const v = params[wOff[l] + j * nin + i]
        const m = Math.abs(v) / max
        if (m < 0.07) continue
        ctx.strokeStyle = v > 0 ? `rgba(255,112,32,${(m * 0.85).toFixed(3)})` : `rgba(138,170,224,${(m * 0.85).toFixed(3)})`
        ctx.lineWidth = 0.4 + m * 1.5
        ctx.beginPath()
        ctx.moveTo(x0, yAt(l, i))
        ctx.lineTo(x1, yAt(l + 1, j))
        ctx.stroke()
      }
    }
  }
  for (let l = 0; l <= L; l++) {
    const s = sizes[l]
    const r = Math.min(3.4, Math.max(1.6, (h - 12) / s / 2.6))
    for (let j = 0; j < s; j++) {
      ctx.beginPath()
      ctx.arc(xAt(l), yAt(l, j), r, 0, Math.PI * 2)
      ctx.fillStyle = '#0e0f11'
      ctx.fill()
      ctx.strokeStyle = l === L ? '#ff6a1a' : 'rgba(233,228,220,0.8)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}
