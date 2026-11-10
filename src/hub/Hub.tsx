import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { byId, experiences, pathOf, type Experience } from '../experiences/registry'
import type { ExperienceMeta } from '../experiences/types'
import { useCurtainReady, useTransition } from '../shell/transition'
import { useCoarsePointer, useIsMobile, usePrefersReducedMotion } from '../lib/hooks'
import { clamp } from '../lib/math'
import './hub.css'

const EMAIL = 'umayer.k2004@gmail.com'

const LINKS = [
  { label: 'LinkedIn', text: 'linkedin.com/in/umayer-khan', href: 'https://linkedin.com/in/umayer-khan' },
  { label: 'GitHub', text: 'github.com/UmayerK', href: 'https://github.com/UmayerK' },
  { label: 'Site', text: 'umayer.ca', href: 'https://umayer.ca' },
]

const WORK: { when: string; where: string; role: string; what: string; pieces: string[] }[] = [
  {
    when: '2026 — now',
    where: 'Center of Diagnostic Imaging Research',
    role: 'Machine Learning Research Assistant',
    what: 'Training deep learning models in PyTorch and OpenCV that classify weld quality on resistance spot riveted joints, from data collected and labelled off the riveting machines.',
    pieces: ['seam'],
  },
  {
    when: '2024 — 2026',
    where: 'Vista (Cimpress)',
    role: 'Software Engineer Intern, Co-op',
    what: 'Created Radius, a marketplace where plants bid on print orders in timed rounds, and the agent that bids in it. Built a template language and compiler with ANTLR that cut design tickets 60%.',
    pieces: ['radius', 'glyph'],
  },
  {
    when: '2025 — 2026',
    where: 'YAP Technologies',
    role: 'Founding Engineer',
    what: 'Shipped the iOS and Android app in React Native to 3.5k users across five languages, and built the real-time voice pipeline that replies in under 300ms.',
    pieces: ['resonance'],
  },
  {
    when: '2026',
    where: 'ZeroVault',
    role: 'Personal project',
    what: 'A zero-knowledge password manager. Web, extension and Rust desktop clients from one TypeScript core on a Go API, covered by 500+ tests.',
    pieces: ['zero'],
  },
  {
    when: '2026',
    where: 'University of Windsor',
    role: 'B.Sc. Honours, Computer Science (Co-op)',
    what: 'Graduated in October 2026 with an Honours degree in Computer Science.',
    pieces: [],
  },
  {
    when: 'UWindsor',
    where: 'University of Windsor Computer Science Society',
    role: 'Head of Student Affairs',
    what: 'Served as Head of Student Affairs for the UWindsor Computer Science Society, a community of 3,000+ students.',
    pieces: [],
  },
  {
    when: 'UWindsor',
    where: 'Odette Debate Team',
    role: 'Debater and Judge',
    what: 'Competed on the Odette Debate Team at the University of Windsor and also judged debates.',
    pieces: [],
  },
  {
    when: '2023 — 2024',
    where: 'Hackathons',
    role: 'Attendee',
    what: 'Attended the NASA Space Apps Challenge (2023) and WinHacks at the University of Windsor (2024).',
    pieces: [],
  },
]

const TOOLS = [
  ['Languages', 'TypeScript, Python, Go, Rust, Java, C++, SQL'],
  ['Frontend and mobile', 'React, Next.js, React Native (Expo), Tailwind'],
  ['Backend and data', 'Node.js, FastAPI, Flask, PostgreSQL, MongoDB, Redis'],
  ['Cloud and tooling', 'AWS (ECS, Fargate, CloudWatch), Docker, GitHub Actions, Playwright, Pytest'],
  ['Machine learning', 'PyTorch, OpenCV, scikit-learn, SciPy, OpenAI API'],
]

const no = (m: ExperienceMeta) => String(m.index).padStart(2, '0')
const tint = (m: ExperienceMeta) =>
  ({ '--bg': m.palette.bg, '--fg': m.palette.fg, '--ac': m.palette.accent }) as CSSProperties
