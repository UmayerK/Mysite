import type { ExperienceMeta } from '../types'

export const meta: ExperienceMeta = {
  id: 'glyph',
  index: 5,
  title: 'Glyph',
  tagline: 'A tiny language for posters. Write a few lines; a real compiler draws them.',
  kind: 'Live-coding language and compiler',
  origin: {
    where: 'Vista (Cimpress)',
    role: 'Software Engineer Intern',
    fact: 'Built a domain-specific language and compiler with ANTLR to automate print template management, cutting design tickets 60%.',
  },
  real: [
    'The lexer, parser and evaluator are written by hand in TypeScript, about 700 lines, with no parser generator and no eval.',
    'Every keystroke runs the whole pipeline: characters to tokens, tokens to a syntax tree, the tree to shapes, shapes to SVG. The timings shown are measured.',
    'Each ink is a separate plate blended with multiply, so overlaps mix like a risograph. Taking a plate off shows the real separation.',
    'Errors carry their source span and say which stage stopped. The poster keeps its last good print.',
    'Exports are standalone files with the fonts embedded. A shared link holds the entire program, deflated into the URL.',
  ],
  controls: [
    { input: 'Type', action: 'Edit the program; the poster recompiles as you go' },
    { input: 'Drag a number', action: 'Scrub its value in place (Shift for ×10)' },
    { input: 'Click a shape', action: 'Jump to the line that drew it' },
    { input: 'Plates', action: 'Take an ink off the press' },
    { input: 'Swipe the poster', action: 'Next or previous poster' },
  ],
  stack: ['Hand-written lexer and parser', 'SVG', 'React', 'TypeScript'],
  palette: { bg: '#f2e8d5', fg: '#1c1a17', accent: '#ff4f9a', tone: 'light' },
}
