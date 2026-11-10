/**
 * A small multilayer perceptron, written by hand on typed arrays.
 *
 *   input(2) → [hidden × width, activation]* → 1 logit → sigmoid
 *
 * Loss is binary cross-entropy computed on the logit (numerically stable form),
 * gradients come from reverse-mode backpropagation, and the optimiser is Adam
 * with optional L2 weight decay. No dependencies: the same file runs in the
 * training worker, on the main thread (probe activations), and under Node for
 * the numerical checks.
 */

export type Activation = 'tanh' | 'relu' | 'swish' | 'sigmoid'

export const ACTIVATIONS: Activation[] = ['tanh', 'relu', 'swish', 'sigmoid']

export interface ModelSpec {
  /** Units in each hidden layer, e.g. [8, 8, 8]. */
  hidden: number[]
  activation: Activation
}

const sigmoid = (z: number) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : 1 - 1 / (1 + Math.exp(z)))

/** Stable binary cross-entropy from a logit: max(z,0) − z·y + log(1 + e^−|z|). */
export const bceFromLogit = (z: number, y: number) =>
  Math.max(z, 0) - z * y + Math.log1p(Math.exp(-Math.abs(z)))

export const layerSizes = (spec: ModelSpec) => [2, ...spec.hidden, 1]

/** Number of trainable parameters for a spec. */
export function countParams(spec: ModelSpec) {
  const s = layerSizes(spec)
  let n = 0
  for (let l = 0; l < s.length - 1; l++) n += s[l] * s[l + 1] + s[l + 1]
  return n
}

export class MLP {
  readonly sizes: number[]
  /** Number of weight layers (hidden layers + output layer). */
  readonly L: number
  activation: Activation
  /** All weights and biases, flat. Layer l: W (nout × nin, row-major) then b (nout). */
  readonly params: Float64Array
  readonly grads: Float64Array
  readonly wOff: Int32Array
  readonly bOff: Int32Array
  /** a[0] is the input; a[l+1] is the output of weight layer l. */
  readonly a: Float64Array[]
  readonly z: Float64Array[]
  private readonly delta: Float64Array[]
  /** 1 where the parameter is a weight (decayed), 0 where it is a bias. */
  private readonly isWeight: Uint8Array
  // Adam state
  private readonly m: Float64Array
  private readonly v: Float64Array
  private t = 0

  constructor(spec: ModelSpec, rand: () => number) {
    this.sizes = layerSizes(spec)
    this.L = this.sizes.length - 1
    this.activation = spec.activation
    this.wOff = new Int32Array(this.L)
    this.bOff = new Int32Array(this.L)
    let n = 0
    for (let l = 0; l < this.L; l++) {
      this.wOff[l] = n
      n += this.sizes[l] * this.sizes[l + 1]
      this.bOff[l] = n
      n += this.sizes[l + 1]
    }
    this.params = new Float64Array(n)
    this.grads = new Float64Array(n)
    this.m = new Float64Array(n)
    this.v = new Float64Array(n)
    this.isWeight = new Uint8Array(n)
    for (let l = 0; l < this.L; l++) this.isWeight.fill(1, this.wOff[l], this.bOff[l])
    this.a = this.sizes.map((s) => new Float64Array(s))
    this.z = this.sizes.slice(1).map((s) => new Float64Array(s))
    this.delta = this.sizes.slice(1).map((s) => new Float64Array(s))
    this.init(rand)
  }

  /** He initialisation for ReLU-like units, Xavier/Glorot for saturating ones. Resets Adam. */
  init(rand: () => number) {
    const gauss = () => {
      // Box–Muller
      const u = Math.max(rand(), 1e-12)
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
    }
    const he = this.activation === 'relu' || this.activation === 'swish'
    for (let l = 0; l < this.L; l++) {
      const nin = this.sizes[l]
      const nout = this.sizes[l + 1]
      const last = l === this.L - 1
      const std = he && !last ? Math.sqrt(2 / nin) : Math.sqrt(2 / (nin + nout))
      const w0 = this.wOff[l]
      for (let k = 0; k < nin * nout; k++) this.params[w0 + k] = gauss() * std
      // A small positive bias keeps ReLU units alive at the start; zero elsewhere.
      this.params.fill(this.activation === 'relu' && !last ? 0.05 : 0, this.bOff[l], this.bOff[l] + nout)
    }
    this.m.fill(0)
    this.v.fill(0)
    this.t = 0
  }

