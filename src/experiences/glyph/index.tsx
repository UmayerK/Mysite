import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/recursive/full.css'
import frauncesUrl from '@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2?url'
import recursiveUrl from '@fontsource-variable/recursive/files/recursive-latin-full-normal.woff2?url'
import { ExperienceShell } from '../../shell/ExperienceShell'
import { useCoarsePointer, useMediaQuery, usePrefersReducedMotion, useRaf } from '../../lib/hooks'
import { meta } from './meta'
import { GlyphError, lex } from './lang/lexer'
import { flatten, parse, type Program, type Span, type Stmt } from './lang/parser'
import { COMMANDS, FUNCTIONS, INKS, PAPERS, run, type Scene } from './lang/run'
import { emit, grainMarkup } from './lang/emit'
import { PRESETS, type Preset } from './presets'
import { Editor, type EditorHandle } from './Editor'
import './glyph.css'

type Tab = 'code' | 'press' | 'tokens' | 'tree' | 'words'

function compile(src: string) {
  const t0 = performance.now()
  const { tokens, error: lexError } = lex(src)
  const t1 = performance.now()
  let program: Program | null = null
  let error = lexError
  if (!lexError) {
    try {
      program = parse(tokens)
    } catch (e) {
      if (!(e instanceof GlyphError)) throw e
      error = e
    }
  }
  return { tokens, program, error, rows: program ? flatten(program) : [], lexMs: t1 - t0, parseMs: performance.now() - t1 }
}

/** The innermost statement the caret sits in. */
function stmtAt(body: Stmt[], pos: number): Stmt | null {
  for (const s of body) {
    if (pos < s.start || pos > s.end) continue
    const inner =
      s.type === 'Repeat'
        ? stmtAt(s.body, pos)
        : s.type === 'If'
          ? (stmtAt(s.then, pos) ?? (s.else ? stmtAt(s.else, pos) : null))
          : s.type === 'Command' && s.body
            ? stmtAt(s.body, pos)
            : null
    return inner ?? s
  }
  return null
}

interface Info {
  key: string
  paper: Scene['paper']
  dark: boolean
  grain: number
  usesTime: boolean
  usesRandom: boolean
  plates: { name: string; css: string; count: number }[]
}
const summarise = (s: Scene): Info => ({
  key: [s.paper.css, s.grain, s.usesTime, s.usesRandom, ...s.plates.map((p) => `${p.css}${p.shapes.length}`)].join('|'),
  paper: s.paper,
  dark: s.dark,
  grain: s.grain,
  usesTime: s.usesTime,
  usesRandom: s.usesRandom,
  plates: s.plates.map((p) => ({ name: p.name, css: p.css, count: p.shapes.length })),
})

