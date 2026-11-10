import { clamp, rng } from '../../lib/math'

/** Simulated seconds per step. Everything advances in whole steps, so a seed always replays the same day. */
export const STEP = 1 / 30
export const SHIFT = 180
export const ROUND = 8
/** Seconds of queued work a press treats as "comfortably full". */
export const BACKLOG = 14
const SETUP_COST = 48
const SETUP_TIME = 1.5
const SHIP_TIME = 10
const FAR = 0.85

export const PRODUCTS = ['Cards', 'Posters', 'Boxes'] as const

export interface Dials {
  /** Markup over cost when the press is busy. */
  margin: number
  /** How far from the plant the agent will bid, in map units. */
  reach: number
  /** How much of that markup the agent gives up to keep an idle press running. */
  fill: number
}
export const STOCK: Dials = { margin: 0.22, reach: 0.55, fill: 0.5 }

export interface Weights {
  price: number
  dist: number
  speed: number
}
export interface Scenario {
  id: string
  name: string
  note: string
  weights: Weights
  /** Mean seconds between orders. */
  gap: number
  due: number
  rivalMargin: number
  /** Index of a rival whose press fails a third of the way through the shift. */
  outage: number
}
export const SCENARIOS: Scenario[] = [
  { id: 'steady', name: 'Steady', note: 'An ordinary shift. Price counts for half the score.', weights: { price: 50, dist: 25, speed: 25 }, gap: 2.5, due: 1, rivalMargin: 1, outage: -1 },
  { id: 'rush', name: 'Rush', note: 'Twice the orders, tight deadlines. Speed outweighs price.', weights: { price: 35, dist: 20, speed: 45 }, gap: 1.35, due: 0.62, rivalMargin: 1, outage: -1 },
  { id: 'war', name: 'Price war', note: 'Rivals halve their margins and price decides most rounds.', weights: { price: 60, dist: 20, speed: 20 }, gap: 2.5, due: 1, rivalMargin: 0.45, outage: -1 },
  { id: 'outage', name: 'Press down', note: 'Mill loses its press a third of the way in. Its orders need a home.', weights: { price: 50, dist: 25, speed: 25 }, gap: 2.1, due: 1, rivalMargin: 1, outage: 3 },
]

export interface Plant extends Dials {
  id: number
  name: string
  x: number
  y: number
  /** Cost per sheet, by product. */
  cost: number[]
  /** Sheets per second. */
  speed: number
  busyUntil: number
  last: number
  down: boolean
  profit: number
  revenue: number
  wins: number
  bids: number
  /** Share of recent time the press was running. */
  util: number
}

export interface Bid {
  plant: number
  price: number
  cost: number
  at: number
  manual: boolean
  parts: Weights
  total: number
}
export interface Order {
  id: number
  x: number
  y: number
  product: number
  qty: number
  ceiling: number
  due: number
  open: number
  close: number
  bids: Bid[]
  state: 'open' | 'won' | 'void'
  winner: number
  /** When each plant's agent will look at this order, fixed at arrival. */
  when: number[]
  noise: number[]
}
export type SimEvent = { type: 'order' | 'bid' | 'close'; order: Order; plant: number } | { type: 'down'; plant: number }

export interface Sim {
  seed: number
  scenario: Scenario
  t: number
  plants: Plant[]
  open: Order[]
  closed: Order[]
  events: SimEvent[]
  /** Plant 0's profit, sampled every two seconds. */
  series: number[]
  agentOn: boolean
  done: boolean
  arrivals: () => number
  nextArrival: number
  nextId: number
}

const ROSTER: [string, number, number, number[], number, Dials][] = [
  ['You', 0.47, 0.56, [0.38, 0.34, 0.42], 36, STOCK],
  ['North', 0.2, 0.2, [0.28, 0.44, 0.5], 32, { margin: 0.3, reach: 0.5, fill: 0.2 }],
  ['Harbour', 0.82, 0.25, [0.44, 0.29, 0.48], 42, { margin: 0.17, reach: 0.7, fill: 0.7 }],
  ['Mill', 0.15, 0.74, [0.42, 0.4, 0.3], 34, { margin: 0.22, reach: 0.48, fill: 0.5 }],
  ['Delta', 0.8, 0.78, [0.35, 0.37, 0.39], 30, { margin: 0.13, reach: 0.95, fill: 0.3 }],
  ['Quarry', 0.53, 0.1, [0.4, 0.38, 0.36], 38, { margin: 0.26, reach: 0.6, fill: 0.6 }],
]

export function createSim(seed: number, scenario: Scenario, dials: Dials): Sim {
  return {
    seed,
    scenario,
    t: 0,
    plants: ROSTER.map(([name, x, y, cost, speed, d], id) => ({
      id,
      name,
      x,
      y,
      cost,
      speed,
      ...(id === 0 ? dials : { ...d, margin: d.margin * scenario.rivalMargin }),
      busyUntil: 0,
      last: -1,
      down: false,
      profit: 0,
      revenue: 0,
      wins: 0,
      bids: 0,
      util: 0,
    })),
    open: [],
    closed: [],
    events: [],
    series: [0],
    agentOn: true,
    done: false,
    arrivals: rng(seed),
    nextArrival: 0.6,
    nextId: 1,
  }
}

