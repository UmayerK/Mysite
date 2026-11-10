import { useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import type { Token } from './lang/lexer'
import type { Span } from './lang/parser'
import { INKS, PAPERS } from './lang/run'

export interface EditorHandle {
  /** Scrolls a stretch of source into view and, when typing is on, selects it. */
  reveal(span: Span, select?: boolean): void
}

interface Props {
  handle: RefObject<EditorHandle | null>
  value: string
  tokens: Token[]
  error: Span | null
  mark: Span | null
  /** Off on phones by default: the code becomes a surface for dragging numbers, with no keyboard. */
  editable: boolean
  coarse: boolean
  onChange(next: string): void
  onCaret(pos: number | null): void
  onFocusChange(focused: boolean): void
}

interface Drag {
  a: number
  len: number
  x0: number
  v0: number
  dec: number
  moved: boolean
  left: number
  width: number
}

const NEAR = [
  [0, 0],
  [0, -9],
  [0, 9],
  [-10, 0],
  [10, 0],
]
/** The number under the pointer, read through the textarea from the highlighted layer below it. */
function numberAt(x: number, y: number, fuzzy: boolean) {
  for (const [dx, dy] of fuzzy ? NEAR : NEAR.slice(0, 1)) {
    for (const el of document.elementsFromPoint(x + dx, y + dy)) {
      if (el instanceof HTMLElement && el.classList.contains('gl-t-num')) return el
    }
  }
  return null
}

export function Editor({ handle, value, tokens, error, mark, editable, coarse, onChange, onCaret, onFocusChange }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const drag = useRef<Drag | null>(null)
  const latest = useRef(value)
  latest.current = value
  const [scrub, setScrub] = useState<Span | null>(null)

  useImperativeHandle(handle, () => ({
    reveal(span, select = true) {
      const el = scroller.current
      if (!el) return
      const line = latest.current.slice(0, span.start).split('\n').length - 1
      const lh = parseFloat(getComputedStyle(el).getPropertyValue('--gl-lh')) || 22
      const top = line * lh
      if (top < el.scrollTop + lh || top > el.scrollTop + el.clientHeight - lh * 3) {
        el.scrollTo({ top: Math.max(0, top - el.clientHeight / 2 + lh), behavior: 'smooth' })
      }
      if (select && area.current && !coarse) {
        area.current.focus({ preventScroll: true })
        area.current.setSelectionRange(span.start, span.end)
      }
    },
  }))

  const code = useMemo(() => {
    const out: ReactNode[] = []
    let at = 0
    for (const tk of tokens) {
      if (tk.type === 'eof' || tk.type === 'nl') continue
      if (tk.start > at) out.push(value.slice(at, tk.start))
      const swatch = tk.type === 'color' ? tk.text : tk.type === 'ident' ? (INKS[tk.text] ?? PAPERS[tk.text]) : undefined
      out.push(
        <span
          key={tk.start}
          className={`gl-t gl-t-${tk.type}${swatch ? ' gl-t-ink' : ''}`}
          data-a={tk.start}
          style={swatch ? ({ '--sw': swatch } as CSSProperties) : undefined}
        >
          {tk.text}
        </span>,
      )
      at = tk.end
    }
    out.push(value.slice(at) + '\n')
    return out
  }, [value, tokens])

  const marks = useMemo(() => {
    const list = [
      scrub && { ...scrub, c: 'scrub' },
      error && { start: error.start, end: error.end, c: 'err' },
      mark && { ...mark, c: 'hov' },
    ]
      .filter((r): r is Span & { c: string } => !!r)
      .sort((p, q) => p.start - q.start)
    const out: ReactNode[] = []
    let at = 0
    for (const r of list) {
      if (r.start < at) continue
      out.push(value.slice(at, r.start))
      const text = value.slice(r.start, r.end)
      // An error at a line end has nothing visible to underline, so it gets a stand-in space.
      if (!text.trim()) out.push(<mark key={r.c} className={`gl-m gl-m-${r.c}`}>{' '}</mark>, text)
      else out.push(<mark key={r.c} className={`gl-m gl-m-${r.c}`}>{text}</mark>)
      at = Math.max(r.end, r.start)
    }
    out.push(value.slice(at) + '\n')
    return out
  }, [value, scrub, error, mark])

  const lines = useMemo(() => value.split('\n').length, [value])
  const errorLine = error ? value.slice(0, error.start).split('\n').length : 0

  const insert = (text: string) => {
    const ta = area.current
    if (!ta) return
    // execCommand keeps the browser's own undo stack intact; setRangeText is the fallback.
    if (!document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end')
      onChange(ta.value)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const { selectionStart: a, selectionEnd: b } = ta
    const lineStart = value.lastIndexOf('\n', a - 1) + 1
    const before = value.slice(lineStart, a)
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      insert('  ')
    } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      const indent = /^ */.exec(before)![0]
      insert('\n' + indent + (before.trimEnd().endsWith('{') ? '  ' : ''))
    } else if (e.key === '}' && a === b && before.length >= 2 && !before.trim()) {
      e.preventDefault()
      ta.setSelectionRange(a - 2, a)
      insert('}')
    } else if (e.key === 'Escape') {
      ta.blur()
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const el = numberAt(e.clientX, e.clientY, coarse)
    if (!el) return
    const text = el.textContent ?? ''
    const dot = text.indexOf('.')
    const rect = el.getBoundingClientRect()
    drag.current = {
      a: Number(el.dataset.a),
      len: text.length,
      x0: e.clientX,
      v0: Number(text),
      dec: dot < 0 ? 0 : text.length - dot - 1,
      moved: false,
      left: rect.left,
      width: rect.width,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) {
      if (!coarse && area.current) area.current.style.cursor = numberAt(e.clientX, e.clientY, false) ? 'ew-resize' : ''
      return
    }
    const dx = e.clientX - d.x0
    if (!d.moved && Math.abs(dx) < 4) return
    d.moved = true
    const src = latest.current
    let v = d.v0 + Math.round(dx / (coarse ? 6 : 5)) * Math.pow(10, -d.dec) * (e.shiftKey ? 10 : 1)
    if (v < 0 && src.slice(0, d.a).trimEnd().endsWith('-')) v = 0
    let text = v.toFixed(d.dec)
    if (Number(text) === 0) text = (0).toFixed(d.dec)
    if (src.slice(d.a, d.a + d.len) !== text) {
      const next = src.slice(0, d.a) + text + src.slice(d.a + d.len)
      latest.current = next
      d.len = text.length
      onChange(next)
    }
    setScrub({ start: d.a, end: d.a + d.len })
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setScrub(null)
    if (d.moved) return
    const pos = d.a + Math.min(d.len, Math.max(0, Math.round((e.clientX - d.left) / (d.width / d.len))))
    if (editable && area.current) {
      area.current.focus({ preventScroll: true })
      area.current.setSelectionRange(pos, pos)
    }
    onCaret(pos)
  }

  return (
    <div className="gl-code" ref={scroller} data-editable={editable} data-scrub={scrub ? 'true' : undefined}>
      <div className="gl-code__gutter" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} data-err={i + 1 === errorLine ? 'true' : undefined}>
            {i + 1}
          </span>
        ))}
      </div>
      <div
        className="gl-code__body"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (editable) return
          const tok = (e.target as HTMLElement).closest<HTMLElement>('.gl-t')
          if (!tok?.classList.contains('gl-t-num')) onCaret(tok ? Number(tok.dataset.a) : null)
        }}
      >
        <pre className="gl-code__marks" aria-hidden="true">
          {marks}
        </pre>
        <pre className="gl-code__hl" aria-hidden={editable}>
          {code}
        </pre>
        {editable && (
          <textarea
            ref={area}
            className="gl-code__ta"
            value={value}
            aria-label="Glyph source code"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            onChange={(e) => onChange(e.target.value)}
            onSelect={(e) => onCaret(e.currentTarget.selectionStart)}
            onKeyDown={onKeyDown}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            onMouseDown={(e) => {
              // Pressing on a number starts a scrub instead of a selection; a plain click still lands the caret.
              if (e.button === 0 && numberAt(e.clientX, e.clientY, false)) e.preventDefault()
            }}
          />
        )}
      </div>
    </div>
  )
}
