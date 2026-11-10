export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const invLerp = (a: number, b: number, v: number) => (v - a) / (b - a)
export const mapRange = (v: number, a: number, b: number, c: number, d: number) =>
  lerp(c, d, clamp(invLerp(a, b, v)))
/** Frame-rate independent smoothing. `lambda` ~ 4 (slow) … 20 (snappy). */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt))
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp(invLerp(a, b, v))
  return t * t * (3 - 2 * t)
}
/** Small deterministic PRNG (mulberry32). */
export const rng = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
/** Device pixel ratio capped so phones and 5K displays don't melt. */
export const cappedDpr = (max = 2) => Math.min(window.devicePixelRatio || 1, max)
