export interface ExperienceMeta {
  /** URL slug: /x/<id> */
  id: string
  /** 1-based position in the collection. */
  index: number
  title: string
  /** One line, shown on the hub and in the info sheet. */
  tagline: string
  /** What kind of thing this is, e.g. "Audio-reactive 3D instrument". */
  kind: string
  /** The real work this miniature is drawn from. Facts only. */
  origin: { where: string; role: string; fact: string }
  /** What is genuinely computed in the browser (not faked). */
  real: string[]
  controls: { input: string; action: string }[]
  stack: string[]
  palette: { bg: string; fg: string; accent: string; tone: 'dark' | 'light' }
}
