import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import { ExperienceShell } from '../../shell/ExperienceShell'
import { useMediaQuery, usePrefersReducedMotion } from '../../lib/hooks'
import { meta } from './meta'
import type { Req, Res } from './protocol'
import {
  base64,
  bitDiff,
  concat,
  copyText,
  DICTIONARY,
  fmtDuration,
  fmtRate,
  hex,
  KEYSPACES,
  logPos,
  open,
  randomBytes,
  seal,
  shapeOf,
  UNIVERSE,
  xor,
  YEAR,
  type Bytes,
} from './crypto'
import './zero.css'

const MAX_SECRET = 160
const MEMORY = [9, 19, 46, 64]
const PASSES = [1, 2, 3, 4]
const RIGS = [
  { k: 1, label: '× 1' },
  { k: 1e3, label: '× 10³' },
  { k: 1e6, label: '× 10⁶' },
]
const MARKS = [
  { s: 86_400, label: 'day' },
  { s: 80 * YEAR, label: 'lifetime' },
  { s: UNIVERSE, label: 'universe' },
]
const SALT = 16
const NONCE = 12
const TAG = 16
const PANES = ['Device', 'Server', 'Attacker']

interface Attack {
  state: 'idle' | 'running' | 'done'
  tried: number
  hit: { index: number; plaintext: string } | null
  ms: number
  cancelled: boolean
}
const IDLE: Attack = { state: 'idle', tried: 0, hit: null, ms: 0, cancelled: false }

type Attempt = { state: 'idle' } | { state: 'working' } | { state: 'open'; text: string; ms: number } | { state: 'refused'; ms: number }

function Seg<T extends string | number>(props: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="zr-seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === props.value} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Head(props: { n: string; who: string; children: ReactNode }) {
  return (
    <header className="zr-head">
      <p className="zr-head__row">
        <span>{props.n}</span>
        <span>{props.who}</span>
      </p>
      <h2>{props.children}</h2>
    </header>
  )
}

