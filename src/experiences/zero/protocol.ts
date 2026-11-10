/** Messages between the page and the key-derivation worker. `m` is Argon2 memory in KiB, `t` is passes. */
export type Req =
  | { type: 'derive'; id: number; tag: 'main' | 'attempt'; password: string; salt: Uint8Array; m: number; t: number }
  | { type: 'bench'; id: number }
  | { type: 'attack'; id: number; guesses: string[]; salt: Uint8Array; m: number; t: number; nonce: Uint8Array; data: Uint8Array }
  | { type: 'cancel'; id: number }

export type Res =
  | { type: 'derived'; id: number; tag: 'main' | 'attempt'; key: Uint8Array; ms: number }
  | { type: 'bench'; id: number; perSec: number }
  | { type: 'guess'; id: number; index: number; ms: number; plaintext: string | null }
  | { type: 'attack-done'; id: number; tried: number; ms: number; cancelled: boolean }
  | { type: 'error'; id: number; message: string }
