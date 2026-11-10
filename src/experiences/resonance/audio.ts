import { clamp } from '../../lib/math'

export type Timbre = 'glass' | 'bow' | 'air'
export const TIMBRES: { id: Timbre; name: string }[] = [
  { id: 'glass', name: 'Glass' },
  { id: 'bow', name: 'Bow' },
  { id: 'air', name: 'Air' },
]
/** Five notes each, laid out over two octaves around the disc. */
export const SCALES = [
  { name: 'Minor', steps: [0, 3, 5, 7, 10] },
  { name: 'Major', steps: [0, 2, 4, 7, 9] },
  { name: 'Hirajoshi', steps: [0, 2, 3, 7, 8] },
  { name: 'Insen', steps: [0, 1, 5, 7, 10] },
]

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
export const pitchClass = (midi: number) => NAMES[((Math.round(midi) % 12) + 12) % 12]
export const octaveOf = (midi: number) => Math.floor(Math.round(midi) / 12) - 1
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
export const toMidi = (f: number) => 69 + 12 * Math.log2(f / 440)

export const BANDS = 64
export const WAVE = 256
const FFT = 2048
const MAX_HELD = 10

interface Voice {
  oscs: OscillatorNode[]
  nodes: AudioNode[]
  amp: GainNode
  filter: BiquadFilterNode
  cut: (bright: number) => number
  t0: number
  atk: number
  rel: number
}

export class Engine {
  readonly ctx: AudioContext
  timbre: Timbre = 'glass'
  private bus: GainNode
  private analyser: AnalyserNode
  private voices = new Map<number, Voice>()
  private freq = new Uint8Array(FFT / 2)
  private time = new Uint8Array(FFT)
  private edges = new Float32Array(BANDS + 1)
  private stream: MediaStream | null = null
  private micNode: MediaStreamAudioSourceNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private micFreq = new Uint8Array(FFT / 2)
  private micTime = new Uint8Array(FFT)
  private micFloat = new Float32Array(FFT)
  private diff = new Float32Array(FFT / 2)

  constructor() {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    this.ctx = ctx

    const bus = ctx.createGain()
    bus.gain.value = 0.5
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.2

    // A dotted-eighth echo at 90 BPM, darkened on every repeat.
    const send = ctx.createGain()
    send.gain.value = 0.26
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.5
    const damp = ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 2200
    const feedback = ctx.createGain()
    feedback.gain.value = 0.34

    const hall = ctx.createConvolver()
    hall.buffer = impulse(ctx, 3.2)
    const wet = ctx.createGain()
    wet.gain.value = 0.4

    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT
    analyser.smoothingTimeConstant = 0.8
    analyser.minDecibels = -88
    analyser.maxDecibels = -20

    bus.connect(comp)
    bus.connect(send).connect(delay).connect(comp)
    delay.connect(damp).connect(feedback).connect(delay)
    bus.connect(hall)
    delay.connect(hall)
    hall.connect(wet).connect(comp)
    comp.connect(analyser).connect(ctx.destination)

    this.bus = bus
    this.analyser = analyser

    const bin = ctx.sampleRate / FFT
    for (let i = 0; i <= BANDS; i++) this.edges[i] = (50 * 150 ** (i / BANDS)) / bin
  }