/** A run of stored bytes. Cells with an `onFlip` handler are buttons that toggle the lowest bit. */
function ByteRun(props: { label: string; note: string; bytes: Uint8Array; offset: number; flips: ReadonlySet<number>; onFlip?: (i: number) => void }) {
  const { bytes, offset, flips, onFlip } = props
  return (
    <div className="zr-run">
      <p className="zr-run__label">
        <span>{props.label}</span>
        <span>{props.note}</span>
      </p>
      {bytes.length === 0 ? (
        <p className="zr-run__empty">empty</p>
      ) : (
        <div className="zr-bytes">
          {Array.from(bytes, (b, i) => {
            const at = offset + i
            const style = { animationDelay: `${Math.min(i, 80) * 5}ms` }
            return onFlip ? (
              <button
                key={`${i}-${b}`}
                type="button"
                style={style}
                data-flipped={flips.has(at) || undefined}
                aria-pressed={flips.has(at)}
                aria-label={`${props.label} byte ${i + 1}, ${hex(b)}. Flip one bit`}
                onClick={() => onFlip(at)}
              >
                {hex(b)}
              </button>
            ) : (
              <span key={`${i}-${b}`} style={style}>
                {hex(b)}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Zero() {
  const compact = useMediaQuery('(max-width: 980px)')
  const reduced = usePrefersReducedMotion()

  const [password, setPassword] = useState('correct horse battery staple')
  const [showPw, setShowPw] = useState(true)
  const [secret, setSecret] = useState('Vault door code: 4471. Tell no one.')
  const [mem, setMem] = useState(19)
  const [passes, setPasses] = useState(2)
  const [salt, setSalt] = useState<Bytes>(() => randomBytes(SALT))

  const [key, setKey] = useState<Bytes | null>(null)
  const [keyDelta, setKeyDelta] = useState<Bytes | null>(null)
  const [revealKey, setRevealKey] = useState(false)
  const [deriveMs, setDeriveMs] = useState<number | null>(null)
  const [deriving, setDeriving] = useState(true)
  const [sealMs, setSealMs] = useState<number | null>(null)
  const [env, setEnv] = useState<{ nonce: Bytes; data: Bytes } | null>(null)
  const [writeDiff, setWriteDiff] = useState<{ bits: number; of: number } | null>(null)
  const [writes, setWrites] = useState(0)
  const [flips, setFlips] = useState<ReadonlySet<number>>(new Set())
  const [readable, setReadable] = useState<boolean | null>(null)

  const [guess, setGuess] = useState('')
  const [attempt, setAttempt] = useState<Attempt>({ state: 'idle' })
  const [view, setView] = useState<'bytes' | 'json'>('bytes')
  const [copied, setCopied] = useState(false)

  const [shaRate, setShaRate] = useState<number | null>(null)
  const [kdf, setKdf] = useState<'argon' | 'sha'>('argon')
  const [rig, setRig] = useState(1)
  const [attack, setAttack] = useState<Attack>(IDLE)

  const [booted, setBooted] = useState(false)
  const [fault, setFault] = useState<string | null>(null)
  const [pane, setPane] = useState(0)

  const worker = useRef<Worker | null>(null)
  const seq = useRef(0)
  const attemptSeq = useRef(0)
  const attackSeq = useRef(0)
  const keyRef = useRef<Bytes | null>(null)
  const lastWrite = useRef<Bytes | null>(null)
  const storedRef = useRef<Bytes | null>(null)
  const onMessage = useRef<(m: Res) => void>(() => {})
  const pager = useRef<HTMLDivElement>(null)
  const tabs = useRef<HTMLDivElement>(null)

  const send = (m: Req) => worker.current?.postMessage(m)

  // What the server holds: salt | nonce | ciphertext | tag, with any tampering applied.
  const stored = useMemo(() => {
    if (!env) return null
    const all = concat(salt, env.nonce, env.data)
    for (const i of flips) all[i] ^= 1
    return all
  }, [salt, env, flips])
  storedRef.current = stored
  const ctLen = env ? env.data.length - TAG : 0

  onMessage.current = (m) => {
    if (m.type === 'derived') {
      const k = new Uint8Array(m.key)
      if (m.tag === 'main') {
        if (m.id !== seq.current) return
        setKeyDelta(keyRef.current ? xor(keyRef.current, k) : null)
        keyRef.current = k
        setKey(k)
        setDeriveMs(m.ms)
        setDeriving(false)
        setBooted(true)
      } else if (m.id === attemptSeq.current) {
        const s = storedRef.current
        if (!s) return setAttempt({ state: 'idle' })
        void open(k, s.slice(SALT, SALT + NONCE), s.slice(SALT + NONCE)).then((text) => {
          if (m.id !== attemptSeq.current) return
          setAttempt(text === null ? { state: 'refused', ms: m.ms } : { state: 'open', text, ms: m.ms })
        })
      }
    } else if (m.type === 'bench') {
      setShaRate(m.perSec)
    } else if (m.type === 'guess') {
      if (m.id !== attackSeq.current) return
      setAttack((a) => ({ ...a, tried: m.index + 1, hit: m.plaintext === null ? null : { index: m.index, plaintext: m.plaintext } }))
    } else if (m.type === 'attack-done') {
      if (m.id !== attackSeq.current) return
      setAttack((a) => ({ ...a, state: 'done', ms: m.ms, cancelled: m.cancelled }))
    } else {
      setFault(m.message)
      setDeriving(false)
      setBooted(true)
    }
  }

  useEffect(() => {
    const w = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<Res>) => onMessage.current(e.data)
    w.onerror = () => {
      setFault('The key-derivation worker could not start in this browser.')
      setBooted(true)
    }
    w.postMessage({ type: 'bench', id: 0 } satisfies Req)
    const fallback = window.setTimeout(() => setBooted(true), 6000)
    return () => {
      window.clearTimeout(fallback)
      w.terminate()
      worker.current = null
    }
  }, [])

  const resetAttack = useCallback(() => {
    send({ type: 'cancel', id: attackSeq.current })
    attackSeq.current++
    setAttack(IDLE)
  }, [])

  // Password, salt or cost changed: derive the key again. Debounced, because one run is deliberately slow.
  const first = useRef(true)
  useEffect(() => {
    const id = ++seq.current
    if (!password) {
      keyRef.current = null
      setKey(null)
      setKeyDelta(null)
      setDeriving(false)
      return
    }
    setDeriving(true)
    const h = window.setTimeout(
      () => send({ type: 'derive', id, tag: 'main', password, salt, m: mem * 1024, t: passes }),
      first.current ? 0 : 280,
    )
    first.current = false
    return () => window.clearTimeout(h)
  }, [password, salt, mem, passes])

  // Key or secret changed: write a new envelope under a fresh nonce.
  useEffect(() => {
    resetAttack()
    setAttempt({ state: 'idle' })
    attemptSeq.current++
    if (!key) {
      setEnv(null)
      setFlips(new Set())
      return
    }
    let dead = false
    const nonce = randomBytes(NONCE)
    const t0 = performance.now()
    void seal(key, nonce, secret).then((data) => {
      if (dead) return
      const wire = concat(nonce, data)
      setSealMs(performance.now() - t0)
      setWriteDiff(lastWrite.current ? bitDiff(lastWrite.current, wire) : null)
      lastWrite.current = wire
      setEnv({ nonce, data })
      setFlips(new Set())
      setWrites((n) => n + 1)
    })
    return () => {
      dead = true
    }
  }, [key, secret, resetAttack])

  // Can the device, holding the key, still read what the server holds?
  useEffect(() => {
    if (!key || !stored) return setReadable(null)
    let dead = false
    void open(key, stored.slice(SALT, SALT + NONCE), stored.slice(SALT + NONCE)).then((text) => {
      if (!dead) setReadable(text !== null)
    })
    return () => {
      dead = true
    }
  }, [key, stored])

  const flip = (i: number) => {
    setAttempt({ state: 'idle' })
    setFlips((prev) => {
      const next = new Set(prev)
      if (!next.delete(i)) next.add(i)
      return next
    })
  }

  const tryOpen = (e?: FormEvent, withPassword = guess) => {
    e?.preventDefault()
    if (!withPassword || !stored) return
    const id = ++attemptSeq.current
    setAttempt({ state: 'working' })
    send({ type: 'derive', id, tag: 'attempt', password: withPassword, salt, m: mem * 1024, t: passes })
  }

  const runAttack = () => {
    if (!env) return
    const id = ++attackSeq.current
    setAttack({ ...IDLE, state: 'running' })
    send({ type: 'attack', id, guesses: DICTIONARY, salt, m: mem * 1024, t: passes, nonce: env.nonce, data: env.data })
  }

  const envelope = useMemo(() => {
    if (!stored) return ''
    return JSON.stringify(
      {
        v: 1,
        kdf: { alg: 'argon2id', m: mem * 1024, t: passes, p: 1, salt: base64(stored.slice(0, SALT)) },
        aead: { alg: 'A256GCM', nonce: base64(stored.slice(SALT, SALT + NONCE)) },
        ciphertext: base64(stored.slice(SALT + NONCE, stored.length - TAG)),
        tag: base64(stored.slice(stored.length - TAG)),
      },
      null,
      2,
    )
  }, [stored, mem, passes])

  const copy = async () => {
    if (!envelope) return
    if (await copyText(envelope)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  // Compact layout: the three actors are pages of a horizontal pager; the tab indicator follows the finger.
  useEffect(() => {
    const el = pager.current
    if (!compact || !el) return
    const onScroll = () => {
      const p = el.scrollLeft / Math.max(1, el.clientWidth)
      tabs.current?.style.setProperty('--p', p.toFixed(3))
      setPane(Math.round(p))
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [compact])
  const goPane = (i: number) => {
    const el = pager.current
    el?.scrollTo({ left: i * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  const deltaBits = keyDelta ? bitDiff(keyDelta, new Uint8Array(32)).bits : null
  const shape = shapeOf(password)
  const listed = DICTIONARY.includes(password)
  const rate = kdf === 'argon' ? (deriveMs ? (1000 / deriveMs) * rig : null) : shaRate ? shaRate * rig : null
  const ratio = deriveMs && shaRate ? shaRate / (1000 / deriveMs) : null
  const running = attack.state === 'running'
  const attackRate = attack.ms > 0 ? attack.tried / (attack.ms / 1000) : null
  const pop = reduced ? { duration: 0 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const }

  const device = (
    <section className="zr-pane zr-pane--device" aria-label="This device">
      <Head n="01" who="This device">
        You hold
        <br />
        the key.
      </Head>

      <div className="zr-field">
        <label htmlFor="zr-pw">
          <span>Master password</span>
          <button type="button" className="zr-link" onClick={() => setShowPw((v) => !v)} aria-pressed={!showPw}>
            {showPw ? 'Hide' : 'Show'}
          </button>
        </label>
        <input
          id="zr-pw"
          type={showPw ? 'text' : 'password'}
          value={password}
          maxLength={64}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Type a password"
        />
      </div>

      <div className="zr-field">
        <label htmlFor="zr-secret">
          <span>Secret</span>
          <span>
            {new TextEncoder().encode(secret).length} B
          </span>
        </label>
        <textarea
          id="zr-secret"
          rows={2}
          value={secret}
          maxLength={MAX_SECRET}
          spellCheck={false}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Something worth hiding"
        />
      </div>

      <div className="zr-key" data-busy={deriving || undefined}>
        <div className="zr-key__matrix" role="img" aria-label="The 256-bit key drawn as a 16 by 16 grid of bits">
          {Array.from({ length: 256 }, (_, i) => {
            const on = key ? (key[i >> 3] >> (7 - (i & 7))) & 1 : 0
            const changed = keyDelta ? (keyDelta[i >> 3] >> (7 - (i & 7))) & 1 : 0
            return <i key={i} data-on={on || undefined} data-changed={changed || undefined} />
          })}
        </div>
        <div className="zr-key__side">
          <p className="zr-label">256-bit key</p>
          <p className="zr-key__state" aria-live="polite">
            {fault ? (
              <em>{fault}</em>
            ) : !password ? (
              'No password, no key.'
            ) : deriving ? (
              <>Deriving. Argon2id is filling {mem} MiB.</>
            ) : (
              <>
                Derived in <b>{Math.round(deriveMs ?? 0)} ms</b>
                {sealMs !== null && (
                  <>
                    , sealed in <b>{sealMs < 1 ? sealMs.toFixed(1) : Math.round(sealMs)} ms</b>
                  </>
                )}
                .
              </>
            )}
          </p>
          {deltaBits !== null && !deriving && (
            <p className="zr-key__delta">
              <b>{deltaBits}</b> of 256 bits changed by your last edit.
            </p>
          )}
          <p className="zr-key__hex">
            {key ? (revealKey ? Array.from(key.slice(0, 16), hex).join(' ') + ' …' : '•• •• •• •• •• •• •• •• …') : '—'}
            {key && (
              <button type="button" className="zr-link" onClick={() => setRevealKey((v) => !v)} aria-pressed={revealKey}>
                {revealKey ? 'Mask' : 'Reveal'}
              </button>
            )}
          </p>
          <p className="zr-fine">Argon2id · {mem} MiB · {passes} {passes === 1 ? 'pass' : 'passes'} · never transmitted</p>
        </div>
      </div>

      <div className="zr-open">
        <p className="zr-status" data-bad={readable === false || undefined} aria-live="polite">
          <i />
          {readable === null
            ? 'Nothing stored yet.'
            : readable
              ? 'Holding the key, this device can read what the server stores.'
              : 'Tag mismatch. The stored bytes were changed, so decryption is refused.'}
        </p>
        <form className="zr-try" onSubmit={tryOpen}>
          <label className="zr-label" htmlFor="zr-guess">
            Open it from scratch
          </label>
          <div className="zr-try__row">
            <input
              id="zr-guess"
              type="text"
              value={guess}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Any password"
              onChange={(e) => {
                setGuess(e.target.value)
                setAttempt({ state: 'idle' })
              }}
            />
            <button type="submit" className="zr-btn zr-btn--solid" disabled={!guess || !stored || attempt.state === 'working'}>
              {attempt.state === 'working' ? 'Deriving' : 'Decrypt'}
            </button>
          </div>
          <div className="zr-try__quick">
            <button
              type="button"
              className="zr-link"
              disabled={!password}
              onClick={() => {
                setGuess(password)
                tryOpen(undefined, password)
              }}
            >
              Use the right one
            </button>
            <button
              type="button"
              className="zr-link"
              disabled={!password}
              onClick={() => {
                const wrong = password.slice(0, -1) + (password.endsWith('x') ? 'y' : 'x')
                setGuess(wrong)
                tryOpen(undefined, wrong)
              }}
            >
              Use one character off
            </button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {attempt.state === 'open' && (
              <motion.p key="open" className="zr-result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={pop}>
                <span>Opened · {Math.round(attempt.ms)} ms</span>
                {attempt.text || '(empty secret)'}
              </motion.p>
            )}
            {attempt.state === 'refused' && (
              <motion.p key="refused" className="zr-result zr-result--bad" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [-8, 6, -4, 0] }} exit={{ opacity: 0 }} transition={pop}>
                <span>Refused · {Math.round(attempt.ms)} ms</span>
                {flips.size > 0 && guess === password ? 'Right password, but the stored bytes fail authentication.' : 'Wrong key. Authentication tag does not verify.'}
              </motion.p>
            )}
          </AnimatePresence>
        </form>
      </div>
    </section>
  )

  const server = (
    <section className="zr-pane zr-pane--server" aria-label="The server">
      <Head n="02" who="The server">
        It holds
        <br />
        noise.
      </Head>

      <div className="zr-tools">
        <Seg
          label="Show the stored envelope as"
          value={view}
          onChange={setView}
          options={[
            { value: 'bytes', label: 'Bytes' },
            { value: 'json', label: 'Request body' },
          ]}
        />
        <button type="button" className="zr-btn" onClick={copy} disabled={!stored}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {!stored ? (
        <p className="zr-void">Nothing to store. A key has to exist first.</p>
      ) : view === 'json' ? (
        <pre className="zr-json" tabIndex={0} aria-label="Envelope as JSON">
          {envelope}
        </pre>
      ) : (
        <div className="zr-dump" key={writes}>
          <ByteRun label="Salt" note={`${SALT} B · public`} bytes={stored.subarray(0, SALT)} offset={0} flips={flips} />
          <ByteRun label="Nonce" note={`${NONCE} B · new every write`} bytes={stored.subarray(SALT, SALT + NONCE)} offset={SALT} flips={flips} onFlip={flip} />
          <ByteRun
            label="Ciphertext"
            note={`${ctLen} B · tap a byte to flip a bit`}
            bytes={stored.subarray(SALT + NONCE, stored.length - TAG)}
            offset={SALT + NONCE}
            flips={flips}
            onFlip={flip}
          />
          <ByteRun label="Tag" note={`${TAG} B · authenticates everything`} bytes={stored.subarray(stored.length - TAG)} offset={stored.length - TAG} flips={flips} onFlip={flip} />
        </div>
      )}

      <div className="zr-meter" aria-live="polite">
        {flips.size > 0 ? (
          <>
            <p>
              <b>{flips.size}</b> {flips.size === 1 ? 'bit' : 'bits'} tampered. The device now refuses to decrypt.
            </p>
            <button type="button" className="zr-btn zr-btn--hot" onClick={() => setFlips(new Set())}>
              Restore
            </button>
          </>
        ) : writeDiff ? (
          <>
            <p>
              <b>{((writeDiff.bits / writeDiff.of) * 100).toFixed(1)}%</b> of stored bits changed on the last write. Random noise would score 50.
            </p>
            <button type="button" className="zr-btn" onClick={() => setSalt(randomBytes(SALT))}>
              New salt
            </button>
          </>
        ) : (
          <>
            <p>Edit the secret by one character and count how many stored bits move.</p>
            <button type="button" className="zr-btn" onClick={() => setSalt(randomBytes(SALT))}>
              New salt
            </button>
          </>
        )}
      </div>

      <div className="zr-ledger">
        <div>
          <p className="zr-label">It learns</p>
          <ul>
            <li>How long the secret is: {ctLen} bytes</li>
            <li>The salt and the Argon2id settings</li>
            <li>When you wrote, and how often</li>
          </ul>
        </div>
        <div>
          <p className="zr-label">It never sees</p>
          <ul>
            <li>The password</li>
            <li>The key</li>
            <li>One character of the secret</li>
          </ul>
        </div>
      </div>
      <p className="zr-fine">This server is a drawing. No request leaves the tab.</p>
    </section>
  )

  const attacker = (
    <section className="zr-pane zr-pane--attacker" aria-label="The attacker">
      <Head n="03" who="The attacker">
        They hold
        <br />
        a guess.
      </Head>

      <div className="zr-cost">
        <p className="zr-label">One guess costs, measured here</p>
        <p className="zr-cost__big">
          {kdf === 'argon' ? (
            deriveMs ? (
              <>
                {Math.round(deriveMs)}
                <small>ms</small>
              </>
            ) : (
              '—'
            )
          ) : shaRate ? (
            <>
              {(1e6 / shaRate).toFixed(2)}
              <small>µs</small>
            </>
          ) : (
            '—'
          )}
        </p>
        <p className="zr-cost__note">
          {ratio
            ? `The same device runs ${fmtRate(shaRate ?? 0)} salted SHA-256 guesses a second. Argon2id makes each guess ${(ratio >= 1000 ? Math.round(ratio / 1000) * 1000 : Math.round(ratio)).toLocaleString('en')} times dearer.`
            : 'Measuring a plain SHA-256 baseline for comparison.'}
        </p>
      </div>

      <div className="zr-dials">
        <div>
          <p className="zr-label">Memory, MiB</p>
          <Seg label="Argon2id memory in mebibytes" value={mem} onChange={setMem} options={MEMORY.map((v) => ({ value: v, label: String(v) }))} />
        </div>
        <div>
          <p className="zr-label">Passes</p>
          <Seg label="Argon2id passes" value={passes} onChange={setPasses} options={PASSES.map((v) => ({ value: v, label: String(v) }))} />
        </div>
      </div>

      <div className="zr-attack">
        <div className="zr-attack__head">
          <p className="zr-label">Dictionary attack · {DICTIONARY.length} real guesses</p>
          {running ? (
            <button type="button" className="zr-btn zr-btn--ink" onClick={() => send({ type: 'cancel', id: attackSeq.current })}>
              Stop
            </button>
          ) : (
            <button type="button" className="zr-btn zr-btn--ink" onClick={runAttack} disabled={!env}>
              {attack.state === 'done' ? 'Run again' : 'Run the list'}
            </button>
          )}
        </div>
        <ol className="zr-words">
          {DICTIONARY.map((w, i) => (
            <li key={w} data-s={attack.hit?.index === i ? 'hit' : i < attack.tried ? 'miss' : running && i === attack.tried ? 'now' : undefined}>
              {w}
            </li>
          ))}
        </ol>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={attack.state + (attack.hit ? 'h' : '')} className="zr-attack__out" aria-live="polite" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={pop}>
            {attack.state === 'idle' && <p>Every guess is a full Argon2id run and a real decryption attempt against the envelope next door.</p>}
            {running && (
              <p>
                Guess <b>{Math.min(attack.tried + 1, DICTIONARY.length)}</b> of {DICTIONARY.length}. Each one pays the full price.
              </p>
            )}
            {attack.state === 'done' && attack.hit && (
              <>
                <p>
                  Cracked on guess <b>{attack.hit.index + 1}</b>, after <b>{(attack.ms / 1000).toFixed(1)} s</b>. The encryption held. The password did not.
                </p>
                <p className="zr-loot">{attack.hit.plaintext || '(empty secret)'}</p>
              </>
            )}
            {attack.state === 'done' && !attack.hit && (
              <>
                <p>
                  {attack.cancelled ? 'Stopped after' : 'Exhausted:'} <b>{attack.tried}</b> guesses in <b>{(attack.ms / 1000).toFixed(1)} s</b>
                  {attackRate ? `, ${fmtRate(attackRate)} a second` : ''}. Nothing opened.
                </p>
                {!listed && (
                  <button type="button" className="zr-link" onClick={() => setPassword('dragon')}>
                    Now set the password to “dragon” and run it again
                  </button>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="zr-table">
        <div className="zr-dials">
        <div>
          <p className="zr-label">If the server kept</p>
          <Seg
            label="Key derivation used for the estimate"
            value={kdf}
            onChange={setKdf}
            options={[
              { value: 'argon', label: 'Argon2id' },
              { value: 'sha', label: 'SHA-256' },
            ]}
          />
        </div>
        <div>
          <p className="zr-label">Machines like this one</p>
          <Seg label="Attacker hardware" value={rig} onChange={setRig} options={RIGS.map((r) => ({ value: r.k, label: r.label }))} />
        </div>
        </div>
        <p className="zr-label">
          <span>Average time to guess</span>
          <span>{rate ? `${fmtRate(rate)} guesses / s` : 'measuring'}</span>
        </p>
        <ul style={{ '--day': logPos(MARKS[0].s), '--life': logPos(MARKS[1].s), '--uni': logPos(MARKS[2].s) } as CSSProperties}>
          {[
            ...KEYSPACES,
            ...(password ? [{ label: listed ? 'Yours: on every list' : 'Yours, if it were random', expr: listed ? '1' : shape.expr, n: listed ? 1 : shape.n, own: true }] : []),
          ].map((row) => {
            const s = rate ? row.n / 2 / rate : NaN
            return (
              <li key={row.label} data-own={'own' in row || undefined}>
                <p>
                  <span>
                    {row.label} <i>{row.expr}</i>
                  </span>
                  <b>{rate ? fmtDuration(s) : '…'}</b>
                </p>
                <div className="zr-bar">
                  <span style={{ transform: `scaleX(${rate ? Math.max(0.006, logPos(s)) : 0})` }} />
                </div>
              </li>
            )
          })}
        </ul>
        <p className="zr-axis" aria-hidden="true">
          {MARKS.map((m) => (
            <span key={m.label} style={{ left: `${logPos(m.s) * 100}%` }}>
              {m.label}
            </span>
          ))}
        </p>
        <p className="zr-fine">
          Log scale to 10²⁶ seconds. People do not choose at random, so a real password sits far left of its row.
        </p>
      </div>
    </section>
  )

  return (
    <ExperienceShell meta={meta} ready={booted}>
      <div className="zr" data-compact={compact}>
        <h1 className="zr-sr">Zero: client-side encryption you can take apart</h1>
        {!compact && <p className="zr-band">Real Argon2id and AES-256-GCM · simulated server · nothing leaves this tab</p>}
        <div className="zr-panes" ref={pager}>
          {device}
          {server}
          {attacker}
        </div>
        {compact && (
          <div className="zr-tabs" role="tablist" aria-label="Who is looking" ref={tabs}>
            <i aria-hidden="true" />
            {PANES.map((p, i) => (
              <button key={p} type="button" role="tab" aria-selected={pane === i} onClick={() => goPane(i)}>
                <span>0{i + 1}</span>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </ExperienceShell>
  )
}
