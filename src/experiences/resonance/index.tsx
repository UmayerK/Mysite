import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import '@fontsource-variable/cormorant-garamond/wght-italic.css'
import { ExperienceShell } from '../../shell/ExperienceShell'
import { useCoarsePointer, useIsMobile, usePrefersReducedMotion, useRaf } from '../../lib/hooks'
import { clamp, rng } from '../../lib/math'
import { meta } from './meta'
import { BANDS, BPM, Engine, Looper, SCALES, TIMBRES, WAVE, octaveOf, pitchClass, toMidi, type LoopNote, type Timbre } from './audio'
import { CENTRE, DiscScene, MISS, SECTORS, type Pick } from './scene'
import './resonance.css'

const KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';']
const RING = 2 * Math.PI * 9
const TITLE_FONT = 'italic 300 1em "Cormorant Garamond Variable"'

type Mic = 'off' | 'asking' | 'on' | 'denied'

const brightAt = (hit: Pick) => (hit.sector < 0 ? 0.45 : clamp((hit.r - 0.17) / 0.83))

function Seg<T extends string | number>(props: { label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="rs-seg" role="group" aria-label={props.label}>
      <span className="rs-cap">{props.label}</span>
      {props.options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === props.value} onClick={() => props.onChange(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  )
}

function Stepper(props: { label: string; value: string; onStep: (by: number) => void; min?: boolean; max?: boolean }) {
  return (
    <div className="rs-step" role="group" aria-label={props.label}>
      <span className="rs-cap">{props.label}</span>
      <button type="button" aria-label={`${props.label} down`} disabled={props.min} onClick={() => props.onStep(-1)}>
        ‹
      </button>
      <output>{props.value}</output>
      <button type="button" aria-label={`${props.label} up`} disabled={props.max} onClick={() => props.onStep(1)}>
        ›
      </button>
    </div>
  )
}

export default function Experience() {
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const mobile = useIsMobile()

  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const head = useRef<HTMLElement>(null)
  const dock = useRef<HTMLElement>(null)
  const arc = useRef<SVGCircleElement>(null)
  const labels = useRef<(HTMLSpanElement | null)[]>([])
  const scene = useRef<DiscScene | null>(null)
  const engine = useRef<Engine | null>(null)
  const looper = useRef<Looper | null>(null)

  const [drawn, setDrawn] = useState(false)
  const [fonts, setFonts] = useState(false)
  const [fault, setFault] = useState<'' | 'gl' | 'audio'>('')
  const [started, setStarted] = useState(false)
  const [timbre, setTimbre] = useState<Timbre>('glass')
  const [scale, setScale] = useState(0)
  const [root, setRoot] = useState(2)
  const [oct, setOct] = useState(0)
  const [rec, setRec] = useState(false)
  const [count, setCount] = useState(0)
  const [drift, setDrift] = useState(false)
  const [mic, setMic] = useState<Mic>('off')
  const [sung, setSung] = useState('')
  const [lag, setLag] = useState<number | null>(null)

  const base = 48 + root + 12 * oct
  const notes = useMemo(
    () => Array.from({ length: SECTORS }, (_, i) => base + SCALES[scale].steps[i % 5] + 12 * Math.floor(i / 5)),
    [base, scale],
  )
  // What the long-lived callbacks (loop, keys, timers) read, kept current without rebuilding them.
  const live = useRef({ notes, base, rec, drift, timbre, coarse })
  useLayoutEffect(() => {
    live.current = { notes, base, rec, drift, timbre, coarse }
  })

  const ids = useRef(1)
  const touches = useRef(new Map<number, { id: number; sector: number }>())
  const keys = useRef(new Map<string, number>())
  const sounding = useRef(new Map<number, { sector: number; loop: LoopNote | null }>())
  const lit = useRef(new Int16Array(SECTORS))
  const walk = useRef({ at: 4, dice: rng(11) })
  const clock = useRef({ pitch: 0, quiet: 0 })
  const alive = useRef(true)
  const bands = useRef(new Uint8Array(BANDS))
  const wave = useRef(new Uint8Array(WAVE).fill(128))
  const spot = useRef({ x: 0, y: 0 })

  const play = useMemo(() => {
    const midi = (sector: number) => (sector < 0 ? live.current.base - 12 : live.current.notes[sector])

    const light = (sector: number, on: boolean) => {
      scene.current?.hold(sector, on)
      if (sector < 0) return
      const n = (lit.current[sector] = Math.max(0, lit.current[sector] + (on ? 1 : -1)))
      labels.current[sector]?.toggleAttribute('data-on', n > 0)
    }

    /** A note scheduled ahead on the audio clock: its light and ripple are timed to land with the sound. */
    const strike = (sector: number, bright: number, vel: number, when: number, beats: number) => {
      const e = engine.current
      if (!e) return
      const id = ids.current++
      const [x, z] = scene.current?.point(sector, 0.3 + bright * 0.6) ?? [0, 0]
      const secs = (beats * 60) / BPM
      e.noteOn(id, midi(sector), bright, vel, x * 0.7, when)
      e.noteOff(id, when + secs)
      window.setTimeout(
        () => {
          if (!alive.current) return
          scene.current?.ripple(x, z, 0.4 + vel * 0.5, sector)
          light(sector, true)
          window.setTimeout(() => alive.current && light(sector, false), Math.min(secs, 0.6) * 1000)
        },
        Math.max(0, (when - e.ctx.currentTime) * 1000),
      )
    }

    /** Drift: a wandering line over the scale, denser on the beat, with the bass marking each half. */
    const step = (i: number, when: number) => {
      if (!live.current.drift) return
      const w = walk.current
      if (i % 16 === 0 && w.dice() < 0.85) strike(CENTRE, 0.4, 0.6, when, 1.8)
      const chance = i % 8 === 0 ? 0.9 : i % 4 === 0 ? 0.62 : i % 2 === 0 ? 0.36 : 0.08
      if (w.dice() >= chance) return
      const hop = [-2, -1, -1, 1, 1, 2, 3][Math.floor(w.dice() * 7)]
      const next = w.at + hop
      w.at = clamp(next < 0 || next >= SECTORS ? w.at - hop : next, 0, SECTORS - 1)
      strike(w.at, 0.25 + w.dice() * 0.55, 0.4 + w.dice() * 0.35, when, 0.5 + w.dice() * 1.1)
      if (w.dice() < 0.16) strike((w.at + 2) % SECTORS, 0.3, 0.3, when, 1)
    }

    /** Creates the audio engine on the first gesture; browsers do not allow sound before one. */
    const boot = () => {
      if (engine.current) {
        engine.current.resume()
        return engine.current
      }
      try {
        const e = new Engine()
        e.timbre = live.current.timbre
        engine.current = e
        looper.current = new Looper(e.ctx, (n, when) => strike(n.sector, n.bright, n.vel * 0.9, when, n.dur), step)
        setStarted(true)
        return e
      } catch {
        setFault('audio')
        return null
      }
    }

    const press = (id: number, sector: number, bright: number, vel: number, x?: number, z?: number) => {
      const s = scene.current
      const [px, pz] = x == null || z == null ? (s?.point(sector, 0.3 + bright * 0.6) ?? [0, 0]) : [x, z]
      engine.current?.noteOn(id, midi(sector), bright, vel, px * 0.7)
      s?.ripple(px, pz, 0.55 + vel * 0.5, sector)
      light(sector, true)
      const loop = live.current.rec && looper.current ? looper.current.add(sector, bright, vel) : null
      if (loop) setCount(looper.current!.notes.length)
      sounding.current.set(id, { sector, loop })
      if (live.current.coarse) navigator.vibrate?.(6)
    }

    const release = (id: number) => {
      const n = sounding.current.get(id)
      if (!n) return
      sounding.current.delete(id)
      engine.current?.noteOff(id)
      light(n.sector, false)
      if (n.loop) looper.current?.close(n.loop)
    }

    return { boot, press, release }
  }, [])

  /** Time from the input event to audible sound: the event's age now, plus the output delay the browser reports. */
  const timeLag = (stamp: number) => {
    const e = engine.current
    if (e) setLag(Math.round(clamp(performance.now() - stamp, 0, 500) + e.latency))
  }

  const layout = useCallback(() => {
    const el = stage.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const top = mobile ? (head.current?.getBoundingClientRect().bottom ?? 0) - box.top : 64
    const side = mobile ? 4 : 24
    const foot = dock.current?.offsetHeight ?? 0
    el.parentElement?.style.setProperty('--rs-dock', `${foot}px`)
    scene.current?.resize(box.width, box.height, { t: top, b: foot + (mobile ? 0 : 8), l: side, r: side })
  }, [mobile])

  useEffect(() => {
    let s: DiscScene
    try {
      s = new DiscScene(canvas.current!, { coarse })
    } catch {
      setFault('gl')
      return
    }
    scene.current = s
    return () => {
      s.dispose()
      scene.current = null
    }
  }, [coarse])

  useEffect(() => {
    layout()
    const ro = new ResizeObserver(layout)
    for (const el of [stage.current, dock.current, head.current]) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [layout, coarse])

  useEffect(() => {
    if (scene.current) scene.current.motion = reduced ? 0.3 : 1
  }, [reduced, coarse])

  useEffect(() => {
    if (engine.current) engine.current.timbre = timbre
  }, [timbre])

  useEffect(() => {
    if (scene.current) scene.current.awake = started
  }, [started, coarse])

  useEffect(() => {
    let on = true
    const done = () => on && setFonts(true)
    document.fonts.load(TITLE_FONT).then(done, done)
    const t = window.setTimeout(done, 2500)
    return () => {
      on = false
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      looper.current?.dispose()
      engine.current?.dispose()
      looper.current = null
      engine.current = null
    }
  }, [])

  const toggleRec = useCallback(() => {
    play.boot()
    setRec((r) => !r)
  }, [play])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const at = document.activeElement
      if (at?.closest('input, select, textarea, dialog, [role="dialog"]')) return
      const k = e.key.toLowerCase()
      const sector = k === ' ' ? CENTRE : KEYS.indexOf(k)
      if (k === ' ' || sector >= 0) {
        if (k === ' ' && at?.closest('button, a')) return
        e.preventDefault()
        if (keys.current.has(k)) return
        play.boot()
        const id = ids.current++
        keys.current.set(k, id)
        play.press(id, sector, 0.6, 0.8)
        timeLag(e.timeStamp)
      } else if (k === 'z') setOct((o) => Math.max(-1, o - 1))
      else if (k === 'x') setOct((o) => Math.min(1, o + 1))
      else if (k === '1' || k === '2' || k === '3') setTimbre(TIMBRES[Number(k) - 1].id)
      else if (k === 'r') toggleRec()
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const id = keys.current.get(k)
      if (id == null) return
      keys.current.delete(k)
      play.release(id)
    }
    const drop = () => {
      for (const id of keys.current.values()) play.release(id)
      keys.current.clear()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', drop)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', drop)
    }
  }, [play, toggleRec])

  useRaf((dt) => {
    const s = scene.current
    if (!s) return
    const e = engine.current
    s.frame(dt, bands.current, wave.current, e ? e.levels(bands.current, wave.current) : 0)
    if (!drawn) setDrawn(true)

    const p = spot.current
    for (let i = 0; i < SECTORS; i++) {
      const el = labels.current[i]
      if (!el) continue
      s.label(i, p)
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
    }
    if (looper.current && arc.current) arc.current.style.strokeDashoffset = String(RING * (1 - looper.current.phase()))

    if (!e || mic !== 'on') return
    const c = clock.current
    c.pitch += dt
    if (c.pitch < 0.09) return
    c.quiet += c.pitch
    c.pitch = 0
    const f = e.pitch()
    if (f == null) {
      // Hold the last reading through a breath before letting it go.
      if (c.quiet > 0.6) {
        s.sing = MISS
        setSung('')
      }
      return
    }
    c.quiet = 0
    const m = toMidi(f)
    const near = Math.round(m)
    const cents = Math.round(((m - near) * 100) / 5) * 5
    setSung(`${pitchClass(near)}${octaveOf(near)} ${cents > 0 ? '+' : cents < 0 ? '−' : '±'}${Math.abs(cents)}`)
    let best = MISS
    let gap = 99
    notes.forEach((n, i) => {
      if ((n - near) % 12 === 0 && Math.abs(n - near) < gap) {
        gap = Math.abs(n - near)
        best = i
      }
    })
    s.sing = best
  })

  const pickAt = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return scene.current!.pick(e.clientX - box.left, e.clientY - box.top)
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || !scene.current) return
    const hit = pickAt(e)
    play.boot()
    if (hit.sector === MISS) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const id = ids.current++
    touches.current.set(e.pointerId, { id, sector: hit.sector })
    play.press(id, hit.sector, brightAt(hit), 0.8, hit.x, hit.z)
    timeLag(e.timeStamp)
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = scene.current
    if (!s) return
    const hit = pickAt(e)
    const t = touches.current.get(e.pointerId)
    if (!t) {
      if (e.pointerType !== 'mouse') return
      s.hover = hit.sector
      e.currentTarget.toggleAttribute('data-hot', hit.sector !== MISS)
      const box = e.currentTarget.getBoundingClientRect()
      if (!reduced) s.lean(((e.clientX - box.left) / box.width) * 2 - 1, ((e.clientY - box.top) / box.height) * 2 - 1)
      return
    }
    if (hit.sector === MISS) return
    if (hit.sector === t.sector) {
      engine.current?.setBright(t.id, brightAt(hit))
      return
    }
    // Sliding into the next note lets go of the last, so a drag reads as a run and not a smear.
    play.release(t.id)
    t.id = ids.current++
    t.sector = hit.sector
    play.press(t.id, hit.sector, brightAt(hit), 0.7, hit.x, hit.z)
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    // A touch only counts as permission to make sound once it lifts, so the first note may wait for this.
    engine.current?.resume()
    const t = touches.current.get(e.pointerId)
    if (!t) return
    touches.current.delete(e.pointerId)
    play.release(t.id)
  }

  const onLeave = () => {
    const s = scene.current
    if (!s) return
    s.hover = MISS
    s.lean(0, 0)
    stage.current?.removeAttribute('data-hot')
  }

  const toggleDrift = () => {
    play.boot()
    setDrift((d) => !d)
  }

  const clearLoop = () => {
    looper.current?.clear()
    setCount(0)
  }

  const toggleMic = async () => {
    const e = play.boot()
    if (!e) return
    if (mic === 'on') {
      e.stopMic()
      if (scene.current) scene.current.sing = MISS
      setMic('off')
      setSung('')
      return
    }
    setMic('asking')
    try {
      await e.startMic()
      if (alive.current) setMic('on')
    } catch {
      if (alive.current) setMic('denied')
    }
  }

  const hint = fault === 'audio' ? 'This browser would not start audio.' : coarse ? 'Touch the light.' : 'Touch the light, or play the home row.'

  return (
    <ExperienceShell meta={meta} ready={(drawn || fault === 'gl') && fonts}>
      <div className="rs" data-started={started || undefined}>
        <div
          className="rs-stage"
          ref={stage}
          role="application"
          aria-label="Instrument. Keys A to semicolon play the ten notes; Space plays the bass."
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onLeave}
        >
          <canvas ref={canvas} className="rs-canvas" aria-hidden />
          {fault === 'gl' ? (
            <p className="rs-fault">This piece is drawn with WebGL, which this browser has switched off. The sound still works from the home row.</p>
          ) : (
            <div className="rs-labels" aria-hidden>
              {notes.map((n, i) => (
                <span
                  key={i}
                  className="rs-label"
                  ref={(el) => {
                    labels.current[i] = el
                  }}
                >
                  <b>
                    {pitchClass(n)}
                    <sub>{octaveOf(n)}</sub>
                  </b>
                  {!coarse && <kbd>{KEYS[i].toUpperCase()}</kbd>}
                </span>
              ))}
            </div>
          )}
        </div>

        <header className="rs-head" ref={head}>
          <h1 className="rs-title">Resonance</h1>
          <p className="rs-sub">
            {started ? `${pitchClass(base)} ${SCALES[scale].name} · ${TIMBRES.find((t) => t.id === timbre)!.name}` : hint}
          </p>
        </header>

        <dl className="rs-read">
          <div>
            <dt>Touch to sound</dt>
            <dd>
              {lag == null ? '—' : lag}
              {lag != null && <span> ms</span>}
            </dd>
            <dd className="rs-read__note">{lag == null ? 'measured when you play' : 'measured on this device'}</dd>
          </div>
          {mic === 'on' && (
            <div>
              <dt>Hearing</dt>
              <dd>{sung || '…'}</dd>
              <dd className="rs-read__note">nothing is recorded or sent</dd>
            </div>
          )}
        </dl>

        {mic === 'denied' && (
          <p className="rs-note" role="status">
            The microphone is blocked. Allow it for this site, then press Mic again.
          </p>
        )}

        <footer className="rs-dock" ref={dock}>
          <div className="rs-row rs-row--tune">
            <Seg label="Voice" value={timbre} options={TIMBRES} onChange={setTimbre} />
            <Seg label="Scale" value={scale} options={SCALES.map((s, id) => ({ id, name: s.name }))} onChange={setScale} />
            <Stepper label="Root" value={pitchClass(base)} onStep={(by) => setRoot((r) => (r + by + 12) % 12)} />
            <Stepper
              label="Octave"
              value={oct > 0 ? `+${oct}` : oct < 0 ? `−${-oct}` : '0'}
              min={oct <= -1}
              max={oct >= 1}
              onStep={(by) => setOct((o) => clamp(o + by, -1, 1))}
            />
          </div>
          <div className="rs-row rs-row--loop">
            <div className="rs-loop" data-rec={rec || undefined}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="9" className="rs-loop__track" />
                <circle ref={arc} cx="12" cy="12" r="9" className="rs-loop__arc" strokeDasharray={RING} strokeDashoffset={RING} transform="rotate(-90 12 12)" />
              </svg>
              <button type="button" className="rs-btn rs-btn--rec" aria-pressed={rec} onClick={toggleRec}>
                <i className="rs-dot" />
                {rec ? 'Stop' : 'Rec'}
              </button>
              <button type="button" className="rs-btn" disabled={!count} onClick={clearLoop}>
                Clear
              </button>
              <span className="rs-count" aria-live="polite">
                <b>{count}</b>
                <span> {count === 1 ? 'note' : 'notes'} looping</span>
              </span>
            </div>
            <button type="button" className="rs-btn" aria-pressed={drift} onClick={toggleDrift}>
              Drift
            </button>
            <button type="button" className="rs-btn" aria-pressed={mic === 'on'} disabled={mic === 'asking'} onClick={toggleMic}>
              {mic === 'asking' ? 'Asking' : 'Mic'}
            </button>
          </div>
        </footer>
      </div>
    </ExperienceShell>
  )
}