export interface Quote {
  dist: number
  cost: number
  price: number
  eta: number
  wait: number
}
/** What an order would cost this plant right now, and what its agent would ask for it. */
export function quote(s: Sim, p: Plant, o: Order): Quote {
  const dist = Math.hypot(p.x - o.x, p.y - o.y)
  const wait = Math.max(0, p.busyUntil - s.t)
  const change = p.last !== o.product
  const cost = o.qty * p.cost[o.product] + (change ? SETUP_COST : 0) + dist * (24 + o.qty * 0.12)
  const idle = clamp(1 - wait / BACKLOG)
  const over = Math.max(0, wait / BACKLOG - 1)
  const price = cost * (1 + p.margin * (1 - p.fill * idle) + over * 0.2)
  const eta = wait + (change ? SETUP_TIME : 0) + o.qty / p.speed + dist * SHIP_TIME
  return { dist, cost, price, eta, wait }
}

/** The marketplace's side: how a bid is scored. Cheaper, closer and sooner each earn their share. */
export function score(s: Sim, o: Order, price: number, q: Quote) {
  const w = s.scenario.weights
  const parts: Weights = {
    price: w.price * clamp((o.ceiling - price) / (o.ceiling * 0.55)),
    dist: w.dist * clamp(1 - q.dist / FAR),
    speed: q.eta > o.due ? 0 : w.speed * clamp(1.15 - q.eta / o.due),
  }
  return { parts, total: parts.price + parts.dist + parts.speed }
}

export const leader = (o: Order) => o.bids.reduce<Bid | null>((best, b) => (!best || b.total > best.total ? b : best), null)

function submit(s: Sim, o: Order, p: Plant, price: number, q: Quote, manual: boolean) {
  const at = o.bids.findIndex((b) => b.plant === p.id)
  if (at >= 0) o.bids.splice(at, 1)
  else p.bids++
  const sc = score(s, o, price, q)
  o.bids.push({ plant: p.id, price, cost: q.cost, at: s.t, manual, ...sc })
  s.events.push({ type: 'bid', order: o, plant: p.id })
}

/** A bid placed by hand for plant 0. It replaces whatever the agent had in. */
export function placeBid(s: Sim, o: Order, price: number) {
  if (o.state !== 'open' || price > o.ceiling) return false
  submit(s, o, s.plants[0], price, quote(s, s.plants[0], o), true)
  return true
}

function arrive(s: Sim) {
  const r = s.arrivals
  const id = s.nextId++
  // Each order carries its own dice, so the same orders meet every plant however the day has gone.
  const own = rng(s.seed * 7919 + id * 104729)
  const product = Math.floor(r() * 3)
  const qty = Math.round((120 + r() * r() * 900) / 10) * 10
  const o: Order = {
    id,
    x: 0.06 + r() * 0.88,
    y: 0.06 + r() * 0.88,
    product,
    qty,
    ceiling: Math.round(qty * 0.76 * (0.9 + r() * 0.32) + 100),
    due: (20 + r() * 22 + qty / 60) * s.scenario.due,
    open: s.t,
    close: s.t + ROUND,
    bids: [],
    state: 'open',
    winner: -1,
    when: s.plants.map((p) => s.t + ROUND * (p.id === 0 ? 0.42 + own() * 0.2 : 0.08 + own() * 0.8)),
    noise: s.plants.map((p) => (p.id === 0 ? 1 : 0.95 + own() * 0.1)),
  }
  s.open.push(o)
  s.events.push({ type: 'order', order: o, plant: -1 })
  s.nextArrival = s.t + Math.max(0.45, -Math.log(1 - r()) * s.scenario.gap)
}

function settle(s: Sim, o: Order) {
  const best = leader(o)
  if (!best) {
    o.state = 'void'
  } else {
    const p = s.plants[best.plant]
    const q = quote(s, p, o)
    o.state = 'won'
    o.winner = p.id
    p.wins++
    p.revenue += best.price
    // The bid keeps the cost the job really ran at, which a changeover since bidding can move.
    best.cost = q.cost
    p.profit += best.price - q.cost
    p.busyUntil = Math.max(s.t, p.busyUntil) + (p.last !== o.product ? SETUP_TIME : 0) + o.qty / p.speed
    p.last = o.product
  }
  s.closed.unshift(o)
  if (s.closed.length > 40) s.closed.pop()
  s.events.push({ type: 'close', order: o, plant: o.winner })
}

export function step(s: Sim) {
  if (s.done) return
  s.t += STEP
  if (s.scenario.outage >= 0 && !s.plants[s.scenario.outage].down && s.t >= SHIFT / 3) {
    s.plants[s.scenario.outage].down = true
    s.events.push({ type: 'down', plant: s.scenario.outage })
  }
  if (s.t >= s.nextArrival && s.t < SHIFT - ROUND) arrive(s)

  for (let i = s.open.length - 1; i >= 0; i--) {
    const o = s.open[i]
    for (const p of s.plants) {
      if (o.when[p.id] > s.t) continue
      o.when[p.id] = Infinity
      if (p.down || (p.id === 0 && (!s.agentOn || o.bids.some((b) => b.plant === 0 && b.manual)))) continue
      const q = quote(s, p, o)
      const price = q.price * o.noise[p.id]
      if (q.dist <= p.reach && price <= o.ceiling) submit(s, o, p, price, q, false)
    }
    if (s.t >= o.close) {
      s.open.splice(i, 1)
      settle(s, o)
    }
  }

  for (const p of s.plants) p.util += ((p.busyUntil > s.t ? 1 : 0) - p.util) * (STEP / 12)
  if (s.t >= s.series.length * 2) s.series.push(s.plants[0].profit)
  if (s.t >= SHIFT) s.done = true
}
