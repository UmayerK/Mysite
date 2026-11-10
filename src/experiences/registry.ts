import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { ExperienceMeta } from './types'
import { meta as resonance } from './resonance/meta'
import { meta as zero } from './zero/meta'
import { meta as radius } from './radius/meta'
import { meta as seam } from './seam/meta'
import { meta as glyph } from './glyph/meta'

export interface Experience {
  meta: ExperienceMeta
  Component: LazyExoticComponent<ComponentType>
  /** Warm the chunk (called on hover / when a card scrolls into view). */
  preload: () => Promise<unknown>
}

const entry = (meta: ExperienceMeta, load: () => Promise<{ default: ComponentType }>): Experience => ({
  meta,
  Component: lazy(load),
  preload: load,
})

export const experiences: Experience[] = [
  entry(resonance, () => import('./resonance')),
  entry(zero, () => import('./zero')),
  entry(radius, () => import('./radius')),
  entry(seam, () => import('./seam')),
  entry(glyph, () => import('./glyph')),
]

export const pathOf = (meta: ExperienceMeta) => `/x/${meta.id}`
export const byId = (id: string) => experiences.find((e) => e.meta.id === id)
export const neighbours = (meta: ExperienceMeta) => {
  const i = experiences.findIndex((e) => e.meta.id === meta.id)
  const n = experiences.length
  return { prev: experiences[(i - 1 + n) % n], next: experiences[(i + 1) % n] }
}