const b64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const toUrl = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromUrl = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/** Source → URL fragment. Deflated where the browser can, plain otherwise; the first letter says which. */
async function pack(text: string) {
  const bytes = new TextEncoder().encode(text)
  if (typeof CompressionStream === 'undefined') return 'p' + toUrl(b64(bytes))
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return 'z' + toUrl(b64(new Uint8Array(await new Response(stream).arrayBuffer())))
}
async function unpack(payload: string) {
  const bytes = fromUrl(payload.slice(1))
  if (payload[0] === 'p') return new TextDecoder().decode(bytes)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

async function copyText(text: string) {
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

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** An exported file cannot reach this page's fonts, so the ones the poster uses travel inside it. */
async function embeddedFonts(scene: Scene) {
  const faces = await Promise.all(
    [...scene.fonts].map(async (f) => {
      const [family, url, range] = f === 'serif' ? ['Fraunces Variable', frauncesUrl, '100 900'] : ['Recursive Variable', recursiveUrl, '300 1000']
      const data = b64(new Uint8Array(await (await fetch(url)).arrayBuffer()))
      return `@font-face{font-family:'${family}';font-style:normal;font-weight:${range};src:url(data:font/woff2;base64,${data}) format('woff2')}`
    }),
  )
  return faces.join('')
}

const where = (src: string, pos: number) => {
  const before = src.slice(0, pos).split('\n')
  return `${before.length}:${before[before.length - 1].length + 1}`
}
const ms = (v: number) => (v < 10 ? v.toFixed(2) : v.toFixed(1))
const kb = (n: number) => (n < 1000 ? `${n} B` : `${(n / 1000).toFixed(1)} kB`)

const I = {
  play: <path d="M4 2.5v11l9-5.5z" fill="currentColor" />,
  pause: <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />,
  dice: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.7" cy="5.7" r="1.1" fill="currentColor" />
      <circle cx="10.3" cy="10.3" r="1.1" fill="currentColor" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" />
    </>
  ),
  reset: <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  link: <path d="M6.8 9.2 9.2 6.8M7 4.6l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M9 11.4l-1 1a2.6 2.6 0 0 1-3.7-3.7l1-1" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  down: <path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  chevron: <path d="m3.5 6 4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" />,
}
const Icon = ({ d }: { d: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {d}
  </svg>
)

export default function Glyph() {
  const compact = useMediaQuery('(max-width: 900px)')
  const coarse = useCoarsePointer()
  const reduced = usePrefersReducedMotion()

  const [booted, setBooted] = useState(false)
  const [shared, setShared] = useState<string | null>(null)
  const list = useMemo<Preset[]>(
    () => (shared === null ? PRESETS : [{ id: 'shared', name: 'Shared', note: 'Opened from a link', src: shared }, ...PRESETS]),
    [shared],
  )
  const [idx, setIdx] = useState(0)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const preset = list[Math.min(idx, list.length - 1)]
  const src = edits[preset.id] ?? preset.src
  const edited = src !== preset.src
  const setSrc = useCallback((next: string) => setEdits((e) => ({ ...e, [preset.id]: next })), [preset.id])

  const [caret, setCaret] = useState<number | null>(null)
  const [focused, setFocused] = useState(false)
  const [hover, setHover] = useState<Span | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [playing, setPlaying] = useState(!reduced)
  const [typing, setTyping] = useState(false)
  const [tab, setTab] = useState<Tab>('code')
  const [dock, setDock] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<Info | null>(null)
  const [stats, setStats] = useState({ runMs: 0, emitMs: 0, bytes: 0, shapes: 0 })
  const [runError, setRunError] = useState<GlyphError | null>(null)

  const editor = useRef<EditorHandle>(null)
  const art = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const inspect = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene | null>(null)
  const time = useRef(reduced ? 2 : 0)
  const swipe = useRef<{ x: number; y: number; on: boolean } | null>(null)

  const editable = !compact || typing
  const mobileTab: Tab = tab
  const sideTab: Tab = tab === 'code' || tab === 'press' ? 'tokens' : tab

  const compiled = useMemo(() => compile(src), [src])
  const error = compiled.error ?? (compiled.program ? runError : null)

  const caretStmt = useMemo(
    () => (caret !== null && compiled.program ? stmtAt(compiled.program.body, caret) : null),
    [caret, compiled.program],
  )
  const focus: Span | null = hover ?? ((focused || (!editable && caret !== null)) && caretStmt ? caretStmt : null)
  const focusRef = useRef(focus)
  focusRef.current = focus
  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden

  const paint = useCallback((program: Program, record: boolean) => {
    try {
      const t0 = performance.now()
      const next = run(program, { t: time.current })
      const t1 = performance.now()
      const svg = emit(next, { hidden: hiddenRef.current, focus: focusRef.current })
      const t2 = performance.now()
      if (art.current) art.current.innerHTML = svg
      scene.current = next
      if (record) {
        setStats({ runMs: t1 - t0, emitMs: t2 - t1, bytes: svg.length, shapes: next.count })
        setInfo((prev) => {
          const now = summarise(next)
          return prev?.key === now.key ? prev : now
        })
        setRunError(null)
      }
    } catch (e) {
      if (!(e instanceof GlyphError)) throw e
      const err = e
      setRunError((prev) => (prev && prev.message === err.message && prev.start === err.start ? prev : err))
    }
  }, [])

  const focusKey = focus ? `${focus.start}:${focus.end}` : ''
  useEffect(() => {
    if (compiled.program) paint(compiled.program, true)
  }, [compiled.program, hidden, focusKey, paint])

  const animating = playing && !!info?.usesTime && !!compiled.program && !error
  useRaf((dt) => {
    time.current += dt
    if (compiled.program) paint(compiled.program, false)
    if (clock.current) clock.current.textContent = time.current.toFixed(1)
  }, animating)

  useEffect(() => {
    let alive = true
    const fonts = Promise.race([
      Promise.all([document.fonts.load("900 40px 'Fraunces Variable'"), document.fonts.load("500 14px 'Recursive Variable'")]),
      new Promise((r) => setTimeout(r, 2500)),
    ]).catch(() => null)
    const fromHash = location.hash.startsWith('#g=') ? unpack(location.hash.slice(3)).catch(() => null) : Promise.resolve(null)
    Promise.all([fromHash, fonts]).then(([text]) => {
      if (!alive) return
      if (text) setShared(text)
      setBooted(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // The sheet feeds out of the press: once on arrival, and sideways whenever the poster changes.
  const feed = useCallback(
    (dir: number) => {
      if (reduced) return
      sheet.current?.animate(
        dir === 0
          ? [
              { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-14px)' },
              { clipPath: 'inset(0 0 0 0)', transform: 'none' },
            ]
          : [
              { transform: `translateX(${dir * 46}px) rotate(${dir * 2}deg)`, opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
        { duration: dir === 0 ? 900 : 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      )
    },
    [reduced],
  )
  useEffect(() => {
    if (booted) feed(0)
  }, [booted, feed])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(id)
  }, [toast])

  // Keep the token or node under the caret in view without ever scrolling the page itself.
  useEffect(() => {
    const box = inspect.current
    const on = box?.querySelector<HTMLElement>('[data-on="true"]')
    if (!box || !on) return
    const top = on.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + on.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - box.clientHeight / 2, behavior: reduced ? 'auto' : 'smooth' })
    }
  }, [caret, tab, reduced])

  const select = (next: number, dir: number) => {
    const n = (next + list.length) % list.length
    if (n === idx) return
    setIdx(n)
    setCaret(null)
    setHover(null)
    setHidden(new Set())
    setRunError(null)
    time.current = reduced ? 2 : 0
    feed(dir)
  }

  const jump = (span: Span) => {
    setCaret(span.start)
    if (compact) {
      setDock(true)
      setTab('code')
    }
    requestAnimationFrame(() => editor.current?.reveal(span))
  }

  const reroll = () => {
    const n = String(1 + Math.floor(Math.random() * 998))
    const at = scene.current?.seedSpan
    setSrc(at ? src.slice(0, at.start) + n + src.slice(at.end) : `seed ${n}\n${src}`)
  }

  const share = async () => {
    const url = `${location.origin}${location.pathname}#g=${await pack(src)}`
    history.replaceState(history.state, '', url)
    setToast((await copyText(url)) ? 'Link copied. It carries the whole program.' : 'The link is in the address bar.')
  }

  const save = async (kind: 'svg' | 'png') => {
    if (!compiled.program || busy) return
    setBusy(true)
    try {
      const final = run(compiled.program, { t: time.current })
      const width = 2000
      const svg = emit(final, { hidden, standalone: { width, fontCss: await embeddedFonts(final) } })
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      if (kind === 'svg') {
        download(blob, `glyph-${preset.id}.svg`)
        setToast(`Saved an SVG, ${kb(blob.size)}.`)
        return
      }
      const img = new Image()
      const url = URL.createObjectURL(blob)
      img.src = url
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = (width * 140) / 100
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      // Embedded fonts can finish decoding a beat after the image does; a second pass picks them up.
      await new Promise((r) => setTimeout(r, 140))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!png) throw new Error('empty canvas')
      download(png, `glyph-${preset.id}.png`)
      setToast(`Saved a ${canvas.width} × ${canvas.height} PNG.`)
    } catch {
      setToast('This browser refused the export.')
    } finally {
      setBusy(false)
    }
  }

  const onProofDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY, on: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onProofMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current
    if (!s || !sheet.current) return
    const dx = e.clientX - s.x
    if (!s.on && (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(e.clientY - s.y))) return
    s.on = true
    sheet.current.style.transform = `translateX(${dx * 0.55}px) rotate(${dx * 0.012}deg)`
  }
  const onProofUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current
    swipe.current = null
    if (!s || !sheet.current) return
    const dx = e.clientX - s.x
    const from = sheet.current.style.transform
    sheet.current.style.transform = ''
    if (s.on && Math.abs(dx) > 56) return select(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1)
    if (s.on) {
      if (!reduced) sheet.current.animate([{ transform: from }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
      return
    }
    // A tap: find the shape under the finger and take the caret to the line that drew it.
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>('[data-s]')
    if (hit) jump({ start: Number(hit.dataset.s), end: Number(hit.dataset.e) })
  }

  const grain = useMemo(() => (info ? grainMarkup(info, 'gl-grain-live') : ''), [info])
  const lineCount = compiled.tokens.filter((t) => t.type !== 'nl' && t.type !== 'eof').length
  const stage = error?.stage
  const total = compiled.lexMs + compiled.parseMs + stats.runMs + stats.emitMs

  const hint = useMemo(() => {
    if (caret === null || caretStmt?.type !== 'Command') return null
    const sig = COMMANDS[caretStmt.name]
    if (!sig) return null
    const pos = caretStmt.args.filter((a) => a.key === null)
    const keyed = caretStmt.args.find((a) => a.key !== null && caret >= a.start && caret <= a.end)
    const at = keyed ? -1 : Math.min(pos.filter((a) => a.end < caret).length, sig.params.length - 1)
    return { name: caretStmt.name, sig, at, key: keyed?.key ?? null }
  }, [caret, caretStmt])

  const activeToken = caret === null ? -1 : compiled.tokens.findIndex((t) => t.type !== 'nl' && t.type !== 'eof' && caret >= t.start && caret <= t.end)
  const activeRow = useMemo(() => {
    if (caret === null) return -1
    let best = -1
    compiled.rows.forEach((r, i) => {
      if (i > 0 && caret >= r.span.start && caret <= r.span.end && (best < 0 || r.depth >= compiled.rows[best].depth)) best = i
    })
    return best
  }, [caret, compiled.rows])

  const hoverOn = (span: Span) => ({
    onPointerEnter: () => !coarse && setHover(span),
    onPointerLeave: () => setHover(null),
    onClick: () => jump(span),
  })

  /* ---------- pieces shared by both layouts ---------- */

  const statusEl = error ? (
    <button className="gl-status gl-status--err" onClick={() => jump({ start: error.start, end: error.end })}>
      <b>
        {error.stage === 'lex' ? 'Lexer' : error.stage === 'parse' ? 'Parser' : 'Runtime'} · {where(src, error.start)}
      </b>
      <span>{error.message}</span>
    </button>
  ) : (
    <div className="gl-status">
      <b>Compiled</b>
      <span>
        {stats.shapes.toLocaleString('en')} shape{stats.shapes === 1 ? '' : 's'} on {info?.plates.length ?? 0} plate
        {info?.plates.length === 1 ? '' : 's'} in {ms(total)} ms
      </span>
    </div>
  )

  const hintEl = (
    <div className="gl-hint" aria-live="off">
      {hint ? (
        <>
          <b>{hint.name}</b>
          {hint.sig.params.map((p, i) => (
            <span key={p.name} data-on={i === hint.at ? 'true' : undefined}>
              {p.optional ? `[${p.name}]` : p.name}
            </span>
          ))}
          {hint.sig.opts?.map((o) => (
            <i key={o} data-on={o === hint.key ? 'true' : undefined}>
              {o}:
            </i>
          ))}
          <em>{hint.sig.doc}</em>
        </>
      ) : (
        <em>{coarse ? 'Drag a number sideways. Tap a shape to find its line.' : 'Drag any number. Click a shape to find its line. Shift drags ×10.'}</em>
      )}
    </div>
  )

  const editorEl = (
    <Editor
      handle={editor}
      value={src}
      tokens={compiled.tokens}
      error={error}
      mark={hover}
      editable={editable}
      coarse={coarse}
      onChange={setSrc}
      onCaret={setCaret}
      onFocusChange={setFocused}
    />
  )

  const pipelineEl = (
    <ol className="gl-pipe" data-stop={stage}>
      {[
        { id: 'src', name: 'Source', count: `${src.length} characters`, time: '' },
        { id: 'lex', name: 'Lexer', count: `${lineCount} tokens`, time: ms(compiled.lexMs) },
        { id: 'parse', name: 'Parser', count: stage === 'lex' || stage === 'parse' ? 'no tree' : `${compiled.rows.length} nodes`, time: ms(compiled.parseMs) },
        { id: 'run', name: 'Evaluator', count: stage ? 'no scene' : `${stats.shapes} shapes`, time: ms(stats.runMs) },
        { id: 'emit', name: 'SVG', count: stage ? 'last good print' : kb(stats.bytes), time: ms(stats.emitMs) },
      ].map((s, i, all) => {
        const stopAt = all.findIndex((x) => x.id === stage)
        return (
          <li key={s.id} data-state={stopAt < 0 || i < stopAt ? 'ok' : i === stopAt ? 'stop' : 'idle'}>
            <b>{s.name}</b>
            <span>{i === stopAt ? 'stopped here' : s.count}</span>
            <i>{s.time && (stopAt < 0 || i < stopAt) ? `${s.time} ms` : ''}</i>
          </li>
        )
      })}
    </ol>
  )

  const platesEl = (
    <div className="gl-plates">
      {info?.plates.map((p) => {
        const off = hidden.has(p.css)
        return (
          <button
            key={p.css}
            className="gl-plate"
            aria-pressed={!off}
            style={{ '--sw': p.css } as CSSProperties}
            onClick={() =>
              setHidden((h) => {
                const next = new Set(h)
                if (!next.delete(p.css)) next.add(p.css)
                return next
              })
            }
          >
            <i />
            <b>{p.name}</b>
            <span>{off ? 'off press' : `${p.count} shape${p.count === 1 ? '' : 's'}`}</span>
          </button>
        )
      })}
      <p>
        Every ink is its own plate, laid down with <b>{info?.dark ? 'screen' : 'multiply'}</b> so overlaps mix the way they would on a
        risograph. Take one off to see the separation.
      </p>
    </div>
  )

  const tokensEl = (
    <div className="gl-toks">
      {compiled.tokens.slice(0, 700).map((t, i) =>
        t.type === 'eof' ? null : t.type === 'nl' ? (
          <br key={i} />
        ) : (
          <button key={i} className={`gl-tok gl-t-${t.type}`} data-on={i === activeToken ? 'true' : undefined} title={t.type} {...hoverOn(t)}>
            {t.text}
          </button>
        ),
      )}
      {compiled.error?.stage === 'lex' && <p className="gl-empty">The lexer stopped at {where(src, compiled.error.start)}.</p>}
    </div>
  )

  const treeEl = (
    <div className="gl-tree">
      {compiled.rows.length === 0 && <p className="gl-empty">No tree until the source parses. The poster keeps its last good print.</p>}
      {compiled.rows.map((r, i) => (
        <button
          key={i}
          className="gl-node"
          data-on={i === activeRow ? 'true' : undefined}
          data-expr={r.expr ? 'true' : undefined}
          style={{ '--d': r.depth } as CSSProperties}
          {...hoverOn(r.span)}
        >
          <b>{r.kind}</b>
          <span>{r.label}</span>
        </button>
      ))}
    </div>
  )

  const wordsEl = (
    <div className="gl-words">
      {(['Page', 'Ink', 'Place', 'Draw'] as const).map((g) => (
        <section key={g}>
          <h3>{g}</h3>
          {Object.entries(COMMANDS)
            .filter(([, c]) => c.group === g)
            .map(([name, c]) => (
              <button
                key={name}
                className="gl-word"
                onClick={() => {
                  const base = src.endsWith('\n') ? src : src + '\n'
                  setSrc(base + c.example + '\n')
                  setToast(`Added “${name}” at the end.`)
                  jump({ start: base.length, end: base.length + c.example.length })
                }}
              >
                <code>
                  <b>{name}</b> {c.params.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ')}
                  {c.opts && <i> {c.opts.map((o) => `${o}:`).join(' ')}</i>}
                  {c.block && <i> {'{ }'}</i>}
                </code>
                <span>{c.doc}</span>
              </button>
            ))}
        </section>
      ))}
      <section>
        <h3>Flow</h3>
        <dl>
          <dt>let n = 12</dt>
          <dd>Names a value. n = n + 1 changes it.</dd>
          <dt>repeat 8 as i {'{ }'}</dt>
          <dd>Runs a block; i counts from 0. Settings reset each turn.</dd>
          <dt>if a &lt; b {'{ }'} else {'{ }'}</dt>
          <dd>Chooses a block. + - * / % and comparisons work on numbers.</dd>
          <dt>t, W, H</dt>
          <dd>Seconds on the clock, and the sheet: 100 by 140.</dd>
        </dl>
      </section>
      <section>
        <h3>Functions</h3>
        <dl>
          {Object.entries(FUNCTIONS).map(([name, f]) => (
            <div key={name}>
              <dt>
                {name}({f.args})
              </dt>
              <dd>{f.doc}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Inks and papers</h3>
        <ul className="gl-swatches">
          {Object.entries({ ...INKS, ...PAPERS }).map(([name, css]) => (
            <li key={name} style={{ '--sw': css } as CSSProperties}>
              <i />
              {name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )

  const transport = (
    <>
      {info?.usesTime && (
        <button className="gl-btn gl-btn--clock" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause the clock' : 'Run the clock'}>
          <Icon d={animating ? I.pause : I.play} />
          <span>
            t <span ref={clock}>{time.current.toFixed(1)}</span>
          </span>
        </button>
      )}
      {info?.usesRandom && (
        <button className="gl-btn" onClick={reroll} aria-label="Roll a new seed">
          <Icon d={I.dice} />
          <span>Reroll</span>
        </button>
      )}
      {edited && (
        <button
          className="gl-btn"
          onClick={() => {
            setEdits(({ [preset.id]: _, ...rest }) => rest)
            setCaret(null)
          }}
          aria-label="Restore the original program"
        >
          <Icon d={I.reset} />
          <span>Reset</span>
        </button>
      )}
    </>
  )
  const exports = (
    <>
      <button className="gl-btn" onClick={share} aria-label="Copy a link to this program">
        <Icon d={I.link} />
        <span>Link</span>
      </button>
      <button className="gl-btn" onClick={() => save('svg')} disabled={!compiled.program || busy} aria-label="Download as SVG">
        <Icon d={I.down} />
        <span>SVG</span>
      </button>
      <button className="gl-btn" onClick={() => save('png')} disabled={!compiled.program || busy} aria-label="Download as PNG">
        <Icon d={I.down} />
        <span>PNG</span>
      </button>
    </>
  )

  const proof = (
    <div className="gl-fit">
      <div
        className="gl-proof"
        onPointerDown={onProofDown}
        onPointerMove={onProofMove}
        onPointerUp={onProofUp}
        onPointerCancel={onProofUp}
        role="img"
        aria-label={`Poster: ${preset.name}. ${stats.shapes} shapes on ${info?.plates.length ?? 0} plates.`}
      >
        {['tl', 'tr', 'bl', 'br'].map((c) => (
          <i key={c} className={`gl-crop gl-crop--${c}`} />
        ))}
        <div className="gl-sheet" ref={sheet} data-error={error ? 'true' : undefined}>
          <div className="gl-art" ref={art} />
          <svg className="gl-grain" viewBox="0 0 100 140" aria-hidden="true" dangerouslySetInnerHTML={{ __html: grain }} />
        </div>
        <div className="gl-bar" aria-hidden="true">
          {info?.plates.map((p) => (
            <i key={p.css} style={{ background: p.css, opacity: hidden.has(p.css) ? 0.18 : 1 }} />
          ))}
          <span>
            {preset.name} · {info?.plates.length ?? 0} plates · 100 × 140
          </span>
        </div>
      </div>
    </div>
  )

  const toastEl = (
    <div className="gl-toast" role="status" data-on={toast ? 'true' : undefined}>
      {toast}
    </div>
  )

  const tabs = (items: [Tab, string][], current: Tab) => (
    <div className="gl-tabs" role="tablist">
      {items.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={current === id} onClick={() => (setTab(id), setDock(true))}>
          {label}
        </button>
      ))}
    </div>
  )
  const panel = (which: Tab) => (which === 'tokens' ? tokensEl : which === 'tree' ? treeEl : wordsEl)

  return (
    <ExperienceShell meta={meta} ready={booted}>
      {compact ? (
        <div className="gl" data-compact="true" data-dock={dock ? 'open' : 'shut'}>
          <section className="gl-table">
            <div className="gl-rail gl-rail--l">{transport}</div>
            {proof}
            <div className="gl-rail gl-rail--r">{exports}</div>
            <div className="gl-pager">
              <span>
                {String(idx + 1).padStart(2, '0')} {preset.name}
              </span>
              <div>
                {list.map((p, i) => (
                  <button key={p.id} aria-label={`Poster ${i + 1}: ${p.name}`} aria-current={i === idx} onClick={() => select(i, i > idx ? 1 : -1)} />
                ))}
              </div>
              <em>swipe</em>
            </div>
            {toastEl}
          </section>
          <section className="gl-dock">
            <div className="gl-dock__head">
              {tabs(
                [
                  ['code', 'Code'],
                  ['press', 'Press'],
                  ['tokens', 'Tokens'],
                  ['tree', 'Tree'],
                  ['words', 'Words'],
                ],
                mobileTab,
              )}
              <button className="gl-dock__toggle" onClick={() => setDock((d) => !d)} aria-label={dock ? 'Show the poster larger' : 'Show the panel'} aria-expanded={dock}>
                <Icon d={I.chevron} />
              </button>
            </div>
            <div className="gl-dock__body" inert={!dock}>
              {mobileTab === 'code' ? (
                <>
                  <div className="gl-mode">
                    <div className="gl-seg" role="group" aria-label="How to edit">
                      <button aria-pressed={!typing} onClick={() => setTyping(false)}>
                        Tune
                      </button>
                      <button aria-pressed={typing} onClick={() => setTyping(true)}>
                        Type
                      </button>
                    </div>
                    {hintEl}
                  </div>
                  {editorEl}
                  {statusEl}
                </>
              ) : mobileTab === 'press' ? (
                <div className="gl-scroll">
                  {pipelineEl}
                  {platesEl}
                </div>
              ) : (
                <div className="gl-scroll" ref={inspect}>
                  {panel(mobileTab)}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="gl">
          <aside className="gl-left">
            <header className="gl-head">
              <h1 data-text="Glyph">Glyph</h1>
              <p>A tiny language for posters. The whole compiler runs on this page, on every keystroke: lexer, parser, evaluator, SVG.</p>
            </header>
            <nav className="gl-presets" aria-label="Posters">
              {list.map((p, i) => (
                <button key={p.id} aria-current={i === idx} onClick={() => select(i, i > idx ? 1 : -1)} title={p.note}>
                  <i>{String(i + 1).padStart(2, '0')}</i>
                  {p.name}
                </button>
              ))}
            </nav>
            {editorEl}
            {statusEl}
            {hintEl}
          </aside>
          <section className="gl-table">
            {proof}
            <div className="gl-deck">
              <div>{transport}</div>
              <div>{exports}</div>
            </div>
            {toastEl}
          </section>
          <aside className="gl-right">
            <h2>Pipeline</h2>
            {pipelineEl}
            <h2>Plates</h2>
            {platesEl}
            {tabs(
              [
                ['tokens', 'Tokens'],
                ['tree', 'Tree'],
                ['words', 'Words'],
              ],
              sideTab,
            )}
            <div className="gl-scroll" ref={inspect}>
              {panel(sideTab)}
            </div>
          </aside>
        </div>
      )}
    </ExperienceShell>
  )
}
