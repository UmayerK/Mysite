/** Glyph, stage 1: source text → tokens. Hand-written, one pass, no regex tables. */

export type TokType = 'num' | 'str' | 'ident' | 'kw' | 'cmd' | 'fn' | 'key' | 'color' | 'op' | 'punct' | 'nl' | 'comment' | 'eof'

export interface Token {
  type: TokType
  text: string
  start: number
  end: number
  line: number
  col: number
}

export class GlyphError extends Error {
  constructor(
    message: string,
    public start: number,
    public end: number,
    public stage: 'lex' | 'parse' | 'run',
  ) {
    super(message)
  }
}

const KEYWORDS = new Set(['let', 'repeat', 'as', 'if', 'else'])
const digit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'
const alpha = (c: string | undefined) => c !== undefined && ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_')
const hexDigit = (c: string | undefined) => digit(c) || (c !== undefined && /[a-fA-F]/.test(c))
const TWO = new Set(['<=', '>=', '==', '!='])
const ONE_OP = '+-*/%<>='
const PUNCT = '(){},:'

/** Never throws: on a bad character it stops, reports the error and still returns what it has. */
export function lex(src: string): { tokens: Token[]; error: GlyphError | null } {
  const tokens: Token[] = []
  let error: GlyphError | null = null
  let i = 0
  let line = 1
  let lineStart = 0
  const push = (type: TokType, start: number, end: number) =>
    tokens.push({ type, text: src.slice(start, end), start, end, line, col: start - lineStart + 1 })

  while (i < src.length) {
    const c = src[i]
    if (c === '\n') {
      push('nl', i, i + 1)
      i++
      line++
      lineStart = i
    } else if (c === ' ' || c === '\t' || c === '\r') {
      i++
    } else if (c === '/' && src[i + 1] === '/') {
      let j = i
      while (j < src.length && src[j] !== '\n') j++
      push('comment', i, j)
      i = j
    } else if (digit(c) || (c === '.' && digit(src[i + 1]))) {
      let j = i
      while (digit(src[j])) j++
      if (src[j] === '.' && digit(src[j + 1])) {
        j++
        while (digit(src[j])) j++
      }
      push('num', i, j)
      i = j
    } else if (c === '"') {
      let j = i + 1
      while (j < src.length && src[j] !== '"' && src[j] !== '\n') j++
      if (src[j] !== '"') {
        error = new GlyphError('This string never closes. Add a closing quote.', i, j, 'lex')
        break
      }
      push('str', i, j + 1)
      i = j + 1
    } else if (c === '#') {
      let j = i + 1
      while (hexDigit(src[j])) j++
      if (j - i !== 4 && j - i !== 7) {
        error = new GlyphError('A colour needs 3 or 6 hex digits, like #f0a or #ff4f9a.', i, Math.max(j, i + 1), 'lex')
        break
      }
      push('color', i, j)
      i = j
    } else if (alpha(c)) {
      let j = i
      while (alpha(src[j]) || digit(src[j])) j++
      push(KEYWORDS.has(src.slice(i, j)) ? 'kw' : 'ident', i, j)
      i = j
    } else if (TWO.has(src.slice(i, i + 2))) {
      push('op', i, i + 2)
      i += 2
    } else if (ONE_OP.includes(c)) {
      push('op', i, i + 1)
      i++
    } else if (PUNCT.includes(c)) {
      push('punct', i, i + 1)
      i++
    } else {
      error = new GlyphError(`Glyph has no use for the character ${JSON.stringify(c)}.`, i, i + 1, 'lex')
      break
    }
  }
  push('eof', src.length, src.length)
  return { tokens, error }
}