const plain = (e: ReactMouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

function Arrow({ up = false }: { up?: boolean }) {
  return (
    <svg className="hb-arrow" data-up={up || undefined} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

/** Each word rises out of its own clip, staggered by `--i`. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return text.split(' ').map((word, i) => (
    <span key={i}>
      <span className="hb-w">
        <span style={{ '--i': from + i } as CSSProperties}>{word}</span>
      </span>{' '}
    </span>
  ))
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  const text = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now),
    [now],
  )
  return <time dateTime={now.toISOString()}>{text}</time>
}

interface ListProps {
  active: number
  pick: (i: number) => void
  enter: (x: Experience) => void
  reduced: boolean
}

/** Desktop: five spines side by side. The one under the pointer opens. */
function Strip({ active, pick, enter, reduced }: ListProps) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), { stiffness: 120, damping: 18 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 120, damping: 18 })
  // A touch on a closed spine opens it; only the next one enters.
  const armed = useRef(true)

  const move = (e: ReactPointerEvent<HTMLOListElement>) => {
    if (reduced || e.pointerType !== 'mouse') return
    const open = e.currentTarget.querySelector('[data-on]')
    if (!open) return
    const r = open.getBoundingClientRect()
    mx.set(clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5))
    my.set(clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5))
  }
  const rest = () => {
    mx.set(0)
    my.set(0)
  }

  return (
    <ol className="hb-strip" onPointerMove={move} onPointerLeave={rest}>
      {experiences.map((x, i) => {
        const m = x.meta
        const on = i === active
        return (
          <li key={m.id} className="hb-spine" data-on={on || undefined} style={tint(m)}>
            <a
              href={pathOf(m)}
              aria-label={`${no(m)}. ${m.title}. ${m.tagline}`}
              onPointerEnter={(e) => e.pointerType === 'mouse' && pick(i)}
              onPointerDown={(e) => {
                armed.current = e.pointerType === 'mouse' || on
              }}
              onFocus={() => pick(i)}
              onClick={(e) => {
                if (!plain(e)) return
                e.preventDefault()
                const ok = armed.current
                armed.current = true
                if (ok) enter(x)
                else pick(i)
              }}
            >
              <span className="hb-spine__shut" aria-hidden="true">
                <span className="hb-no">{no(m)}</span>
                <span className="hb-spine__name">{m.title}</span>
                <i />
              </span>
              <span className="hb-spine__open" aria-hidden="true">
                <span className="hb-spine__meta">
                  <span>{no(m)} / 05</span>
                  <span>{m.kind}</span>
                </span>
                <motion.span className="hb-frame" style={{ rotateX, rotateY, transformPerspective: 1100 }}>
                  <img src={`/posters/${m.id}-d.webp`} alt="" width={1440} height={900} decoding="async" />
                </motion.span>
                <span className="hb-spine__body">
                  <span className="hb-spine__title">{m.title}</span>
                  <span className="hb-spine__tag">{m.tagline}</span>
                  <span className="hb-spine__from">
                    From {m.origin.where} · {m.origin.role}
                  </span>
                  <span className="hb-spine__foot">
                    <span>{m.stack.join(' · ')}</span>
                    <span className="hb-enter">
                      Enter <Arrow />
                    </span>
                  </span>
                </span>
              </span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}

/** Phone: a deck you swipe through. The centred card is live; a tap opens it. */
function Deck({ active, pick, enter, reduced }: ListProps) {
  const deck = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const el = deck.current
    if (!el) return
    let raf = 0
    const read = () => {
      raf = 0
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let gap = Infinity
      Array.from(el.children).forEach((c, i) => {
        const card = c as HTMLElement
        const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid)
        if (d < gap) {
          gap = d
          best = i
        }
      })
      pick(best)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [pick])

  const to = (i: number) => {
    const el = deck.current
    const card = el?.children[i] as HTMLElement | undefined
    if (!el || !card) return
    el.scrollTo({
      left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }

  const current = experiences[active].meta
  return (
    <>
      <ol className="hb-deck" ref={deck}>
        {experiences.map((x, i) => {
          const m = x.meta
          const on = i === active
          return (
            <li key={m.id} className="hb-card" data-on={on || undefined} style={tint(m)}>
              <a
                href={pathOf(m)}
                aria-label={`${no(m)}. ${m.title}. ${m.tagline}`}
                onClick={(e) => {
                  if (!plain(e)) return
                  e.preventDefault()
                  if (on) enter(x)
                  else to(i)
                }}
              >
                <span className="hb-card__shot">
                  <img
                    src={`/posters/${m.id}-m.webp`}
                    alt=""
                    width={640}
                    height={1293}
                    decoding="async"
                    loading={i < 2 ? 'eager' : 'lazy'}
                  />
                </span>
                <span className="hb-card__body" aria-hidden="true">
                  <span className="hb-card__meta">
                    <span>{no(m)} / 05</span>
                    <span>{m.kind}</span>
                  </span>
                  <span className="hb-card__title">{m.title}</span>
                  <span className="hb-card__tag">{m.tagline}</span>
                  <span className="hb-enter">
                    Open <Arrow />
                  </span>
                </span>
              </a>
            </li>
          )
        })}
      </ol>
      <div className="hb-ticks" style={tint(current)}>
        {experiences.map((x, i) => (
          <button
            key={x.meta.id}
            type="button"
            aria-label={`Show ${no(x.meta)} ${x.meta.title}`}
            aria-current={i === active || undefined}
            onClick={() => to(i)}
          >
            <i />
          </button>
        ))}
      </div>
    </>
  )
}

export default function Hub() {
  const { go } = useTransition()
  const mobile = useIsMobile()
  const coarse = useCoarsePointer()
  const reduced = usePrefersReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const lenis = useRef<Lenis | null>(null)
  const [fonts, setFonts] = useState(false)
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    const done = () => alive && setFonts(true)
    const t = setTimeout(done, 2000)
    Promise.all([
      document.fonts.load('400 1em "Instrument Serif"'),
      document.fonts.load('italic 400 1em "Instrument Serif"'),
    ]).then(done, done)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [])
  useCurtainReady(fonts)

  // Eased wheel scrolling where there is a wheel. Touch keeps the platform's own momentum.
  useEffect(() => {
    if (coarse || reduced) return
    const l = new Lenis({ autoRaf: true, lerp: 0.11 })
    lenis.current = l
    return () => {
      l.destroy()
      lenis.current = null
    }
  }, [coarse, reduced])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          ;(e.target as HTMLElement).dataset.in = ''
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    el.querySelectorAll('[data-reveal]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  const enter = useCallback(
    (x: Experience) => {
      void x.preload()
      go(pathOf(x.meta))
    },
    [go],
  )

  const jump = (id: string) => (e: ReactMouseEvent) => {
    if (!plain(e)) return
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    if (lenis.current) lenis.current.scrollTo(el)
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
  }

  // Warm the chunk of whichever piece is in front, so entering it is immediate.
  useEffect(() => {
    const t = setTimeout(() => void experiences[active].preload().catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [active])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return
      const x = /^[1-5]$/.test(e.key) ? experiences[Number(e.key) - 1] : undefined
      if (x) enter(x)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enter])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.location.href = `mailto:${EMAIL}`
    }
  }

  const list = { active, pick: setActive, enter, reduced }

  return (
    <div className="hb" ref={root} data-in={fonts || undefined}>
      <header className="hb-bar">
        <a href="#top" onClick={jump('top')}>
          Umayer Khan
        </a>
        <nav aria-label="Sections">
          <a href="#work" onClick={jump('work')}>
            Work
          </a>
          <a href="#about" onClick={jump('about')}>
            About
          </a>
          <a href="#contact" onClick={jump('contact')}>
            Contact
          </a>
        </nav>
      </header>

      <main>
        <section className="hb-hero" id="top">
          <p className="hb-eyebrow">
            <span>Software engineer</span>
            <span>
              Windsor, Ontario <Clock />
            </span>
          </p>
          <h1 className="hb-h1">
            <Words text="Five things I’ve built, remade small enough to" />
            <em>
              <Words text="play with." from={8} />
            </em>
          </h1>
          <div className="hb-hero__foot">
            <p className="hb-lede">
              A voice pipeline, an encrypted vault, a bidding market, a weld classifier and a compiler. Each one is
              rebuilt here as a miniature that really runs in your browser: the sound is synthesised, the encryption
              is real, the network trains. Where something is simulated, it says so.
            </p>
            {!mobile && (
              <ol className="hb-toc">
                {experiences.map((x, i) => (
                  <li key={x.meta.id} style={tint(x.meta)}>
                    <a
                      href={pathOf(x.meta)}
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={(e) => {
                        if (!plain(e)) return
                        e.preventDefault()
                        enter(x)
                      }}
                    >
                      <i />
                      <span className="hb-no">{no(x.meta)}</span>
                      <b>{x.meta.title}</b>
                      <span>{x.meta.kind}</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="hb-work" id="work" aria-label="The five pieces">
          <div className="hb-work__head">
            <h2>Index, 01 to 05</h2>
            <p>{mobile ? 'Swipe, then tap to open' : 'Click to enter, or press 1 to 5'}</p>
          </div>
          {mobile ? <Deck {...list} /> : <Strip {...list} />}
        </section>

        <section className="hb-about" id="about">
          <p className="hb-kicker" data-reveal>
            About
          </p>
          <h2 className="hb-h2" data-reveal>
            The work <em>behind</em> the simulations.
          </h2>
          <div className="hb-about__grid">
            <div className="hb-bio" data-reveal>
              <p>
                I’m a software engineer in Windsor, Ontario. I work across the stack, from React Native apps and
                FastAPI services to CI pipelines and PyTorch models.
              </p>
              <p>Every piece on this page is drawn from one of the jobs or projects listed here.</p>
            </div>
            <ol className="hb-jobs">
              {WORK.map((w) => (
                <li key={w.where} data-reveal>
                  <span className="hb-jobs__when">{w.when}</span>
                  <div>
                    <h3>{w.where}</h3>
                    <p className="hb-jobs__role">{w.role}</p>
                    <p>{w.what}</p>
                    {w.pieces.length > 0 && (
                      <p className="hb-chips">
                        {w.pieces.map((id) => {
                          const x = byId(id)!
                          return (
                            <a
                              key={id}
                              href={pathOf(x.meta)}
                              style={tint(x.meta)}
                              onPointerEnter={() => void x.preload().catch(() => {})}
                              onClick={(e) => {
                                if (!plain(e)) return
                                e.preventDefault()
                                enter(x)
                              }}
                            >
                              <i />
                              {no(x.meta)} {x.meta.title}
                              <Arrow />
                            </a>
                          )
                        })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <dl className="hb-tools" data-reveal>
            {TOOLS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="hb-contact" id="contact">
          <p className="hb-kicker" data-reveal>
            Contact
          </p>
          <h2 className="hb-h2" data-reveal>
            Have something worth building? <em>Write to me.</em>
          </h2>
          <div className="hb-mail" data-reveal>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            <button type="button" onClick={copy} data-done={copied || undefined}>
              <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <ul className="hb-links" data-reveal>
            {LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  <span>{l.label}</span>
                  <b>{l.text}</b>
                  <Arrow up />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="hb-foot">
        <span>© 2026 Umayer Khan</span>
        <span>React · TypeScript · Three.js · GSAP · Motion</span>
        <a href="#top" onClick={jump('top')}>
          Back to top
        </a>
      </footer>
    </div>
  )
}
