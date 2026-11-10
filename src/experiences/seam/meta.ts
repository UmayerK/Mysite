import type { ExperienceMeta } from '../types'

export const meta: ExperienceMeta = {
  id: 'seam',
  index: 4,
  title: 'Seam',
  tagline: 'Train a neural network in your browser and walk the surface it learns.',
  kind: 'In-browser machine learning, in 3D',
  origin: {
    where: 'Center of Diagnostic Imaging Research',
    role: 'Machine Learning Research Assistant',
    fact: 'Trains deep learning models in PyTorch and OpenCV that classify weld quality as good or bad.',
  },
  real: [
    'A multilayer perceptron written by hand on typed arrays: forward pass, backpropagation and Adam, no ML library.',
    'Training runs live in a Web Worker. Loss, accuracy and steps per second are measured, not animated.',
    'The terrain is the network itself: its output on a 96 × 96 lattice, re-evaluated about 16 times a second.',
    'The data is a toy: point clouds on two abstract features. It stands in for a good/bad classifier, not for real weld scans.',
  ],
  controls: [
    { input: 'Drag', action: 'Orbit the surface. Scroll or pinch to zoom.' },
    { input: 'Paint', action: 'Add defect or sound samples, or erase them, and watch the model adapt.' },
    { input: 'Space', action: 'Start or pause training.' },
    { input: 'S / R', action: 'Take a single optimiser step / re-initialise the weights.' },
    { input: 'T / P', action: 'Toggle the top-down view / the paint tool.' },
  ],
  stack: ['Three.js', 'GLSL', 'Hand-written backprop', 'Web Workers', 'TypeScript'],
  palette: { bg: '#0e0f11', fg: '#e9e4dc', accent: '#ff6a1a', tone: 'dark' },
}
