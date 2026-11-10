import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import '@fontsource-variable/big-shoulders/index.css'
import { ExperienceShell } from '../../shell/ExperienceShell'
import { useCoarsePointer, useMediaQuery, usePrefersReducedMotion, useRaf } from '../../lib/hooks'
import { cappedDpr, rng } from '../../lib/math'
import { meta } from './meta'
import { ACTIVATIONS, countParams, type Activation } from './nn/mlp'
import { generate, MAX_SAMPLES, PRESETS, type PresetId } from './nn/datasets'
import type { Frame, ToWorker } from './nn/protocol'
import { TerrainScene, type Mode } from './scene/terrain'
import { drawLoss, drawNet } from './ui/charts'
import './seam.css'

type Brush = 'defect' | 'sound' | 'erase'
type Rate = 'slow' | 'live' | 'max'
type Tab = 'train' | 'data' | 'model'

const RATES: Record<Rate, number> = { slow: 20, live: 240, max: Infinity }
const DECAYS = [0, 1e-4, 1e-3, 1e-2]
const DECAY_LABELS = ['0', '10⁻⁴', '10⁻³', '10⁻²']
const BRUSH_HEX: Record<Brush, number> = { defect: 0xff6a1a, sound: 0xcfe0ff, erase: 0xffffff }

const fmtLr = (lr: number) => (lr < 0.01 ? lr.toFixed(4) : lr.toFixed(3))