  /** Forward pass for one sample. Returns the output logit; activations stay in `a`/`z`. */
  forward(x0: number, x1: number): number {
    const { sizes, L, params, a, z, activation } = this
    a[0][0] = x0
    a[0][1] = x1
    for (let l = 0; l < L; l++) {
      const nin = sizes[l]
      const nout = sizes[l + 1]
      const inp = a[l]
      const out = a[l + 1]
      const zl = z[l]
      let w = this.wOff[l]
      const b = this.bOff[l]
      const last = l === L - 1
      for (let j = 0; j < nout; j++) {
        let s = params[b + j]
        for (let i = 0; i < nin; i++) s += params[w++] * inp[i]
        zl[j] = s
        if (last) out[j] = s
        else if (activation === 'tanh') out[j] = Math.tanh(s)
        else if (activation === 'relu') out[j] = s > 0 ? s : 0
        else if (activation === 'swish') out[j] = s * sigmoid(s)
        else out[j] = sigmoid(s)
      }
    }
    return z[L - 1][0]
  }

  /** Probability of the positive class for one point. */
  predict(x0: number, x1: number) {
    return sigmoid(this.forward(x0, x1))
  }

  /**
   * Backward pass for the sample most recently sent through `forward`.
   * `dz` is ∂loss/∂logit (already scaled by 1/batch). Accumulates into `grads`.
   */
  private backward(dz: number) {
    const { sizes, L, params, grads, a, z, delta, activation } = this
    delta[L - 1][0] = dz
    for (let l = L - 1; l >= 0; l--) {
      const nin = sizes[l]
      const nout = sizes[l + 1]
      const inp = a[l]
      const d = delta[l]
      const w0 = this.wOff[l]
      const b0 = this.bOff[l]
      for (let j = 0; j < nout; j++) {
        const dj = d[j]
        grads[b0 + j] += dj
        const row = w0 + j * nin
        for (let i = 0; i < nin; i++) grads[row + i] += dj * inp[i]
      }
      if (l === 0) break
      const dPrev = delta[l - 1]
      const zPrev = z[l - 1]
      const aPrev = a[l]
      for (let i = 0; i < nin; i++) {
        let s = 0
        for (let j = 0; j < nout; j++) s += params[w0 + j * nin + i] * d[j]
        const av = aPrev[i]
        let g: number
        if (activation === 'tanh') g = 1 - av * av
        else if (activation === 'relu') g = zPrev[i] > 0 ? 1 : 0
        else if (activation === 'swish') {
          const sg = sigmoid(zPrev[i])
          g = sg + zPrev[i] * sg * (1 - sg)
        } else g = av * (1 - av)
        dPrev[i] = s * g
      }
    }
  }

  /**
   * Fills `grads` with the gradient of the mean BCE (+ ½·l2·‖W‖²) over a mini-batch and
   * returns that batch's mean data loss. `idx[start … start+count)` indexes into xs/ys.
   */
  computeGradients(
    xs: Float32Array,
    ys: Uint8Array,
    idx: Uint32Array | Int32Array,
    start: number,
    count: number,
    l2: number,
  ): number {
    const { grads, params, isWeight } = this
    grads.fill(0)
    let loss = 0
    const inv = 1 / count
    for (let k = 0; k < count; k++) {
      const i = idx[start + k]
      const y = ys[i]
      const zOut = this.forward(xs[2 * i], xs[2 * i + 1])
      loss += bceFromLogit(zOut, y)
      this.backward((sigmoid(zOut) - y) * inv)
    }
    if (l2 > 0) for (let p = 0; p < params.length; p++) if (isWeight[p]) grads[p] += l2 * params[p]
    return loss * inv
  }

