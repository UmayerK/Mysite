/** Byte helpers, AES-256-GCM through WebCrypto, and the arithmetic behind the cost-of-guessing table. */

export type Bytes = Uint8Array<ArrayBuffer>

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))
export const hex = (b: number) => HEX[b]

export function randomBytes(n: number): Bytes {
  const out = new Uint8Array(n)
  crypto.getRandomValues(out)
  return out
}

export function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function base64(b: Uint8Array) {
  let s = ''
  for (const v of b) s += String.fromCharCode(v)
  return btoa(s)
}

const POP = Uint8Array.from({ length: 256 }, (_, i) => {
  let n = 0
  for (let v = i; v; v >>= 1) n += v & 1
  return n
})

/** Bits that differ between two buffers, compared over their common length. */
export function bitDiff(a: Uint8Array, b: Uint8Array) {
  const n = Math.min(a.length, b.length)
  let bits = 0
  for (let i = 0; i < n; i++) bits += POP[a[i] ^ b[i]]
  return { bits, of: n * 8 }
}

export function xor(a: Uint8Array, b: Uint8Array): Bytes {
  const out = new Uint8Array(Math.min(a.length, b.length))
  for (let i = 0; i < out.length; i++) out[i] = a[i] ^ b[i]
  return out
}

const importKey = (key: Bytes, usage: KeyUsage) => crypto.subtle.importKey('raw', key, 'AES-GCM', false, [usage])

/** Returns ciphertext with the 16-byte authentication tag appended, as WebCrypto produces it. */
export async function seal(key: Bytes, nonce: Bytes, plaintext: string): Promise<Bytes> {
  const k = await importKey(key, 'encrypt')
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, new TextEncoder().encode(plaintext)))
}

/** Null when the tag does not verify: wrong key, or any stored bit changed. */
export async function open(key: Bytes, nonce: Bytes, data: Bytes): Promise<string | null> {
  try {
    const k = await importKey(key, 'decrypt')
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, data))
  } catch {
    return null
  }
}

/** The thirty guesses of the dictionary attack: passwords that top every published breach list. */
export const DICTIONARY = [
  '123456', 'password', '123456789', 'qwerty', '12345678', '111111', 'abc123', 'password1', 'iloveyou', '1234567',
  'letmein', 'dragon', 'monkey', 'football', 'admin', 'welcome', 'login', 'princess', 'sunshine', 'master',
  'shadow', 'qwerty123', '000000', 'starwars', 'hunter2', 'trustno1', 'passw0rd', 'baseball', 'superman', 'michael',
]

export const KEYSPACES = [
  { label: '4-digit PIN', expr: '10⁴', n: 1e4 },
  { label: '6 lowercase letters', expr: '26⁶', n: 26 ** 6 },
  { label: '8 letters and digits', expr: '62⁸', n: 62 ** 8 },
  { label: '4 random words', expr: '7776⁴', n: 7776 ** 4 },
  { label: '12 random characters', expr: '94¹²', n: 94 ** 12 },
]

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).split('').map((d) => SUP[Number(d)]).join('')

/** Size of the space a password of this shape would be drawn from, if every character were random. */
export function shapeOf(password: string) {
  let set = 0
  if (/[a-z]/.test(password)) set += 26
  if (/[A-Z]/.test(password)) set += 26
  if (/[0-9]/.test(password)) set += 10
  if (/[^a-zA-Z0-9]/.test(password)) set += 33
  const len = [...password].length
  return { set, len, n: Math.pow(set, len), expr: `${set}${sup(len)}` }
}

export const YEAR = 31_557_600
export const UNIVERSE = 13.8e9 * YEAR

export function fmtDuration(s: number): string {
  if (!isFinite(s)) return 'longer than this page can count'
  if (s < 1) return 'under a second'
  if (s < 90) return `${Math.round(s)} seconds`
  if (s < 5400) return `${Math.round(s / 60)} minutes`
  if (s < 172_800) return `${Math.round(s / 3600)} hours`
  if (s < YEAR * 2) return `${Math.round(s / 86_400)} days`
  const y = s / YEAR
  if (y < 1e4) return `${Math.round(y).toLocaleString('en')} years`
  if (y < 1e6) return `${Math.round(y / 1e3)} thousand years`
  if (y < 1e9) return `${Math.round(y / 1e6)} million years`
  if (s < UNIVERSE * 2) return `${(y / 1e9).toFixed(1)} billion years`
  const u = s / UNIVERSE
  if (u < 1e6) return `${Math.round(u).toLocaleString('en')} × the age of the universe`
  return `10${sup(Math.floor(Math.log10(u)))} × the age of the universe`
}

const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
export const fmtRate = (r: number) => (r < 10 ? r.toFixed(1) : r < 1000 ? String(Math.round(r)) : compactFmt.format(r))

/** Position of a duration on the log axis of the table: one second at 0, 10²⁶ seconds at 1. */
export const LOG_MAX = 26
export const logPos = (s: number) => Math.min(1, Math.max(0, Math.log10(Math.max(s, 1)) / LOG_MAX))

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
