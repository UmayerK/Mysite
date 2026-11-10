import { argon2id, createSHA256 } from 'hash-wasm'
import type { Req, Res } from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope
const post = (m: Res) => ctx.postMessage(m)
const cancelled = new Set<number>()
let warm: Promise<unknown> | null = null

/** One Argon2id run. The first call also compiles the WASM module, so that is done up front and not timed. */
async function derive(password: string, salt: Uint8Array, m: number, t: number) {
  warm ??= argon2id({ password: 'warm', salt: new Uint8Array(16), parallelism: 1, iterations: 1, memorySize: 64, hashLength: 32, outputType: 'binary' })
  await warm
  const t0 = performance.now()
  const key = await argon2id({ password, salt, parallelism: 1, iterations: t, memorySize: m, hashLength: 32, outputType: 'binary' })
  return { key, ms: performance.now() - t0 }
}

/** How many salted SHA-256 guesses per second this device manages: the baseline Argon2id is compared against. */
async function benchSha() {
  const sha = await createSHA256()
  const buf = new Uint8Array(28)
  let n = 0
  const t0 = performance.now()
  while (performance.now() - t0 < 220) {
    for (let i = 0; i < 400; i++) {
      buf[0] = i
      buf[1] = n
      sha.init()
      sha.update(buf)
      sha.digest('binary')
      n++
    }
  }
  return n / ((performance.now() - t0) / 1000)
}

async function attack(r: Extract<Req, { type: 'attack' }>) {
  const t0 = performance.now()
  let tried = 0
  for (let i = 0; i < r.guesses.length; i++) {
    if (cancelled.has(r.id)) break
    const { key, ms } = await derive(r.guesses[i], r.salt, r.m, r.t)
    let plaintext: string | null = null
    try {
      const k = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['decrypt'])
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.nonce as BufferSource }, k, r.data as BufferSource)
      plaintext = new TextDecoder().decode(pt)
    } catch {
      // Wrong key: the GCM tag does not verify. This is the expected outcome for almost every guess.
    }
    tried = i + 1
    post({ type: 'guess', id: r.id, index: i, ms, plaintext })
    if (plaintext !== null) break
    // Yield so a cancel message can be delivered between guesses.
    await new Promise((res) => setTimeout(res, 0))
  }
  post({ type: 'attack-done', id: r.id, tried, ms: performance.now() - t0, cancelled: cancelled.has(r.id) })
  cancelled.delete(r.id)
}

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const r = e.data
  try {
    if (r.type === 'derive') {
      const { key, ms } = await derive(r.password, r.salt, r.m, r.t)
      post({ type: 'derived', id: r.id, tag: r.tag, key, ms })
    } else if (r.type === 'bench') {
      post({ type: 'bench', id: r.id, perSec: await benchSha() })
    } else if (r.type === 'attack') {
      await attack(r)
    } else {
      cancelled.add(r.id)
    }
  } catch (err) {
    post({ type: 'error', id: r.id, message: err instanceof Error ? err.message : String(err) })
  }
}
