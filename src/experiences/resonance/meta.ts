import type { ExperienceMeta } from '../types'

export const meta: ExperienceMeta = {
  id: 'resonance',
  index: 1,
  title: 'Resonance',
  tagline: 'An instrument made of light. Play it, or speak into it.',
  kind: 'Audio-reactive 3D instrument',
  origin: {
    where: 'YAP Technologies',
    role: 'Founding Engineer',
    fact: 'Built a real-time voice pipeline (Azure Speech, OpenAI, ElevenLabs, LiveKit) that replies in under 300ms.',
  },
  real: [
    'Every sound is synthesised as you play, with the Web Audio API. There are no samples and no audio files.',
    'The disc is one vertex shader. Each ring follows a band of the live spectrum, bass at the centre, and every note sends a wave across it.',
    'The delay readout is measured on your device: the age of the input event when the note is scheduled, plus the output latency the browser reports.',
    'With the microphone on, pitch is found in the page by autocorrelation. The sound is never recorded, played back or sent anywhere.',
    'The YAP pipeline itself is not in here. What carries over is its constraint: an answer has to arrive fast enough to feel immediate.',
  ],
  controls: [
    { input: 'Touch or click', action: 'Play a note. Slide to run across notes; further from the centre is brighter.' },
    { input: 'Centre', action: 'The bass note of the scale.' },
    { input: 'A S D F G H J K L ;', action: 'The ten notes. Space is the bass, Z and X shift the octave, 1 2 3 change the voice.' },
    { input: 'Rec', action: 'Layer what you play onto an eight-beat loop. R does the same.' },
    { input: 'Drift', action: 'Let it play itself, and play along.' },
    { input: 'Mic', action: 'Sing or speak, and the disc follows your voice.' },
  ],
  stack: ['Three.js', 'GLSL', 'Web Audio API', 'TypeScript'],
  palette: { bg: '#050507', fg: '#f2efe9', accent: '#9be7ff', tone: 'dark' },
}