  resume() {
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** What the browser reports between scheduling a sound and hearing it, in milliseconds. */
  get latency() {
    return (this.ctx.baseLatency + (this.ctx.outputLatency || 0)) * 1000
  }

  noteOn(id: number, midi: number, bright: number, vel: number, pan: number, when = this.ctx.currentTime) {
    const { ctx } = this
    if (this.voices.size >= MAX_HELD) this.noteOff(this.voices.keys().next().value as number, when, 0.03)

    const f = hz(midi)
    const amp = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    const panner = ctx.createStereoPanner()
    panner.pan.value = clamp(pan, -1, 1)
    amp.connect(filter).connect(panner).connect(this.bus)

    const oscs: OscillatorNode[] = []
    const nodes: AudioNode[] = [amp, filter, panner]
    const osc = (type: OscillatorType, freq: number, level: number, detune = 0) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      o.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = level
      o.connect(g).connect(amp)
      oscs.push(o)
      nodes.push(o, g)
      return o
    }
    const modulate = (freq: number) => {
      const o = ctx.createOscillator()
      o.frequency.value = freq
      const g = ctx.createGain()
      o.connect(g)
      oscs.push(o)
      nodes.push(o, g)
      return g
    }

    let atk: number
    let rel: number
    let peak: number
    let cut: (b: number) => number
    const g = amp.gain
    g.setValueAtTime(0, when)

    if (this.timbre === 'glass') {
      // A two-operator FM bell: the modulation falls away faster than the note, so it starts bright and rings pure.
      atk = 0.004
      rel = 0.3
      peak = vel * 0.62
      cut = (b) => 1500 + b * 7500
      const carrier = osc('sine', f, 1)
      osc('sine', f * 2, 0.14)
      const index = modulate(f * 3.5)
      index.gain.setValueAtTime(f * (1 + bright * 3.4), when)
      index.gain.setTargetAtTime(f * 0.12, when, 0.2)
      index.connect(carrier.frequency)
      g.linearRampToValueAtTime(peak, when + atk)
      g.setTargetAtTime(peak * 0.1, when + atk, 0.85)
      filter.frequency.setValueAtTime(cut(bright), when)
    } else if (this.timbre === 'bow') {
      atk = 0.09
      rel = 0.28
      peak = vel * 0.3
      cut = (b) => 420 + b * 2800
      osc('sawtooth', f, 0.5, -7)
      osc('sawtooth', f, 0.5, 7)
      osc('sine', f / 2, 0.35)
      filter.Q.value = 2.5
      g.linearRampToValueAtTime(peak, when + atk)
      g.setTargetAtTime(peak * 0.8, when + atk, 0.4)
      filter.frequency.setValueAtTime(cut(bright) * 0.4, when)
      filter.frequency.setTargetAtTime(cut(bright), when, 0.14)
    } else {
      atk = 0.05
      rel = 0.42
      peak = vel * 0.5
      cut = (b) => 900 + b * 3600
      const a = osc('triangle', f, 1)
      const b = osc('sine', f * 2, 0.22)
      const vibrato = modulate(5.2)
      vibrato.gain.setValueAtTime(0, when)
      vibrato.gain.setTargetAtTime(11, when + 0.18, 0.3)
      vibrato.connect(a.detune)
      vibrato.connect(b.detune)
      g.linearRampToValueAtTime(peak, when + atk)
      g.setTargetAtTime(peak * 0.85, when + atk, 0.5)
      filter.frequency.setValueAtTime(cut(bright), when)
    }

    for (const o of oscs) o.start(when)
    this.voices.set(id, { oscs, nodes, amp, filter, cut, t0: when, atk, rel })
  }

  noteOff(id: number, when = this.ctx.currentTime, rel?: number) {
    const v = this.voices.get(id)
    if (!v) return
    this.voices.delete(id)
    // Never cut into the attack ramp: the release takes over from wherever the envelope has got to.
    const t = Math.max(when, v.t0 + v.atk + 0.01)
    const tau = rel ?? v.rel
    v.amp.gain.cancelScheduledValues(t)
    v.amp.gain.setTargetAtTime(0, t, tau)
    for (const o of v.oscs) o.stop(t + tau * 7)
    v.oscs[0].onended = () => {
      for (const n of v.nodes) n.disconnect()
    }
  }

  setBright(id: number, bright: number) {
    const v = this.voices.get(id)
    if (v) v.filter.frequency.setTargetAtTime(v.cut(bright), this.ctx.currentTime, 0.06)
  }

  /** The microphone feeds the analysers only. It is never connected to the output. */
  async startMic() {
    if (this.stream) return
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    const node = this.ctx.createMediaStreamSource(stream)
    const analyser = this.ctx.createAnalyser()
    analyser.fftSize = FFT
    analyser.smoothingTimeConstant = 0.72
    analyser.minDecibels = -88
    analyser.maxDecibels = -24
    node.connect(analyser)
    this.stream = stream
    this.micNode = node
    this.micAnalyser = analyser
  }

