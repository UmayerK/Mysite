import type { ExperienceMeta } from '../types'

export const meta: ExperienceMeta = {
  id: 'radius',
  index: 3,
  title: 'Radius',
  tagline: 'A live market where print plants bid for orders. Tune the agent and try to beat it.',
  kind: 'Interactive market simulation',
  origin: {
    where: 'Vista (Cimpress)',
    role: 'Software Engineer Intern',
    fact: 'Created Radius, a marketplace where plants bid on print orders in timed rounds, plus the AI agent that bids to fill press runs.',
  },
  real: [
    'A complete auction engine runs in your browser: orders arrive, six plants quote from their own costs and press backlog, and every round is scored and settled.',
    'It advances on a fixed 30 Hz timestep from a seeded generator, so a market number always deals the same orders in the same places.',
    'A second copy of the shift runs in lockstep with the stock agent in your seat. The comparison is measured, not scripted.',
    'The market, its plants, costs and prices are invented for this demo. Nothing here is Vista data.',
    'Bids are scored on price, distance and speed with weights that change by scenario, and every bid shows its three parts.',
  ],
  controls: [
    { input: 'Drag the yellow circle', action: 'Set how far your agent will bid' },
    { input: 'Margin and Fill', action: 'Change what your agent asks for a job' },
    { input: 'Click an order', action: 'Open its round and bid by hand' },
    { input: 'Scenario', action: 'Restart the shift under different rules' },
    { input: 'Space, 1× to 8×', action: 'Pause or speed up the market' },
  ],
  stack: ['React', 'Canvas 2D', 'TypeScript'],
  palette: { bg: '#1f2bd6', fg: '#f4eedd', accent: '#ffd400', tone: 'dark' },
}
