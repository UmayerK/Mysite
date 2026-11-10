/**
 * Synthetic two-class datasets on the feature plane [−1, 1]².
 * Label 1 = "defect", label 0 = "sound". These are toy point clouds on two abstract
 * features: they stand in for the idea of a good/bad classifier, not for real weld data.
 */

export type PresetId = 'spiral' | 'rings' | 'moons' | 'xor' | 'clusters' | 'blank'

export interface Preset {
  id: PresetId
  label: string
  /** One-line description shown under the preset row. */
  note: string
}

export const PRESETS: Preset[] = [
  { id: 'spiral', label: 'Spiral', note: 'Two interleaved arms. Needs depth to unwind.' },
  { id: 'rings', label: 'Rings', note: 'Core and outer band of defects around a sound ring.' },
  { id: 'moons', label: 'Moons', note: 'Two interlocking crescents.' },
  { id: 'xor', label: 'Checker', note: 'XOR quadrants. Not linearly separable.' },
  { id: 'clusters', label: 'Clusters', note: 'Small defect pockets in a sound field.' },
  { id: 'blank', label: 'Blank', note: 'Empty plane. Paint your own samples.' },
]

export interface Dataset {
  xs: Float32Array
  ys: Uint8Array
  n: number
}

export const MAX_SAMPLES = 900

const clampPt = (v: number) => Math.min(0.98, Math.max(-0.98, v))

export function generate(id: PresetId, noise: number, rand: () => number): Dataset {
  const px: number[] = []
  const py: number[] = []
  const lab: number[] = []
  const gauss = () => {
    const u = Math.max(rand(), 1e-12)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  /** `noise` 0…1 scales positional jitter; every preset keeps a little so points never stack. */
  const jitter = 0.012 + noise * 0.11
  const push = (x: number, y: number, c: number) => {
    px.push(clampPt(x + gauss() * jitter))
    py.push(clampPt(y + gauss() * jitter))
    lab.push(c)
  }

  switch (id) {
    case 'spiral': {
      const per = 130
      const turns = 1.6
      for (let c = 0; c < 2; c++) {
        for (let i = 0; i < per; i++) {
          const t = (i + rand() * 0.9) / per
          const r = 0.07 + 0.85 * t
          const ang = t * turns * Math.PI * 2 + c * Math.PI
          push(r * Math.cos(ang), r * Math.sin(ang), c)
        }
      }
      break
    }
    case 'rings': {
      for (let i = 0; i < 70; i++) {
        const r = 0.2 * Math.sqrt(rand())
        const a = rand() * Math.PI * 2
        push(r * Math.cos(a), r * Math.sin(a), 1)
      }
      for (let i = 0; i < 110; i++) {
        const r = 0.5 + (rand() - 0.5) * 0.12
        const a = rand() * Math.PI * 2
        push(r * Math.cos(a), r * Math.sin(a), 0)
      }
      for (let i = 0; i < 130; i++) {
        const r = 0.86 + (rand() - 0.5) * 0.12
        const a = rand() * Math.PI * 2
        push(r * Math.cos(a), r * Math.sin(a), 1)
      }
      break
    }
    case 'moons': {
      const per = 130
      for (let i = 0; i < per; i++) {
        const a = Math.PI * ((i + rand()) / per)
        push(-0.28 + 0.62 * Math.cos(a), -0.12 + 0.62 * Math.sin(a) * 0.95, 0)
        push(0.28 - 0.62 * Math.cos(a), 0.2 - 0.62 * Math.sin(a) * 0.95, 1)
      }
      break
    }
    case 'xor': {
      for (let i = 0; i < 260; i++) {
        const x = (rand() * 2 - 1) * 0.9
        const y = (rand() * 2 - 1) * 0.9
        // keep a clean gutter along both axes so the checker reads at zero noise
        if (Math.abs(x) < 0.07 || Math.abs(y) < 0.07) {
          i--
          continue
        }
        push(x, y, x * y < 0 ? 1 : 0)
      }
      break
    }
    case 'clusters': {
      const pockets = [
        [-0.52, 0.42, 0.13],
        [0.5, 0.5, 0.1],
        [0.18, -0.5, 0.15],
        [-0.55, -0.45, 0.09],
      ]
      for (const [cx, cy, s] of pockets) {
        for (let i = 0; i < 28; i++) push(cx + gauss() * s * 0.6, cy + gauss() * s * 0.6, 1)
      }
      let placed = 0
      while (placed < 190) {
        const x = (rand() * 2 - 1) * 0.94
        const y = (rand() * 2 - 1) * 0.94
        let free = true
        for (const [cx, cy, s] of pockets) if (Math.hypot(x - cx, y - cy) < s * 1.9) free = false
        if (!free) continue
        push(x, y, 0)
        placed++
      }
      break
    }
    case 'blank':
      break
  }

  const n = px.length
  const xs = new Float32Array(n * 2)
  const ys = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    xs[2 * i] = px[i]
    xs[2 * i + 1] = py[i]
    ys[i] = lab[i]
  }
  return { xs, ys, n }
}