  stopMic() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.micNode?.disconnect()
    this.stream = null
    this.micNode = null
    this.micAnalyser = null
  }

  /** Fills log-spaced spectrum bands and a slice of waveform; returns the overall level, 0 to 1. */
  levels(bands: Uint8Array, wave: Uint8Array) {
    const { freq, micFreq, edges } = this
    const mic = this.micAnalyser
    this.analyser.getByteFrequencyData(freq)
    this.analyser.getByteTimeDomainData(this.time)
    if (mic) {
      mic.getByteFrequencyData(micFreq)
      mic.getByteTimeDomainData(this.micTime)
    }
    const at = (i: number) => (mic ? Math.max(freq[i], micFreq[i]) : freq[i])
    let sum = 0
    for (let b = 0; b < BANDS; b++) {
      const lo = edges[b]
      const hi = edges[b + 1]
      let v = 0
      if (hi - lo < 1) {
        const c = (lo + hi) / 2
        const i = Math.floor(c)
        v = at(i) + (at(i + 1) - at(i)) * (c - i)
      } else {
        for (let i = Math.floor(lo); i < hi; i++) v = Math.max(v, at(i))
      }
      bands[b] = v
      sum += v
    }
    const stride = Math.floor(FFT / WAVE / 2)
    for (let i = 0; i < WAVE; i++) {
      const s = this.time[i * stride] - 128 + (mic ? this.micTime[i * stride] - 128 : 0)
      wave[i] = clamp(128 + s, 0, 255)
    }
    return sum / (BANDS * 255)
  }

  /** Fundamental of the microphone signal in Hz, by normalised autocorrelation difference (YIN), or null. */
  pitch() {
    const mic = this.micAnalyser
    if (!mic) return null
    const x = this.micFloat
    const d = this.diff
    mic.getFloatTimeDomainData(x)
    let power = 0
    for (let i = 0; i < FFT; i++) power += x[i] * x[i]
    if (Math.sqrt(power / FFT) < 0.012) return null

    const sr = this.ctx.sampleRate
    const min = Math.floor(sr / 1000)
    const max = Math.min(d.length - 1, Math.floor(sr / 70))
    const span = FFT - max
    let run = 0
    for (let tau = 1; tau <= max; tau++) {
      let sum = 0
      for (let i = 0; i < span; i++) {
        const delta = x[i] - x[i + tau]
        sum += delta * delta
      }
      run += sum
      d[tau] = run > 0 ? (sum * tau) / run : 1
    }
    for (let tau = min; tau < max; tau++) {
      if (d[tau] >= 0.12) continue
      while (tau + 1 < max && d[tau + 1] < d[tau]) tau++
      const curve = d[tau - 1] - 2 * d[tau] + d[tau + 1]
      const shift = curve ? (d[tau - 1] - d[tau + 1]) / (2 * curve) : 0
      return sr / (tau + shift)
    }
    return null
  }

  dispose() {
    this.stopMic()
    void this.ctx.close()
  }
}

/** A hall made of decaying noise, so no impulse recording has to be downloaded. */
function impulse(ctx: AudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let low = 0
    for (let i = 0; i < len; i++) {
      const k = i / len
      // The tail loses its top end as it fades, the way a real room does.
      low += (Math.random() * 2 - 1 - low) * (0.75 - 0.6 * k)
      data[i] = low * (1 - k) ** 3.2
    }
  }
  return buf
}

export const BPM = 90
export const LOOP_BEATS = 8
export const STEPS = 32

export interface LoopNote {
  /** Start, in beats from the top of the loop. */
  at: number
  /** Length in beats. */
  dur: number
  sector: number
  bright: number
  vel: number
  t0: number
  /** Not replayed before this time, so a note is not doubled on the pass it was recorded in. */
  skip: number
}

/** A fixed-length loop on the audio clock. Notes are handed back slightly ahead of time for exact scheduling. */
export class Looper {
  notes: LoopNote[] = []
  readonly beat = 60 / BPM
  readonly length = (LOOP_BEATS * 60) / BPM
  private origin: number
  private cursor: number
  private timer: number

  constructor(
    private ctx: AudioContext,
    private onNote: (n: LoopNote, when: number) => void,
    private onStep: (step: number, when: number) => void,
  ) {
    this.origin = ctx.currentTime + 0.05
    this.cursor = this.origin
    this.timer = window.setInterval(() => this.tick(), 25)
  }

  /** Position in the loop, 0 to 1. */
  phase() {
    const p = ((this.ctx.currentTime - this.origin) / this.length) % 1
    return p < 0 ? p + 1 : p
  }

  private tick() {
    const now = this.ctx.currentTime
    const horizon = now + 0.12
    // After a throttled or suspended stretch, pick up from now instead of replaying the gap.
    if (this.cursor < now - 0.3) this.cursor = now
    const { origin, length, cursor } = this
    if (horizon <= cursor) return

    const step = length / STEPS
    for (let k = Math.max(0, Math.floor((cursor - origin) / step)); ; k++) {
      const t = origin + k * step
      if (t >= horizon) break
      if (t >= cursor) this.onStep(k % STEPS, t)
    }
    const pass = Math.max(0, Math.floor((cursor - origin) / length))
    for (const n of this.notes) {
      for (let k = pass; k <= pass + 1; k++) {
        const t = origin + (k + n.at / LOOP_BEATS) * length
        if (t >= cursor && t < horizon && t >= n.skip) this.onNote(n, t)
      }
    }
    this.cursor = horizon
  }

  /** Records a note starting now, snapped to the nearest sixteenth. */
  add(sector: number, bright: number, vel: number) {
    const now = this.ctx.currentTime
    const at = (Math.round(this.phase() * STEPS) % STEPS) * (LOOP_BEATS / STEPS)
    const note: LoopNote = { at, dur: 0.5, sector, bright, vel, t0: now, skip: now + 0.3 }
    this.notes.push(note)
    return note
  }

  /** Sets a recorded note's length once it is let go. */
  close(note: LoopNote) {
    note.dur = clamp((this.ctx.currentTime - note.t0) / this.beat, 0.2, LOOP_BEATS - 0.5)
  }

  clear() {
    this.notes = []
  }

  dispose() {
    window.clearInterval(this.timer)
  }
}
