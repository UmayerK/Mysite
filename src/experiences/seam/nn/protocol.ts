import type { ModelSpec } from './mlp'

/** Side length of the lattice the network is evaluated on for the terrain. */
export const GRID = 96
export type ToWorker =
  | { type: 'reset'; spec: ModelSpec; seed: number }
  | { type: 'data'; xs: Float32Array; ys: Uint8Array; n: number }
  | { type: 'hyper'; lr: number; l2: number; rate: number }
  | { type: 'run'; on: boolean }
  | { type: 'step' }

export interface Frame {
  type: 'frame'
  grid: Float32Array
  probs: Float32Array
  params: Float32Array
  sizes: number[]
  loss: number
  acc: number
  step: number
  /** Measured optimiser steps per second over the last frame interval. */
  sps: number
}
