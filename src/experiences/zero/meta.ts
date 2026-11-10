import type { ExperienceMeta } from '../types'

export const meta: ExperienceMeta = {
  id: 'zero',
  index: 2,
  title: 'Zero',
  tagline: 'Encrypt a secret in your browser and see exactly what a server would see: nothing.',
  kind: 'Live cryptography, made visible',
  origin: {
    where: 'ZeroVault',
    role: 'Personal project',
    fact: 'A zero-knowledge password manager using Argon2id and AES-256-GCM client-side, so the server never sees plaintext.',
  },
  real: [
    'Argon2id runs in WebAssembly inside a Web Worker. Every derivation time on the page is measured on your device.',
    'AES-256-GCM comes from the browser’s Web Crypto API, with a fresh random 96-bit nonce for every write.',
    'Flip one stored bit and decryption really fails: the GCM tag no longer verifies.',
    'The dictionary attack performs a full key derivation and decryption attempt for each of its thirty guesses.',
    'The server is a drawing. No request leaves this tab, and the times in the table are arithmetic on a measured rate.',
  ],
  controls: [
    { input: 'Type', action: 'Change the password or the secret and watch the stored bytes turn over.' },
    { input: 'Click a byte', action: 'Flip one bit of the nonce, ciphertext or tag on the server.' },
    { input: 'Decrypt', action: 'Try to open the stored envelope with any password.' },
    { input: 'Memory / passes', action: 'Tune Argon2id and re-measure what one guess costs.' },
    { input: 'Run the list', action: 'Launch a real dictionary attack against the envelope.' },
  ],
  stack: ['Web Crypto API', 'Argon2id (WASM)', 'React', 'Motion', 'TypeScript'],
  palette: { bg: '#e9eaec', fg: '#08090a', accent: '#ff3b1f', tone: 'light' },
}