  /** One Adam update from whatever is currently in `grads`. */
  applyAdam(lr: number, beta1 = 0.9, beta2 = 0.999, eps = 1e-8) {
    const { params, grads, m, v } = this
    this.t++
    const c1 = 1 - Math.pow(beta1, this.t)
    const c2 = 1 - Math.pow(beta2, this.t)
    for (let p = 0; p < params.length; p++) {
      const g = grads[p]
      m[p] = beta1 * m[p] + (1 - beta1) * g
      v[p] = beta2 * v[p] + (1 - beta2) * g * g
      params[p] -= (lr * (m[p] / c1)) / (Math.sqrt(v[p] / c2) + eps)
    }
  }

  /** One optimisation step on a mini-batch. Returns the batch loss before the update. */
  trainBatch(
    xs: Float32Array,
    ys: Uint8Array,
    idx: Uint32Array | Int32Array,
    start: number,
    count: number,
    lr: number,
    l2: number,
  ) {
    const loss = this.computeGradients(xs, ys, idx, start, count, l2)
    this.applyAdam(lr)
    return loss
  }

  /** Mean loss and accuracy over the first `n` samples; optionally writes each probability. */
  evaluate(xs: Float32Array, ys: Uint8Array, n: number, probs?: Float32Array) {
    let loss = 0
    let correct = 0
    for (let i = 0; i < n; i++) {
      const zOut = this.forward(xs[2 * i], xs[2 * i + 1])
      loss += bceFromLogit(zOut, ys[i])
      if ((zOut > 0 ? 1 : 0) === ys[i]) correct++
      if (probs) probs[i] = sigmoid(zOut)
    }
    return n > 0 ? { loss: loss / n, acc: correct / n } : { loss: NaN, acc: NaN }
  }

  /**
   * Evaluates the network on a g×g lattice spanning [−1, 1]² (row 0 is x₂ = −1) and
   * writes the probabilities into `out`.
   */
  evalGrid(out: Float32Array, g: number) {
    const step = 2 / (g - 1)
    let k = 0
    for (let j = 0; j < g; j++) {
      const y = -1 + j * step
      for (let i = 0; i < g; i++) out[k++] = sigmoid(this.forward(-1 + i * step, y))
    }
  }
}

/**
 * Central-difference gradient check. Returns the largest relative error between the
 * backprop gradient and the numerical one across all parameters.
 */
export function gradientCheck(net: MLP, xs: Float32Array, ys: Uint8Array, n: number, l2 = 0, h = 1e-5) {
  const idx = new Uint32Array(n).map((_, i) => i)
  net.computeGradients(xs, ys, idx, 0, n, l2)
  const analytic = Float64Array.from(net.grads)
  const objective = () => {
    let s = 0
    for (let i = 0; i < n; i++) s += bceFromLogit(net.forward(xs[2 * i], xs[2 * i + 1]), ys[i])
    s /= n
    if (l2 > 0) {
      let reg = 0
      for (let l = 0; l < net.L; l++)
        for (let p = net.wOff[l]; p < net.bOff[l]; p++) reg += net.params[p] * net.params[p]
      s += 0.5 * l2 * reg
    }
    return s
  }
  let worst = 0
  for (let p = 0; p < net.params.length; p++) {
    const keep = net.params[p]
    net.params[p] = keep + h
    const up = objective()
    net.params[p] = keep - h
    const down = objective()
    net.params[p] = keep
    const numeric = (up - down) / (2 * h)
    const err = Math.abs(numeric - analytic[p]) / Math.max(1e-8, Math.abs(numeric) + Math.abs(analytic[p]))
    if (Math.abs(numeric) + Math.abs(analytic[p]) > 1e-7 && err > worst) worst = err
  }
  return worst
}
