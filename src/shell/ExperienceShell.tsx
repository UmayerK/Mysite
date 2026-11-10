import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { ExperienceMeta } from '../experiences/types'
import { experiences, neighbours, pathOf } from '../experiences/registry'
import { useIsMobile, usePrefersReducedMotion } from '../lib/hooks'
import { useCurtainReady, useTransition } from './transition'
import './shell.css'

interface Props {
  meta: ExperienceMeta
  /** Hold the entrance curtain until heavy setup (WebGL, WASM) has finished. Defaults to true. */
  ready?: boolean
  children: ReactNode
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Frame shared by every experience: full-viewport stage, minimal top chrome
 * (back to index, info), and the info sheet. Everything else belongs to the experience.
 */
export function ExperienceShell({ meta, ready = true, children }: Props) {
  const { go } = useTransition()
  const [open, setOpen] = useState(false)
  useCurtainReady(ready)

  useEffect(() => {
    const prevTitle = document.title
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const prevTheme = theme?.content
    const prevBg = document.body.style.background
    document.title = `${meta.title} — ${pad(meta.index)} / Umayer Khan`
    if (theme) theme.content = meta.palette.bg
    document.body.style.background = meta.palette.bg
    document.documentElement.style.background = meta.palette.bg
    return () => {
      document.title = prevTitle
      if (theme && prevTheme) theme.content = prevTheme
      document.body.style.background = prevBg
      document.documentElement.style.background = ''
    }
  }, [meta])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const vars = {
    '--x-bg': meta.palette.bg,
    '--x-fg': meta.palette.fg,
    '--x-accent': meta.palette.accent,
  } as CSSProperties

  return (
    <div className="xp" data-tone={meta.palette.tone} style={vars}>
      <main className="xp__stage" inert={open}>
        {children}
      </main>

      <header className="xp__chrome">
        <button className="xp-chip" onClick={() => go('/')} aria-label="Back to the index">
          <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
            <path d="M5 1 1 5l4 4M1 5h12" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span>Index</span>
        </button>
        <button
          className="xp-chip"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="xp-chip__dim">
            {pad(meta.index)}/{pad(experiences.length)}
          </span>
          <span className="xp-chip__title">{meta.title}</span>
          <span className="xp-chip__info" aria-hidden="true">
            i
          </span>
          <span className="sr-only">About this piece</span>
        </button>
      </header>

      <AnimatePresence>
        {open && <InfoSheet meta={meta} onClose={() => setOpen(false)} onGo={go} />}
      </AnimatePresence>
    </div>
  )
}

function InfoSheet({
  meta,
  onClose,
  onGo,
}: {
  meta: ExperienceMeta
  onClose: () => void
  onGo: (to: string) => void
}) {
  const mobile = useIsMobile()
  const reduced = usePrefersReducedMotion()
  const drag = useDragControls()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { prev, next } = neighbours(meta)

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    return () => prevFocus?.focus?.({ preventScroll: true })
  }, [])

  const hidden = reduced ? { opacity: 0 } : mobile ? { y: '100%' } : { x: '100%' }
  const shown = reduced ? { opacity: 1 } : mobile ? { y: 0 } : { x: 0 }

  return (
    <>
      <motion.div
        className="xp-sheet__scrim"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
      <motion.aside
        className="xp-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={hidden}
        animate={shown}
        exit={hidden}
        transition={{ type: 'spring', stiffness: 320, damping: 36, mass: 0.9 }}
        drag={mobile && !reduced ? 'y' : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose()
        }}
      >
        {mobile && (
          <div
            className="xp-sheet__grab"
            onPointerDown={(e) => drag.start(e)}
            aria-hidden="true"
          >
            <i />
          </div>
        )}
        <div className="xp-sheet__scroll">
          <div className="xp-sheet__top">
            <span className="xp-sheet__eyebrow">
              {pad(meta.index)} / {pad(experiences.length)} — {meta.kind}
            </span>
            <button ref={closeRef} className="xp-sheet__close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="m2 2 10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          </div>

          <h2 id={titleId} className="xp-sheet__title">
            {meta.title}
          </h2>
          <p className="xp-sheet__tagline">{meta.tagline}</p>

          <section>
            <h3>Drawn from</h3>
            <p className="xp-sheet__origin">
              <strong>{meta.origin.where}</strong>
              <span>{meta.origin.role}</span>
            </p>
            <p>{meta.origin.fact}</p>
          </section>

          {meta.real.length > 0 && (
            <section>
              <h3>What is real here</h3>
              <ul className="xp-sheet__list">
                {meta.real.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {meta.controls.length > 0 && (
            <section>
              <h3>Controls</h3>
              <dl className="xp-sheet__controls">
                {meta.controls.map((c) => (
                  <div key={c.input}>
                    <dt>{c.input}</dt>
                    <dd>{c.action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section>
            <h3>Built with</h3>
            <ul className="xp-sheet__stack">
              {meta.stack.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>

          <nav className="xp-sheet__nav" aria-label="Other pieces">
            <button onClick={() => onGo(pathOf(prev.meta))}>
              <span>Previous</span>
              <strong>{prev.meta.title}</strong>
            </button>
            <button onClick={() => onGo(pathOf(next.meta))}>
              <span>Next</span>
              <strong>{next.meta.title}</strong>
            </button>
          </nav>
        </div>
      </motion.aside>
    </>
  )
}
