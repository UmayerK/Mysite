/** Glyph, stage 4: scene → SVG. One group per ink, overprinted the way a riso lays down drums. */
import type { Span } from './parser'
import { H, W, fmt, type Scene } from './run'

export interface EmitOptions {
  /** Plates to leave off the press, by colour. */
  hidden?: Set<string>
  /** Outline every shape that came from this stretch of source. */
  focus?: Span | null
  /** A complete file: pixel size, grain baked in, fonts embedded. */
  standalone?: { width: number; fontCss: string }
}

/** Paper-coloured specks over the whole sheet, so solid ink breaks up like soy ink on uncoated stock. */
export function grainMarkup(scene: Pick<Scene, 'paper' | 'grain'>, id: string) {
  if (scene.grain <= 0) return ''
  const v = parseInt(scene.paper.css.length === 4 ? scene.paper.css.replace(/[0-9a-f]/gi, (c) => c + c).slice(1) : scene.paper.css.slice(1), 16)
  const [r, g, b] = [v >> 16, (v >> 8) & 255, v & 255].map((c) => fmt(c / 255))
  const bias = fmt(-(9.7 - scene.grain * 1.7))
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="3.1" numOctaves="2" seed="4"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 14 0 0 0 ${bias}"/>` +
    `</filter><rect width="${W}" height="${H}" filter="url(#${id})" opacity="0.8"/>`
  )
}

/** Each plate slips a little, in its own direction. */
const slip = (k: number, amount: number) => {
  const a = k * 2.399963 + 0.6
  return amount > 0 ? ` transform="translate(${fmt(Math.cos(a) * amount)} ${fmt(Math.sin(a) * amount)})"` : ''
}

export function emit(scene: Scene, o: EmitOptions = {}): string {
  const out: string[] = []
  const live = !o.standalone
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${o.standalone ? ` width="${o.standalone.width}" height="${Math.round((o.standalone.width * H) / W)}"` : ''}>`,
  )
  if (o.standalone?.fontCss) out.push(`<style>${o.standalone.fontCss}</style>`)
  out.push(`<clipPath id="gl-sheet"><rect width="${W}" height="${H}"/></clipPath>`)
  out.push(`<rect width="${W}" height="${H}" fill="${scene.paper.css}"/>`)
  out.push(`<g clip-path="url(#gl-sheet)" style="isolation:isolate">`)
  const blend = scene.dark ? 'screen' : 'multiply'
  scene.plates.forEach((plate, k) => {
    if (o.hidden?.has(plate.css)) return
    out.push(`<g style="mix-blend-mode:${blend}" color="${plate.css}"${slip(k, scene.misprint)}>`)
    for (const s of plate.shapes) {
      const paint = s.outline ? ` fill="none" stroke="currentColor" stroke-width="${fmt(s.outline)}"` : ` fill="currentColor"`
      out.push(s.open + paint + (s.tint < 1 ? ` opacity="${fmt(s.tint)}"` : '') + (live ? ` data-s="${s.start}" data-e="${s.end}"` : '') + s.close)
    }
    out.push('</g>')
  })
  out.push('</g>')
  if (o.focus) {
    const { start, end } = o.focus
    let n = 0
    out.push(`<g fill="none" stroke="${scene.dark ? '#fff' : '#1c1a17'}" stroke-width="1.25" stroke-dasharray="5 4" pointer-events="none">`)
    scene.plates.forEach((plate, k) => {
      if (o.hidden?.has(plate.css)) return
      out.push(`<g${slip(k, scene.misprint)}>`)
      for (const s of plate.shapes) {
        if (s.start >= start && s.end <= end && n++ < 600) out.push(`${s.open} vector-effect="non-scaling-stroke"${s.close}`)
      }
      out.push('</g>')
    })
    out.push('</g>')
  }
  if (o.standalone) out.push(grainMarkup(scene, 'gl-grain'))
  out.push('</svg>')
  return out.join('')
}
