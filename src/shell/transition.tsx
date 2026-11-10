import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router'
import gsap from 'gsap'
import { byId } from '../experiences/registry'
import './transition.css'

interface Cover {
  bg: string
  fg: string
  index: string
  label: string
}

export const HUB_COVER: Cover = { bg: '#0a0a0b', fg: '#f2efe9', index: 'UK', label: 'Index' }

const coverFor = (path: string): Cover => {
  const id = path.match(/^\/x\/([\w-]+)/)?.[1]
  const xp = id ? byId(id) : undefined
  if (!xp) return HUB_COVER
  const { palette, index, title } = xp.meta
  return { bg: palette.bg, fg: palette.fg, index: String(index).padStart(2, '0'), label: title }
}

interface TransitionApi {
  /** Navigate behind a full-screen curtain in the destination's colours. */
  go: (to: string) => void
  /** Called by the mounted route once it can be shown. */
  ready: () => void
}

const Ctx = createContext<TransitionApi>({ go: () => {}, ready: () => {} })
export const useTransition = () => useContext(Ctx)

/** Lift the curtain once `isReady` is true (after the first painted frame). */
export function useCurtainReady(isReady = true) {
  const { ready } = useTransition()
  useEffect(() => {
    if (!isReady) return
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(ready)
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [isReady, ready])
}

type Phase = 'idle' | 'in' | 'covered' | 'out'
const MIN_COVERED_MS = 420

export function TransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const root = useRef<HTMLDivElement>(null)
  const phase = useRef<Phase>('covered')
  const pendingReady = useRef(false)
  const coveredAt = useRef(performance.now())
  const selfNavigated = useRef(true) // first paint counts as ours: the curtain starts down
  const [cover, setCover] = useState<Cover>(() => coverFor(window.location.pathname))
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const reveal = useCallback(() => {
    const el = root.current
    if (!el || phase.current !== 'covered') return
    const wait = Math.max(0, MIN_COVERED_MS - (performance.now() - coveredAt.current))
    phase.current = 'out'
    pendingReady.current = false
    const tl = gsap.timeline({
      delay: wait / 1000,
      onComplete: () => {
        phase.current = 'idle'
        el.dataset.phase = 'idle'
        gsap.set(el, { clearProps: 'all' })
      },
    })
    if (reduced.current) {
      tl.to(el, { autoAlpha: 0, duration: 0.25, ease: 'power1.out' })
    } else {
      tl.to(el.querySelectorAll('[data-rise]'), {
        yPercent: -110,
        duration: 0.5,
        ease: 'power3.in',
        stagger: 0.04,
      }).to(
        el.querySelector('.curtain__panel'),
        { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.85, ease: 'expo.inOut' },
        0.12,
      )
    }
  }, [])

  const ready = useCallback(() => {
    if (phase.current === 'covered') reveal()
    else if (phase.current === 'in') pendingReady.current = true
  }, [reveal])

  const go = useCallback(
    (to: string) => {
      const el = root.current
      if (!el || phase.current !== 'idle' || to === window.location.pathname) return
      phase.current = 'in'
      pendingReady.current = false
      setCover(coverFor(to))
      const done = () => {
        phase.current = 'covered'
        coveredAt.current = performance.now()
        el.dataset.phase = 'covered'
        selfNavigated.current = true
        navigate(to)
        window.scrollTo(0, 0)
      }
      // Animate on the next frame so the new cover colours are committed first.
      requestAnimationFrame(() => {
        const panel = el.querySelector('.curtain__panel')
        const rise = el.querySelectorAll('[data-rise]')
        if (reduced.current) {
          gsap.set([panel, ...rise], { clearProps: 'all' })
          gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, onComplete: done })
          el.dataset.phase = 'in'
          return
        }
        gsap.set(el, { autoAlpha: 1 })
        el.dataset.phase = 'in'
        gsap
          .timeline({ onComplete: done })
          .fromTo(
            panel,
            { clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'expo.inOut' },
          )
          .fromTo(
            rise,
            { yPercent: 110 },
            { yPercent: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05 },
            0.3,
          )
      })
    },
    [navigate],
  )

  // Back/forward buttons and typed URLs skip `go`; drop the curtain instantly so the
  // incoming route still gets a clean reveal.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    if (selfNavigated.current) {
      selfNavigated.current = false
      return
    }
    gsap.killTweensOf([el, ...el.querySelectorAll('.curtain__panel, [data-rise]')])
    gsap.set(el.querySelectorAll('.curtain__panel, [data-rise]'), { clearProps: 'all' })
    gsap.set(el, { autoAlpha: 1 })
    setCover(coverFor(location.pathname))
    phase.current = 'covered'
    coveredAt.current = performance.now() - MIN_COVERED_MS / 2
    el.dataset.phase = 'covered'
  }, [location.pathname])

  const api = useMemo(() => ({ go, ready }), [go, ready])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        ref={root}
        className="curtain"
        data-phase="covered"
        aria-hidden="true"
        style={{ '--c-bg': cover.bg, '--c-fg': cover.fg } as React.CSSProperties}
      >
        <div className="curtain__panel">
          <div className="curtain__label">
            <span className="curtain__clip">
              <span className="curtain__index" data-rise>
                {cover.index}
              </span>
            </span>
            <span className="curtain__clip">
              <span className="curtain__title" data-rise>
                {cover.label}
              </span>
            </span>
          </div>
          <div className="curtain__bar" />
        </div>
      </div>
    </Ctx.Provider>
  )
}