function Seg<T extends string>(props: {
  label: string
  value: T
  options: { id: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`sm-seg ${props.className ?? ''}`} role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={props.value === o.id}
          title={o.title}
          onClick={() => props.onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stepper(props: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const { label, value, min, max, step = 1, onChange } = props
  return (
    <div className="sm-row">
      <span className="sm-row__k">{label}</span>
      <div className="sm-step">
        <button type="button" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.6" /></svg>
        </button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5h8M5 1v8" stroke="currentColor" strokeWidth="1.6" /></svg>
        </button>
      </div>
    </div>
  )
}

export default function Seam() {
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const compact = useMediaQuery('(max-width: 980px), (max-height: 560px)')

  const [preset, setPreset] = useState<PresetId>('spiral')
  const [noise, setNoise] = useState(0.15)
  const [dataSeed, setDataSeed] = useState(11)
  const [layers, setLayers] = useState(2)
  const [width, setWidth] = useState(16)
  const [activation, setActivation] = useState<Activation>('swish')
  const [netSeed, setNetSeed] = useState(5)
  const [lrExp, setLrExp] = useState(Math.log10(0.02))
  const [decay, setDecay] = useState(0)
  const [running, setRunning] = useState(true)
  const [rate, setRate] = useState<Rate>('live')
  const [mode, setMode] = useState<Mode>('orbit')
  const [brush, setBrush] = useState<Brush>('defect')
  const [top, setTop] = useState(false)
  const [tab, setTab] = useState<Tab>('train')
  const [ready, setReady] = useState(false)
  const [glFail, setGlFail] = useState(false)
  const [hint, setHint] = useState(true)
  const [full, setFull] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lossRef = useRef<HTMLCanvasElement>(null)
  const netRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<TerrainScene | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const lastRef = useRef<Frame | null>(null)
  const histRef = useRef<{ steps: number[]; loss: number[] }>({ steps: [], loss: [] })
  const dataRef = useRef({ xs: new Float32Array(MAX_SAMPLES * 2), ys: new Uint8Array(MAX_SAMPLES), n: 0 })
  const strokeRef = useRef({ x: 0, y: 0 })
  const live = useRef({ brush, mode, top, compact, running })
  live.current = { brush, mode, top, compact, running }

  const hidden = Array.from({ length: layers }, () => width)
  const lr = Math.pow(10, lrExp)

  const send = useCallback((m: ToWorker) => workerRef.current?.postMessage(m), [])

  // ---------- imperative readouts (no React renders on the training path) ----------

  const paint = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const f = lastRef.current
    const n = dataRef.current.n
    const has = !!f && n > 0 && Number.isFinite(f.loss)
    const put = (key: string, v: string) => {
      root.querySelectorAll<HTMLElement>(`[data-ro="${key}"]`).forEach((el) => {
        if (el.textContent !== v) el.textContent = v
      })
    }
    put('loss', has ? (f.loss < 0.0001 ? '<.0001' : f.loss.toFixed(4)) : '—')
    put('acc', has ? `${(f.acc * 100).toFixed(f.acc === 1 ? 0 : 1)}%` : '—')
    put('step', f ? f.step.toLocaleString('en-US') : '0')
    put('sps', f && live.current.running && n > 0 ? Math.round(f.sps).toLocaleString('en-US') : '0')
    put('n', String(n))
    put('wrong', has ? String(Math.round((1 - f.acc) * n)) : '0')
    if (lossRef.current) drawLoss(lossRef.current, histRef.current.steps, histRef.current.loss)
    if (netRef.current && f) drawNet(netRef.current, f.sizes, f.params)
  }, [])

  const onFrame = useCallback(
    (f: Frame) => {
      const h = histRef.current
      const prev = lastRef.current
      if (prev && f.step < prev.step) {
        h.steps.length = 0
        h.loss.length = 0
      }
      lastRef.current = f
      sceneRef.current?.setGrid(f.grid)
      sceneRef.current?.setProbs(f.probs)
      if (Number.isFinite(f.loss) && (h.steps.length === 0 || f.step > h.steps[h.steps.length - 1])) {
        h.steps.push(f.step)
        h.loss.push(f.loss)
        if (h.steps.length > 700) {
          // Halve the resolution of history rather than forgetting the start of the run.
          let k = 0
          for (let i = 0; i < h.steps.length; i += 2) {
            h.steps[k] = h.steps[i]
            h.loss[k++] = h.loss[i]
          }
          h.steps.length = k
          h.loss.length = k
        }
      }
      paint()
    },
    [paint],
  )

  /** Push the main-thread dataset to the scene and the trainer. */
  const commit = useCallback(() => {
    const d = dataRef.current
    sceneRef.current?.setSamples(d.xs, d.ys, d.n)
    send({ type: 'data', xs: d.xs.slice(0, d.n * 2), ys: d.ys.slice(0, d.n), n: d.n })
    setFull(d.n >= MAX_SAMPLES)
    paint()
  }, [send, paint])

  const onPaint = useCallback(
    (x: number, y: number, phase: 'start' | 'move' | 'end') => {
      if (phase === 'end') return
      const d = dataRef.current
      const b = live.current.brush
      if (b === 'erase') {
        let k = 0
        for (let i = 0; i < d.n; i++) {
          if (Math.hypot(d.xs[2 * i] - x, d.xs[2 * i + 1] - y) < 0.09) continue
          d.xs[2 * k] = d.xs[2 * i]
          d.xs[2 * k + 1] = d.xs[2 * i + 1]
          d.ys[k++] = d.ys[i]
        }
        if (k !== d.n) {
          d.n = k
          commit()
        }
        return
      }
      const s = strokeRef.current
      if (phase === 'move' && Math.hypot(x - s.x, y - s.y) < 0.05) return
      if (d.n >= MAX_SAMPLES) return
      s.x = x
      s.y = y
      // A dragged stroke sprays a little, a single click lands exactly.
      const j = phase === 'move' ? 0.035 : 0
      d.xs[2 * d.n] = Math.max(-0.98, Math.min(0.98, x + (Math.random() - 0.5) * j))
      d.xs[2 * d.n + 1] = Math.max(-0.98, Math.min(0.98, y + (Math.random() - 0.5) * j))
      d.ys[d.n] = b === 'defect' ? 1 : 0
      d.n++
      commit()
    },
    [commit],
  )

  // ---------- trainer worker ----------

  useEffect(() => {
    const worker = new Worker(new URL('./nn/trainer.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (e: MessageEvent<Frame>) => onFrame(e.data)
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [onFrame])

  // ---------- scene ----------

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const canvas = document.createElement('canvas')
    wrap.appendChild(canvas)
    let scene: TerrainScene | null = null
    const resize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      // On the wide layout the side panels cover roughly 640px of the canvas.
      const usable = live.current.compact ? w / h : Math.max(360, w - 640) / h
      scene?.resize(w, h, cappedDpr(coarse ? 1.75 : 2), usable)
    }
    try {
      scene = new TerrainScene(canvas, { reduced, coarse, bg: meta.palette.bg, bgComposer: '#1e1f22' })
      scene.onInteract = () => setHint(false)
      scene.onPaint = (e) => onPaint(e.x, e.y, e.phase)
      const d = dataRef.current
      scene.setSamples(d.xs, d.ys, d.n)
      if (lastRef.current) scene.setGrid(lastRef.current.grid)
      scene.setMode(live.current.mode)
      scene.setBrushColor(BRUSH_HEX[live.current.brush])
      scene.setTop(live.current.top)
      resize()
      scene.frame(0.016, 0)
      sceneRef.current = scene
      if (import.meta.env.DEV) (window as unknown as { __seam?: TerrainScene }).__seam = scene
      setGlFail(false)
    } catch {
      scene = null
      canvas.remove()
      setGlFail(true)
    }
    setReady(true)
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      scene?.dispose()
      sceneRef.current = null
      canvas.remove()
    }
  }, [reduced, coarse, onPaint])

  useRaf((dt, t) => sceneRef.current?.frame(dt, t))

  // ---------- state → worker / scene ----------

  useEffect(() => {
    histRef.current.steps.length = 0
    histRef.current.loss.length = 0
    send({ type: 'reset', spec: { hidden: Array.from({ length: layers }, () => width), activation }, seed: netSeed * 7919 + 13 })
  }, [layers, width, activation, netSeed, send])

  useEffect(() => {
    const g = generate(preset, noise, rng(dataSeed * 101))
    const d = dataRef.current
    d.xs.set(g.xs)
    d.ys.set(g.ys)
    d.n = g.n
    commit()
  }, [preset, noise, dataSeed, commit])

  useEffect(() => {
    send({ type: 'hyper', lr: Math.pow(10, lrExp), l2: decay, rate: RATES[rate] })
  }, [lrExp, decay, rate, send])

  useEffect(() => {
    const sync = () => send({ type: 'run', on: running && !document.hidden })
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [running, send])

  useEffect(() => {
    sceneRef.current?.setMode(mode)
  }, [mode])
  useEffect(() => {
    sceneRef.current?.setBrushColor(BRUSH_HEX[brush])
  }, [brush])
  useEffect(() => {
    sceneRef.current?.setTop(top)
  }, [top])

  // Readouts are written imperatively, so refill them whenever the layout remounts them.
  useLayoutEffect(paint, [paint, tab, compact, running])

  // ---------- actions ----------

  const choosePreset = (id: PresetId) => {
    setPreset(id)
    setNetSeed((s) => s + 1)
    if (id === 'blank') {
      setMode('paint')
      setHint(false)
    }
  }
  const stepOnce = useCallback(() => {
    setRunning(false)
    send({ type: 'step' })
  }, [send])
  const reinit = useCallback(() => setNetSeed((s) => s + 1), [])
  const clearAll = () => {
    dataRef.current.n = 0
    commit()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (rootRef.current?.closest('[inert]')) return
      const t = e.target as HTMLElement
      const tag = t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      if (k === ' ') {
        if (tag === 'BUTTON') return
        e.preventDefault()
        setRunning((r) => !r)
      } else if (k === 's') stepOnce()
      else if (k === 'r') reinit()
      else if (k === 't') setTop((v) => !v)
      else if (k === 'p') setMode((m) => (m === 'paint' ? 'orbit' : 'paint'))
      else if (k === 'arrowleft') sceneRef.current?.nudge(-0.16, 1)
      else if (k === 'arrowright') sceneRef.current?.nudge(0.16, 1)
      else if (k === 'arrowup' || k === '=' || k === '+') sceneRef.current?.nudge(0, 0.9)
      else if (k === 'arrowdown' || k === '-') sceneRef.current?.nudge(0, 1.1)
      else return
      setHint(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepOnce, reinit])

  // ---------- pieces ----------

  const note = PRESETS.find((p) => p.id === preset)?.note

  const presetsUI = (
    <div className="sm-presets" role="radiogroup" aria-label="Dataset">
      {PRESETS.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} onClick={() => choosePreset(p.id)}>
          {p.label}
        </button>
      ))}
    </div>
  )

  const noiseUI = (
    <label className="sm-row sm-row--slider">
      <span className="sm-row__k">Noise</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={noise}
        disabled={preset === 'blank'}
        onChange={(e) => setNoise(Number(e.target.value))}
      />
      <span className="sm-row__v">{noise.toFixed(2)}</span>
    </label>
  )

  const brushUI = (
    <Seg
      label="Brush"
      className="sm-seg--brush"
      value={brush}
      onChange={(b) => {
        setBrush(b)
        setMode('paint')
      }}
      options={[
        { id: 'defect', label: (<><i className="sm-dot sm-dot--defect" />Defect</>) },
        { id: 'sound', label: (<><i className="sm-dot sm-dot--sound" />Sound</>) },
        { id: 'erase', label: 'Erase' },
      ]}
    />
  )

  const modeUI = (
    <Seg
      label="Pointer tool"
      value={mode}
      onChange={(m) => {
        setMode(m)
        setHint(false)
      }}
      options={[
        { id: 'orbit', label: 'Orbit', title: 'Drag to orbit' },
        { id: 'paint', label: 'Paint', title: 'Draw samples on the surface (P)' },
      ]}
    />
  )

  const countsUI = (
    <p className="sm-counts">
      <span><b data-ro="n" /> samples</span>
      <span><b data-ro="wrong" /> misread</span>
      {full && <span className="sm-counts__full">limit {MAX_SAMPLES}</span>}
    </p>
  )

  const dataActions = (
    <div className="sm-actions">
      <button type="button" className="sm-btn" disabled={preset === 'blank'} onClick={() => setDataSeed((s) => s + 1)}>
        Resample
      </button>
      <button type="button" className="sm-btn" onClick={clearAll}>
        Clear all
      </button>
    </div>
  )

  const modelUI = (
    <>
      <Stepper label="Hidden layers" value={layers} min={1} max={4} onChange={setLayers} />
      <Stepper label="Units per layer" value={width} min={2} max={24} step={2} onChange={setWidth} />
      <div className="sm-row sm-row--stack">
        <span className="sm-row__k">Activation</span>
        <Seg label="Activation" value={activation} onChange={setActivation} options={ACTIVATIONS.map((a) => ({ id: a, label: a }))} />
      </div>
      <label className="sm-row sm-row--slider">
        <span className="sm-row__k">Learning rate</span>
        <input type="range" min={-3.5} max={-0.7} step={0.05} value={lrExp} onChange={(e) => setLrExp(Number(e.target.value))} />
        <span className="sm-row__v">{fmtLr(lr)}</span>
      </label>
      <div className="sm-row sm-row--stack">
        <span className="sm-row__k">Weight decay</span>
        <Seg
          label="Weight decay"
          value={String(decay)}
          onChange={(v) => setDecay(Number(v))}
          options={DECAYS.map((d, i) => ({ id: String(d), label: DECAY_LABELS[i] }))}
        />
      </div>
    </>
  )

  const netUI = (
    <figure className="sm-net">
      <canvas ref={netRef} aria-hidden="true" />
      <figcaption>
        <span>{[2, ...hidden, 1].join(' → ')}</span>
        <span>{countParams({ hidden, activation }).toLocaleString('en-US')} weights</span>
      </figcaption>
    </figure>
  )

  const lossUI = (
    <figure className="sm-loss">
      <canvas ref={lossRef} role="img" aria-label="Training loss over optimiser steps, log scale" />
      <figcaption>
        <span>step <b data-ro="step" /></span>
        <span><b data-ro="sps" /> steps/s measured</span>
      </figcaption>
    </figure>
  )

  const rateUI = (
    <Seg
      label="Training speed"
      value={rate}
      onChange={setRate}
      options={[
        { id: 'slow', label: 'Slow', title: '20 steps per second' },
        { id: 'live', label: 'Live', title: '240 steps per second' },
        { id: 'max', label: 'Max', title: 'As fast as this device allows' },
      ]}
    />
  )

  const playBtn = (
    <button
      type="button"
      className="sm-play"
      aria-pressed={running}
      aria-label={running ? 'Pause training' : 'Start training'}
      onClick={() => setRunning((r) => !r)}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {running ? <path d="M2 1h3.5v12H2zM8.5 1H12v12H8.5z" fill="currentColor" /> : <path d="M2.5 1 12.5 7l-10 6z" fill="currentColor" />}
      </svg>
      <span>{running ? 'Pause' : 'Train'}</span>
    </button>
  )
  const stepBtn = (
    <button type="button" className="sm-btn" onClick={stepOnce} title="One optimiser step (S)">
      Step
    </button>
  )
  const resetBtn = (
    <button type="button" className="sm-btn" onClick={reinit} title="Re-initialise the weights (R)">
      Reset
    </button>
  )
  const topBtn = (
    <button type="button" className="sm-btn sm-btn--toggle" aria-pressed={top} onClick={() => setTop((v) => !v)} title="Top-down view (T)">
      Plan view
    </button>
  )

  const bigUI = (
    <div className="sm-big">
      <div>
        <span className="sm-label">Loss</span>
        <strong data-ro="loss" />
      </div>
      <div>
        <span className="sm-label">Accuracy</span>
        <strong data-ro="acc" />
      </div>
    </div>
  )

  return (
    <ExperienceShell meta={meta} ready={ready}>
      <div className="sm" ref={rootRef} data-compact={compact} data-mode={mode}>
        <div className="sm-view">
          <div
            className="sm-canvas"
            ref={wrapRef}
            tabIndex={0}
            role="application"
            aria-label="Three-dimensional surface of the classifier's output. Arrow keys orbit and zoom."
          />
          {glFail && (
            <div className="sm-fail">
              <strong>No WebGL here.</strong>
              <p>The surface can't be drawn on this device, but the network is still training. The loss curve and weights below are live.</p>
            </div>
          )}
          <p className="sm-hint" data-on={hint && !glFail} aria-hidden={!hint}>
            {coarse ? 'Drag to orbit · pinch to zoom' : 'Drag to orbit · scroll to zoom · P to paint'}
          </p>
          {compact && (
            <div className="sm-float">
              {modeUI}
              {mode === 'paint' && brushUI}
              {topBtn}
            </div>
          )}
        </div>

        {!compact && (
          <>
            <aside className="sm-panel sm-panel--l" aria-label="Data">
              <h1 className="sm-mark">Seam</h1>
              <p className="sm-lede">
                A classifier, trained on this page, drawn as terrain. High ground is where it says <em>defect</em>. The bright line is where
                it changes its mind.
              </p>
              <section>
                <h2 className="sm-label">Data</h2>
                {presetsUI}
                <p className="sm-note">{note}</p>
                {noiseUI}
                {dataActions}
              </section>
              <section>
                <h2 className="sm-label">Pointer</h2>
                {modeUI}
                {brushUI}
                {countsUI}
              </section>
              <p className="sm-fine">Toy data on two abstract features. Not weld scans.</p>
            </aside>

            <aside className="sm-panel sm-panel--r" aria-label="Model and readout">
              <section>
                {bigUI}
                {lossUI}
              </section>
              <section>
                <h2 className="sm-label">Network</h2>
                {netUI}
                {modelUI}
              </section>
            </aside>

            <div className="sm-bar" role="toolbar" aria-label="Training">
              {playBtn}
              {stepBtn}
              {resetBtn}
              <i className="sm-bar__rule" />
              {rateUI}
              <i className="sm-bar__rule" />
              {topBtn}
            </div>
          </>
        )}

        {compact && (
          <div className="sm-drawer">
            <div className="sm-drawer__head">
              {playBtn}
              {bigUI}
              <div className="sm-drawer__btns">
                {stepBtn}
                {resetBtn}
              </div>
            </div>
            <div className="sm-tabs" role="tablist" aria-label="Controls">
              {(['train', 'data', 'model'] as Tab[]).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="sm-drawer__body" role="tabpanel">
              {tab === 'train' && (
                <>
                  {lossUI}
                  <div className="sm-row sm-row--stack">
                    <span className="sm-row__k">Speed</span>
                    {rateUI}
                  </div>
                  <p className="sm-fine">
                    High ground is where the model says defect. The bright line is where it changes its mind. Toy data, not weld scans.
                  </p>
                </>
              )}
              {tab === 'data' && (
                <>
                  {presetsUI}
                  <p className="sm-note">{note}</p>
                  {noiseUI}
                  {dataActions}
                  {countsUI}
                </>
              )}
              {tab === 'model' && (
                <>
                  {netUI}
                  {modelUI}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </ExperienceShell>
  )
}
