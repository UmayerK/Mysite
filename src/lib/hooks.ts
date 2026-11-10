import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const query = (q: string) => (typeof window !== 'undefined' ? window.matchMedia(q) : null)

export function useMediaQuery(q: string) {
  const [matches, setMatches] = useState(() => query(q)?.matches ?? false)
  useEffect(() => {
    const mq = query(q)
    if (!mq) return
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return matches
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
/** Primary input is touch (phones, most tablets). */
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)')
/** Narrow layout breakpoint shared by the hub and the shell. */
export const useIsMobile = () => useMediaQuery('(max-width: 760px)')

/** requestAnimationFrame loop. `cb(dt, t)` in seconds; pauses when the tab is hidden. */
export function useRaf(cb: (dt: number, t: number) => void, active = true) {
  const ref = useRef(cb)
  useLayoutEffect(() => {
    ref.current = cb
  })
  useEffect(() => {
    if (!active) return
    let id = 0
    let last = performance.now()
    const start = last
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      ref.current(dt, (now - start) / 1000)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active])
}

export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}
