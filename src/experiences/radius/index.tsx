import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import '@fontsource-variable/bricolage-grotesque/index.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { ExperienceShell } from '../../shell/ExperienceShell'
import { useCoarsePointer, useElementSize, useMediaQuery, useRaf } from '../../lib/hooks'
import { cappedDpr, clamp } from '../../lib/math'
import { meta } from './meta'
import { BACKLOG, PRODUCTS, SCENARIOS, SHIFT, STEP, STOCK, createSim, leader, placeBid, quote, score, step, type Dials, type Order } from './sim'
import './radius.css'

type Tab = 'round' | 'agent' | 'board' | 'market'
interface Fx {
  kind: 'win' | 'void' | 'gain'
  x: number
  y: number
  plant: number
  t0: number
  text: string
}

const CREAM = '244, 238, 221'
const YELLOW = '255, 212, 0'
const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en')}`
const clock = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`
const line = (series: number[], lo: number, hi: number, n: number) =>
  series.map((v, i) => `${((i / n) * 220).toFixed(1)},${(42 - ((v - lo) / (hi - lo || 1)) * 40).toFixed(1)}`).join(' ')

export default function Radius() {
  const compact = useMediaQuery('(max-width: 960px)')
  const coarse = useCoarsePointer()
  const [ready, setReady] = useState(false)
  const [scenario, setScenario] = useState(0)
  const [seed, setSeed] = useState(4821)
  const [run, setRun] = useState(0)
  const [dials, setDials] = useState<Dials>(STOCK)
  const [agentOn, setAgentOn] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [selected, setSelected] = useState<Order | null>(null)
  const [manual, setManual] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('round')
  const [, setTick] = useState(0)

  const mapRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const pads = useRef({ t: 200, short: 104, b: 168, clear: 320 })
  const canvas = useRef<HTMLCanvasElement>(null)
  const size = useElementSize(mapRef)
  const dialsRef = useRef(dials)
  dialsRef.current = dials
  const view = useRef({ ox: 0, oy: 0, s: 1 })
  const sel = useRef<{ order: Order | null; pinned: boolean; hold: number }>({ order: null, pinned: false, hold: 0 })
  const acc = useRef(0)
  const lastTick = useRef(0)
  const drag = useRef(false)
  const grip = useRef(-0.07)

  // Two copies of the same day: yours, and one where the stock agent runs your plant untouched.
  const world = useMemo(
    () => ({
      sim: createSim(seed, SCENARIOS[scenario], dialsRef.current),
      ghost: createSim(seed, SCENARIOS[scenario], STOCK),
      fx: [] as Fx[],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, scenario, run],
  )
  const { sim, ghost } = world
  const you = sim.plants[0]

  useEffect(() => {
    sel.current = { order: null, pinned: false, hold: 0 }
    acc.current = 0
    setSelected(null)
    setManual(null)
  }, [world])
  useEffect(() => {
    Object.assign(sim.plants[0], dials)
  }, [sim, dials])
  // The map keeps clear of whatever the title and the footer take up at this size.
  useEffect(() => {
    const title = titleRef.current
    const foot = footRef.current
    if (!title || !foot || !size.height) return
    pads.current = {
      t: title.offsetTop + title.offsetHeight + 18,
      short: title.offsetTop + 40,
      b: size.height - foot.offsetTop + (compact ? 30 : 34),
      clear: title.offsetLeft + (title.firstElementChild as HTMLElement).offsetWidth + 20,
    }
  }, [size.width, size.height, compact, ready])
  useEffect(() => {
    sim.agentOn = agentOn
  }, [sim, agentOn])

  useEffect(() => {
    let alive = true
    Promise.race([
      Promise.all([document.fonts.load("800 40px 'Bricolage Grotesque Variable'"), document.fonts.load("500 12px 'IBM Plex Mono'")]),
      new Promise((r) => setTimeout(r, 2500)),
    ])
      .catch(() => null)
      .then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target instanceof HTMLElement && e.target.closest('button, input, a, [role="dialog"]'))) return
      e.preventDefault()
      setPaused((p) => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choose = (order: Order | null, pinned: boolean) => {
    sel.current = { order, pinned, hold: 0 }
    setSelected(order)
    setManual(null)
  }

  const draw = (now: number) => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx || !size.width) return
    const dpr = cappedDpr(2)
    const w = size.width
    const h = size.height
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    const pad = { ...pads.current, l: compact ? 26 : 48, r: compact ? 26 : 48 }
    // With room to spare the map sits to the right of the title; otherwise it drops below it.
    let s = Math.max(120, Math.min(w - pad.l - pad.r, h - pad.short - pad.b))
    let ox = w - pad.r - s
    if (compact || ox < pad.clear) {
      s = Math.max(120, Math.min(w - pad.l - pad.r, h - pad.t - pad.b))
      ox = pad.l + (w - pad.l - pad.r - s) / 2
    } else {
      pad.t = pad.short
      ox -= Math.min(40, (ox - pad.clear) / 2)
    }
    const oy = pad.t + (h - pad.t - pad.b - s) / 2
    view.current = { ox, oy, s }
    const X = (u: number) => ox + u * s
    const Y = (u: number) => oy + u * s

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'butt'

    // The territory: a dotted grid, with ticks at the corners of the mapped square.
    const g = s / 12
    ctx.fillStyle = `rgba(${CREAM}, 0.16)`
    for (let x = ox - Math.ceil(ox / g) * g; x < w; x += g) for (let y = oy - Math.ceil(oy / g) * g; y < h; y += g) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5)
    ctx.strokeStyle = `rgba(${CREAM}, 0.5)`
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const [cx, cy, dx, dy] of [
      [0, 0, 1, 1],
      [1, 0, -1, 1],
      [0, 1, 1, -1],
      [1, 1, -1, -1],
    ]) {
      ctx.moveTo(X(cx) + dx * 14, Y(cy))
      ctx.lineTo(X(cx), Y(cy))
      ctx.lineTo(X(cx), Y(cy) + dy * 14)
    }
    ctx.stroke()

    // Your reach, with its handle.
    const yx = X(you.x)
    const yy = Y(you.y)
    const rr = you.reach * s
    ctx.beginPath()
    ctx.arc(yx, yy, rr, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${YELLOW}, ${sim.agentOn ? 0.08 : 0.03})`
    ctx.fill()
    ctx.setLineDash([5, 5])
    ctx.lineDashOffset = -now / 90
    ctx.strokeStyle = `rgba(${YELLOW}, ${sim.agentOn ? 0.95 : 0.4})`
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = `500 10px ${MONO}`
    ctx.textBaseline = 'middle'
    // The grip stays where it was last held, or moves to a clear stretch of the ring that is still on screen.
    const ha = [grip.current, -0.07, -1.08, 3.35, -1.83, 0.3, 2.2].find((a) => {
      const x = yx + Math.cos(a) * rr
      const y = yy + Math.sin(a) * rr
      return drag.current || (x > 16 && x < w - 16 && y > pad.t - 34 && y < h - pad.b + 12)
    })
    if (ha !== undefined) {
      const hx = yx + Math.cos(ha) * rr
      const hy = yy + Math.sin(ha) * rr
      ctx.fillStyle = `rgb(${YELLOW})`
      ctx.beginPath()
      ctx.arc(hx, hy, drag.current ? 9 : 6.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#1f2bd6'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(hx - 3, hy)
      ctx.lineTo(hx + 3, hy)
      ctx.stroke()
      const flip = hx + 92 > w
      ctx.textAlign = flip ? 'right' : 'left'
      ctx.fillStyle = `rgb(${YELLOW})`
      ctx.fillText(`REACH ${you.reach.toFixed(2)}`, hx + (flip ? -13 : 13), hy - 1)
    }

    // Bids in flight on every open round.
    for (const o of sim.open) {
      const top = leader(o)
      for (const b of o.bids) {
        const p = sim.plants[b.plant]
        const k = clamp((sim.t - b.at) / 0.35)
        const px = X(p.x)
        const py = Y(p.y)
        ctx.strokeStyle = b.plant === 0 ? `rgba(${YELLOW}, ${b === top ? 1 : 0.6})` : `rgba(${CREAM}, ${b === top ? 0.85 : 0.28})`
        ctx.lineWidth = b === top ? 2 : 1
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + (X(o.x) - px) * k, py + (Y(o.y) - py) * k)
        ctx.stroke()
      }
    }

    // Orders: a shape per product, a ring that runs down with the round.
    for (const o of sim.open) {
      const x = X(o.x)
      const y = Y(o.y)
      const r = 4 + Math.sqrt(o.qty) / 5
      const near = Math.hypot(o.x - you.x, o.y - you.y) <= you.reach
      const born = clamp((sim.t - o.open) / 0.3)
      ctx.fillStyle = near ? `rgb(${YELLOW})` : `rgb(${CREAM})`
      ctx.beginPath()
      if (o.product === 0) ctx.arc(x, y, r * born, 0, Math.PI * 2)
      else if (o.product === 1) ctx.rect(x - r * 0.88 * born, y - r * 0.88 * born, r * 1.76 * born, r * 1.76 * born)
      else {
        ctx.moveTo(x, y - r * 1.15 * born)
        ctx.lineTo(x + r * 1.1 * born, y + r * 0.8 * born)
        ctx.lineTo(x - r * 1.1 * born, y + r * 0.8 * born)
        ctx.closePath()
      }
      ctx.fill()
      const left = clamp((o.close - sim.t) / (o.close - o.open))
      ctx.strokeStyle = `rgba(${CREAM}, 0.9)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
      ctx.stroke()
      if (o === sel.current.order) {
        ctx.strokeStyle = `rgb(${CREAM})`
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          ctx.moveTo(x + dx * (r + 11), y + dy * (r + 11))
          ctx.lineTo(x + dx * (r + 19), y + dy * (r + 19))
        }
        ctx.stroke()
        ctx.fillStyle = `rgb(${CREAM})`
        ctx.textAlign = 'center'
        ctx.fillText(`#${String(o.id).padStart(3, '0')}`, x, y - r - 27)
      }
    }

    // Rounds that just closed: the job travels to whoever won it.
    world.fx = world.fx.filter((f) => now - f.t0 < (f.kind === 'gain' ? 1500 : 900))
    for (const f of world.fx) {
      const k = (now - f.t0) / (f.kind === 'gain' ? 1500 : 900)
      const x = X(f.x)
      const y = Y(f.y)
      if (k < 0) continue
      if (f.kind === 'gain') {
        ctx.font = '800 15px "Bricolage Grotesque Variable", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(${YELLOW}, ${1 - k * k})`
        ctx.fillText(f.text, x, y - 24 - k * 26)
        ctx.font = `500 10px ${MONO}`
        continue
      }
      ctx.strokeStyle = `rgba(${CREAM}, ${0.8 * (1 - k)})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, 8 + k * 26, 0, Math.PI * 2)
      ctx.stroke()
      if (f.kind === 'void') continue
      const p = sim.plants[f.plant]
      const e = 1 - Math.pow(1 - clamp(k / 0.75), 3)
      const col = f.plant === 0 ? YELLOW : CREAM
      ctx.strokeStyle = `rgba(${col}, ${0.9 * (1 - k)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(X(p.x), Y(p.y))
      ctx.stroke()
      ctx.fillStyle = `rgb(${col})`
      ctx.fillRect(x + (X(p.x) - x) * e - 4, y + (Y(p.y) - y) * e - 4, 8, 8)
    }

    // Plants, each with the backlog on its press.
    ctx.textAlign = 'center'
    for (const p of sim.plants) {
      const x = X(p.x)
      const y = Y(p.y)
      const mine = p.id === 0
      const col = mine ? YELLOW : CREAM
      const half = mine ? 9 : 6.5
      ctx.lineWidth = 1.5
      ctx.strokeStyle = `rgb(${col})`
      ctx.fillStyle = `rgb(${col})`
      if (p.down) {
        ctx.fillStyle = '#1f2bd6'
        ctx.fillRect(x - half, y - half, half * 2, half * 2)
        ctx.strokeRect(x - half, y - half, half * 2, half * 2)
        ctx.beginPath()
        ctx.moveTo(x - half, y - half)
        ctx.lineTo(x + half, y + half)
        ctx.moveTo(x + half, y - half)
        ctx.lineTo(x - half, y + half)
        ctx.stroke()
      } else {
        ctx.fillRect(x - half, y - half, half * 2, half * 2)
      }
      ctx.fillStyle = `rgb(${col})`
      ctx.fillText(p.down ? `${p.name.toUpperCase()} · DOWN` : p.name.toUpperCase(), x, y + half + 12)
      const load = clamp((p.busyUntil - sim.t) / BACKLOG)
      ctx.strokeStyle = `rgba(${col}, 0.45)`
      ctx.lineWidth = 1
      ctx.strokeRect(x - 20.5, y + half + 20.5, 41, 5)
      ctx.fillRect(x - 20, y + half + 21, 40 * load, 4)
    }
  }

  useRaf((dt) => {
    const now = performance.now()
    if (!paused && !sim.done && ready) {
      acc.current += dt * speed
      let n = 0
      while (acc.current >= STEP && n++ < 40) {
        acc.current -= STEP
        step(sim)
        step(ghost)
      }
      ghost.events.length = 0
      for (const e of sim.events) {
        if (e.type !== 'close') continue
        const o = e.order
        world.fx.push({ kind: o.state === 'void' ? 'void' : 'win', x: o.x, y: o.y, plant: o.winner, t0: now, text: '' })
        if (o.winner === 0) {
          const b = o.bids.find((x) => x.plant === 0)!
          world.fx.push({ kind: 'gain', x: you.x, y: you.y, plant: 0, t0: now + 500, text: `+${money(b.price - b.cost)}` })
        }
        if (o === sel.current.order) sel.current.hold = now + (sel.current.pinned ? 4200 : 2000)
      }
      sim.events.length = 0
      // Nothing chosen, or the chosen round is over: follow the freshest round you could reach.
      const cur = sel.current
      if (!cur.order || (cur.order.state !== 'open' && now > cur.hold)) {
        const next = [...sim.open].reverse().find((o) => Math.hypot(o.x - you.x, o.y - you.y) <= you.reach) ?? sim.open[sim.open.length - 1]
        if (next && next !== cur.order) choose(next, false)
      }
    }
    draw(now)
    if (now - lastTick.current > 110) {
      lastTick.current = now
      setTick((t) => t + 1)
    }
  })

  const local = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const { ox, oy, s } = view.current
    return { u: (e.clientX - r.left - ox) / s, v: (e.clientY - r.top - oy) / s, s }
  }
  const onReach = (u: number, v: number, s: number) => Math.abs(Math.hypot(u - you.x, v - you.y) - you.reach) * s < (coarse ? 24 : 12)
  const orderAt = (u: number, v: number, s: number) =>
    sim.open.reduce<Order | null>((best, o) => {
      const d = Math.hypot(o.x - u, o.y - v)
      return d * s < 30 && (!best || d < Math.hypot(best.x - u, best.y - v)) ? o : best
    }, null)
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const { u, v, s } = local(e)
    const hit = orderAt(u, v, s)
    if (hit) {
      choose(hit, true)
      if (compact) setTab('round')
    } else if (onReach(u, v, s)) {
      drag.current = true
      grip.current = Math.atan2(v - you.y, u - you.x)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const { u, v, s } = local(e)
    if (drag.current) {
      grip.current = Math.atan2(v - you.y, u - you.x)
      const reach = Math.round(clamp(Math.hypot(u - you.x, v - you.y), 0.15, 1) * 100) / 100
      setDials((d) => (d.reach === reach ? d : { ...d, reach }))
    } else if (!coarse) {
      e.currentTarget.style.cursor = orderAt(u, v, s) ? 'pointer' : onReach(u, v, s) ? 'grab' : ''
    }
  }
  const onUp = () => {
    drag.current = false
  }

  const restart = (nextSeed: number) => {
    setPaused(false)
    if (nextSeed === seed) setRun((r) => r + 1)
    else setSeed(nextSeed)
  }

  /* ---------- derived, read fresh on every tick ---------- */
  const stock = ghost.plants[0]
  const lead = you.profit - stock.profit
  const n = Math.max(SHIFT / 2, 1)
  const all = [...sim.series, ...ghost.series]
  const lo = Math.min(0, ...all)
  const hi = Math.max(60, ...all)
  const ranked = [...sim.plants].sort((a, b) => b.profit - a.profit)
  const rank = ranked.indexOf(you) + 1
  const weights = sim.scenario.weights

  const o = selected
  const q = o ? quote(sim, you, o) : null
  const mine = o?.bids.find((b) => b.plant === 0) ?? null
  const top = o ? leader(o) : null
  const floor = q ? Math.ceil(q.cost) : 0
  const ask = o && q ? clamp(manual ?? mine?.price ?? q.price, Math.min(floor, o.ceiling), o.ceiling) : 0
  const preview = o && q ? score(sim, o, ask, q) : null
  const bids = o ? [...o.bids].sort((a, b) => b.total - a.total) : []
  const outOfReach = !!q && q.dist > you.reach

  const hud = (
    <div className="rd-hud">
      <div className="rd-clock">
        <span>Shift {clock(Math.min(sim.t, SHIFT))}</span>
        <i>
          <b style={{ transform: `scaleX(${clamp(sim.t / SHIFT)})` }} />
        </i>
        <span>{clock(SHIFT)}</span>
      </div>
      <div className="rd-score">
        <div>
          <span>You</span>
          <b>{money(you.profit)}</b>
        </div>
        <div className="rd-score__stock">
          <span>{compact ? 'Stock' : 'Stock agent'}</span>
          <b>{money(stock.profit)}</b>
        </div>
        <em data-sign={lead > 0.5 ? 'up' : lead < -0.5 ? 'down' : undefined}>
          {lead > 0.5 ? 'ahead ' : lead < -0.5 ? 'behind ' : 'level'}
          {Math.abs(lead) > 0.5 && money(Math.abs(lead))}
        </em>
        <svg viewBox="0 0 220 44" preserveAspectRatio="none" aria-hidden="true">
          <polyline className="rd-line rd-line--stock" points={line(ghost.series, lo, hi, n)} />
          <polyline className="rd-line" points={line(sim.series, lo, hi, n)} />
        </svg>
      </div>
    </div>
  )

  const transport = (
    <div className="rd-transport">
      <button className="rd-chip rd-chip--icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume the market' : 'Pause the market'} aria-pressed={paused}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          {paused ? <path d="M2.5 1v10l8-5z" fill="currentColor" /> : <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" />}
        </svg>
      </button>
      <div className="rd-seg" role="group" aria-label="Speed">
        {[1, 2, 4, 8].map((v) => (
          <button key={v} aria-pressed={speed === v} onClick={() => setSpeed(v)}>
            {v}×
          </button>
        ))}
      </div>
    </div>
  )

  const market = (
    <div className="rd-market">
      <div className="rd-seg rd-seg--wrap" role="group" aria-label="Scenario">
        {SCENARIOS.map((sc, i) => (
          <button key={sc.id} aria-pressed={scenario === i} onClick={() => (setScenario(i), setPaused(false))}>
            {sc.name}
          </button>
        ))}
      </div>
      <button className="rd-chip" onClick={() => restart(1000 + Math.floor(Math.random() * 8999))} aria-label="Deal a new market">
        Market #{seed} <span aria-hidden="true">↻</span>
      </button>
      <p>
        {sim.scenario.note} Scoring: price {weights.price}, distance {weights.dist}, speed {weights.speed}.
      </p>
    </div>
  )

  const bar = (parts: { price: number; dist: number; speed: number }) => (
    <i className="rd-bar">
      <b style={{ width: `${parts.price}%` }} />
      <b style={{ width: `${parts.dist}%` }} />
      <b style={{ width: `${parts.speed}%` }} />
    </i>
  )

  const round = !o ? (
    <div className="rd-card rd-card--empty">
      <h2>Waiting for the first order</h2>
      <p>Each order opens an eight-second round. Plants bid, the market scores every bid, and the best score takes the job.</p>
    </div>
  ) : (
    <div className="rd-card" data-state={o.state}>
      <header>
        <span>Round #{String(o.id).padStart(3, '0')}</span>
        <em>{o.state === 'open' ? `closes in ${Math.max(0, o.close - sim.t).toFixed(1)}s` : o.state === 'void' ? 'no bids' : `won by ${sim.plants[o.winner].name}`}</em>
      </header>
      <h2>
        {o.qty.toLocaleString('en')} {PRODUCTS[o.product]}
      </h2>
      <i className="rd-timer">
        <b style={{ transform: `scaleX(${o.state === 'open' ? clamp((o.close - sim.t) / (o.close - o.open)) : 0})` }} />
      </i>
      <dl>
        <div>
          <dt>Ceiling</dt>
          <dd>{money(o.ceiling)}</dd>
        </div>
        <div>
          <dt>Due in</dt>
          <dd>{o.due.toFixed(0)}s</dd>
        </div>
        <div>
          <dt>From you</dt>
          <dd data-warn={outOfReach || undefined}>{q!.dist.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Your cost</dt>
          <dd>{money(mine && o.state !== 'open' ? mine.cost : q!.cost)}</dd>
        </div>
      </dl>
      <ul className="rd-bids">
        {bids.length === 0 && <li className="rd-bids__none">{o.state === 'open' ? 'No bids yet.' : 'Nobody bid. The order went unfilled.'}</li>}
        {bids.map((b, i) => (
          <li key={b.plant} data-you={b.plant === 0 || undefined} data-top={i === 0 || undefined}>
            <span>
              {sim.plants[b.plant].name}
              {b.manual && <small> by hand</small>}
            </span>
            <span>{money(b.price)}</span>
            {bar(b.parts)}
            <b>{b.total.toFixed(1)}</b>
          </li>
        ))}
      </ul>
      {o.state === 'open' ? (
        <div className="rd-manual">
          <label htmlFor="rd-ask">
            <span>Bid by hand</span>
            <b>{money(ask)}</b>
            <em data-sign={ask - q!.cost >= 0 ? 'up' : 'down'}>
              {ask - q!.cost >= 0 ? '+' : ''}
              {money(ask - q!.cost)} margin
            </em>
          </label>
          <div className="rd-range" style={{ '--v': (ask - Math.min(floor, o.ceiling)) / Math.max(1, o.ceiling - Math.min(floor, o.ceiling)) } as CSSProperties}>
            <input
              id="rd-ask"
              type="range"
              min={Math.min(floor, o.ceiling)}
              max={o.ceiling}
              step={1}
              value={Math.round(ask)}
              onChange={(e) => (setManual(Number(e.target.value)), (sel.current.pinned = true))}
            />
          </div>
          <div className="rd-manual__row">
            <p>
              Scores <b>{preview!.total.toFixed(1)}</b>
              {top && top.plant !== 0 ? ` against ${top.total.toFixed(1)} from ${sim.plants[top.plant].name}` : top ? ', and you lead' : ' with no rival in yet'}.
              {outOfReach && !mine && ' Your agent sits this one out: it is beyond your reach.'}
            </p>
            <button
              className="rd-btn"
              onClick={() => {
                if (placeBid(sim, o, ask)) {
                  sel.current.pinned = true
                  setManual(null)
                }
              }}
            >
              {mine ? 'Rebid' : 'Place bid'}
            </button>
          </div>
        </div>
      ) : (
        <p className="rd-verdict" data-won={o.winner === 0 || undefined}>
          {o.winner === 0
            ? `Yours, for ${money(mine!.price)}. That is ${money(mine!.price - mine!.cost)} over cost.`
            : mine && top
              ? `You lost by ${(top.total - mine.total).toFixed(1)} points${mine.parts.speed === 0 ? '. Your press could not meet the deadline.' : mine.parts.price < top.parts.price ? '. Price was the gap.' : '. You were cheaper, but further or slower.'}`
              : o.state === 'void'
                ? 'No plant could take it under the ceiling.'
                : outOfReach
                  ? 'Outside your reach, so your agent did not bid.'
                  : 'You did not bid on this one.'}
        </p>
      )}
      <footer>
        <span>
          <i className="rd-key rd-key--price" /> Price {weights.price}
        </span>
        <span>
          <i className="rd-key rd-key--dist" /> Distance {weights.dist}
        </span>
        <span>
          <i className="rd-key rd-key--speed" /> Speed {weights.speed}
        </span>
      </footer>
    </div>
  )

  const feed = (
    <ul className="rd-feed">
      {sim.closed.slice(0, compact ? 4 : 5).map((c) => (
        <li key={c.id}>
          <button onClick={() => choose(c, true)} data-on={c === o || undefined} data-won={c.winner === 0 || undefined}>
            <span>#{String(c.id).padStart(3, '0')}</span>
            <span>
              {c.qty} {PRODUCTS[c.product]}
            </span>
            <b>{c.state === 'void' ? 'unfilled' : sim.plants[c.winner].name}</b>
          </button>
        </li>
      ))}
    </ul>
  )

  const dial = (key: keyof Dials, label: string, min: number, max: number, stepBy: number, show: (v: number) => string, note: string) => (
    <div className="rd-dial">
      <label htmlFor={`rd-${key}`}>
        <span>{label}</span>
        <b>{show(dials[key])}</b>
      </label>
      <div className="rd-range" data-stock style={{ '--v': (dials[key] - min) / (max - min), '--stock': (STOCK[key] - min) / (max - min) } as CSSProperties}>
        <input id={`rd-${key}`} type="range" min={min} max={max} step={stepBy} value={dials[key]} onChange={(e) => setDials((d) => ({ ...d, [key]: Number(e.target.value) }))} />
      </div>
      <p>{note}</p>
    </div>
  )
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const agent = (
    <div className="rd-agent">
      <div className="rd-agent__head">
        <h2>Your agent</h2>
        <button className="rd-switch" role="switch" aria-checked={agentOn} onClick={() => setAgentOn((a) => !a)}>
          <i />
          {agentOn ? 'Bidding' : 'Off: by hand only'}
        </button>
      </div>
      <p className="rd-agent__note">It bids for you on every order inside your reach. The tick on each dial marks the stock setting you are playing against.</p>
      {dial('margin', 'Margin', 0.05, 0.8, 0.01, pct, 'Markup over cost when the press has work queued.')}
      {dial('reach', 'Reach', 0.15, 1, 0.01, (v) => v.toFixed(2), 'How far it will bid. Drag the yellow circle on the map.')}
      {dial('fill', 'Fill', 0, 1, 0.01, pct, 'Share of the markup it gives up to keep an idle press running.')}
      <button className="rd-btn rd-btn--ghost" onClick={() => setDials(STOCK)} disabled={dials.margin === STOCK.margin && dials.reach === STOCK.reach && dials.fill === STOCK.fill}>
        Back to stock settings
      </button>
    </div>
  )

  const board = (
    <div className="rd-board">
      <h2>Standings</h2>
      <ol>
        {ranked.map((p, i) => (
          <li key={p.id} data-you={p.id === 0 || undefined} data-down={p.down || undefined}>
            <span>{i + 1}</span>
            <span>{p.name}</span>
            <span>
              {p.wins}/{p.bids}
            </span>
            <i title="Press utilisation">
              <b style={{ transform: `scaleX(${clamp(p.util)})` }} />
            </i>
            <b>{money(p.profit)}</b>
          </li>
        ))}
      </ol>
      <p>Wins over bids, how busy each press has been, and profit so far.</p>
    </div>
  )

  const end = sim.done && (
    <div className="rd-end" role="dialog" aria-label="Shift over">
      <span>Shift over · Market #{seed}</span>
      <h2>{Math.abs(lead) < 1 ? 'Dead level with the stock agent.' : lead > 0 ? `You beat the stock agent by ${money(lead)}.` : `The stock agent beat you by ${money(-lead)}.`}</h2>
      <dl>
        <div>
          <dt>Profit</dt>
          <dd>{money(you.profit)}</dd>
        </div>
        <div>
          <dt>Rounds won</dt>
          <dd>
            {you.wins} of {you.bids}
          </dd>
        </div>
        <div>
          <dt>Standing</dt>
          <dd>{rank} of 6</dd>
        </div>
      </dl>
      <p>The same orders arrive in the same places every time this market is replayed. Only the bidding changes.</p>
      <div>
        <button className="rd-btn" onClick={() => restart(seed)}>
          Replay this market
        </button>
        <button className="rd-btn rd-btn--ghost" onClick={() => restart(1000 + Math.floor(Math.random() * 8999))}>
          Deal a new one
        </button>
      </div>
    </div>
  )

  const tabs = (
    <div className="rd-tabs" role="tablist">
      {(['round', 'agent', 'board', 'market'] as const).map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
          {t}
        </button>
      ))}
    </div>
  )

  return (
    <ExperienceShell meta={meta} ready={ready}>
      <div className="rd" data-compact={compact || undefined}>
        <section className="rd-map" ref={mapRef}>
          <canvas
            ref={canvas}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="img"
            aria-label={`Market map. ${sim.open.length} rounds open. Your plant is ${rank} of 6 with ${money(you.profit)} profit.`}
          />
          <header className="rd-title" ref={titleRef}>
            <div>
              <h1>Radius</h1>
              <p>Six plants bid for every print order. The yellow one is yours.</p>
            </div>
            {compact && transport}
          </header>
          <div className="rd-foot" ref={footRef}>
            {hud}
            {!compact && (
              <div className="rd-controls">
                {transport}
                {market}
              </div>
            )}
          </div>
          {!compact && end}
        </section>
        <aside className="rd-panel">
          {compact ? (
            <>
              {tabs}
              <div className="rd-panel__body">
                {tab === 'round' && (
                  <>
                    {round}
                    {feed}
                  </>
                )}
                {tab === 'agent' && agent}
                {tab === 'board' && board}
                {tab === 'market' && market}
              </div>
            </>
          ) : (
            <div className="rd-panel__body">
              {round}
              {feed}
              {agent}
              {board}
            </div>
          )}
        </aside>
        {compact && end}
      </div>
    </ExperienceShell>
  )
}
