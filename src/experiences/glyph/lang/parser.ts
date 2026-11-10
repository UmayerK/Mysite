/** Glyph, stage 2: tokens → syntax tree. Recursive descent, with precedence climbing for expressions. */
import { GlyphError, type Token } from './lexer'

export interface Span {
  start: number
  end: number
}
export type Expr =
  | ({ type: 'Num'; value: number } & Span)
  | ({ type: 'Str'; value: string } & Span)
  | ({ type: 'Color'; value: string } & Span)
  | ({ type: 'Ident'; name: string } & Span)
  | ({ type: 'Unary'; op: string; arg: Expr } & Span)
  | ({ type: 'Binary'; op: string; left: Expr; right: Expr } & Span)
  | ({ type: 'Call'; name: string; args: Expr[] } & Span)
export interface Arg extends Span {
  key: string | null
  value: Expr
}
export type Stmt =
  | ({ type: 'Let'; name: string; value: Expr } & Span)
  | ({ type: 'Assign'; name: string; value: Expr } & Span)
  | ({ type: 'Repeat'; count: Expr; as: string | null; body: Stmt[] } & Span)
  | ({ type: 'If'; test: Expr; then: Stmt[]; else: Stmt[] | null } & Span)
  | ({ type: 'Command'; name: string; nameSpan: Span; args: Arg[]; body: Stmt[] | null } & Span)
export interface Program extends Span {
  type: 'Program'
  body: Stmt[]
}
export type Node = Program | Stmt | Expr

const PRECEDENCE: Record<string, number> = { '==': 1, '!=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '+': 2, '-': 2, '*': 3, '/': 3, '%': 3 }

/** Retags identifier tokens as it goes (command, function, option key) so the editor can colour by meaning. */
export function parse(all: Token[]): Program {
  const toks = all.filter((t) => t.type !== 'comment')
  let p = 0
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)]
  const is = (text: string, o = 0) => peek(o).text === text && (peek(o).type === 'punct' || peek(o).type === 'op' || peek(o).type === 'kw')
  const next = () => toks[p++]
  const skipNl = () => {
    while (peek().type === 'nl') p++
  }
  const what = (t: Token) => (t.type === 'eof' ? 'the end of the program' : t.type === 'nl' ? 'the end of the line' : `“${t.text}”`)
  const fail = (msg: string, t = peek()): never => {
    throw new GlyphError(msg, t.start, Math.max(t.end, t.start + 1), 'parse')
  }
  const expect = (text: string, why: string) => {
    if (!is(text)) fail(`Expected ${text} ${why}, but found ${what(peek())}.`)
    return next()
  }

  function block(owner: string): Stmt[] {
    expect('{', `to open the ${owner} block`)
    const body: Stmt[] = []
    skipNl()
    while (!is('}')) {
      if (peek().type === 'eof') fail(`The ${owner} block is never closed. Add a } on its own line.`)
      body.push(statement())
      endOfStatement()
    }
    next()
    return body
  }

  function endOfStatement() {
    if (peek().type === 'nl') skipNl()
    else if (peek().type !== 'eof' && !is('}')) fail(`Expected a new line here, but found ${what(peek())}. Separate values with commas.`)
  }

  function statement(): Stmt {
    const t = peek()
    if (t.type === 'kw' && t.text === 'let') {
      next()
      const name = peek()
      if (name.type !== 'ident') fail(`let needs a name, as in let size = 12. Found ${what(name)}.`)
      next()
      expect('=', `after let ${name.text}`)
      const value = expression()
      return { type: 'Let', name: name.text, value, start: t.start, end: value.end }
    }
    if (t.type === 'kw' && t.text === 'repeat') {
      next()
      const count = expression()
      let as: string | null = null
      if (peek().type === 'kw' && peek().text === 'as') {
        next()
        if (peek().type !== 'ident') fail(`as needs a name for the counter, as in repeat 8 as i. Found ${what(peek())}.`)
        as = next().text
      }
      const body = block('repeat')
      return { type: 'Repeat', count, as, body, start: t.start, end: toks[p - 1].end }
    }
    if (t.type === 'kw' && t.text === 'if') {
      next()
      const test = expression()
      const then = block('if')
      let otherwise: Stmt[] | null = null
      if (peek().type === 'kw' && peek().text === 'else') {
        next()
        otherwise = peek().type === 'kw' && peek().text === 'if' ? [statement()] : block('else')
      }
      return { type: 'If', test, then, else: otherwise, start: t.start, end: toks[p - 1].end }
    }
    if (t.type === 'ident') {
      if (peek(1).type === 'op' && peek(1).text === '=') {
        next()
        next()
        const value = expression()
        return { type: 'Assign', name: t.text, value, start: t.start, end: value.end }
      }
      return command()
    }
    return fail(`A line starts with a command such as circle, text or repeat. Found ${what(t)}.`)
  }

  function command(): Stmt {
    const name = next()
    name.type = 'cmd'
    const args: Arg[] = []
    const atEnd = () => peek().type === 'nl' || peek().type === 'eof' || is('{') || is('}')
    if (!atEnd()) {
      for (;;) {
        const first = peek()
        let key: string | null = null
        if (first.type === 'ident' && is(':', 1)) {
          first.type = 'key'
          key = first.text
          next()
          next()
        }
        const value = expression()
        args.push({ key, value, start: first.start, end: value.end })
        if (!is(',')) break
        next()
        skipNl()
      }
    }
    const body = is('{') ? block(name.text) : null
    return { type: 'Command', name: name.text, nameSpan: { start: name.start, end: name.end }, args, body, start: name.start, end: toks[p - 1].end }
  }

  function expression(min = 1): Expr {
    let left = unary()
    for (;;) {
      const op = peek()
      const prec = op.type === 'op' ? PRECEDENCE[op.text] : undefined
      if (prec === undefined || prec < min) return left
      next()
      const right = expression(prec + 1)
      left = { type: 'Binary', op: op.text, left, right, start: left.start, end: right.end }
    }
  }

  function unary(): Expr {
    const t = peek()
    if (t.type === 'op' && t.text === '-') {
      next()
      const arg = unary()
      return { type: 'Unary', op: '-', arg, start: t.start, end: arg.end }
    }
    return primary()
  }

  function primary(): Expr {
    const t = next()
    if (t.type === 'num') return { type: 'Num', value: Number(t.text), start: t.start, end: t.end }
    if (t.type === 'str') return { type: 'Str', value: t.text.slice(1, -1), start: t.start, end: t.end }
    if (t.type === 'color') return { type: 'Color', value: t.text, start: t.start, end: t.end }
    if (t.type === 'ident') {
      if (!is('(')) return { type: 'Ident', name: t.text, start: t.start, end: t.end }
      t.type = 'fn'
      next()
      skipNl()
      const args: Expr[] = []
      while (!is(')')) {
        args.push(expression())
        skipNl()
        if (is(',')) {
          next()
          skipNl()
        } else if (!is(')')) fail(`Expected , or ) in the call to ${t.text}, but found ${what(peek())}.`)
      }
      const close = next()
      return { type: 'Call', name: t.text, args, start: t.start, end: close.end }
    }
    if (t.type === 'punct' && t.text === '(') {
      skipNl()
      const inner = expression()
      skipNl()
      expect(')', 'to close the parenthesis')
      return inner
    }
    p--
    return fail(`Expected a value here, but found ${what(t)}.`, t)
  }

  const body: Stmt[] = []
  skipNl()
  while (peek().type !== 'eof') {
    if (is('}')) fail('This } closes nothing.')
    body.push(statement())
    endOfStatement()
  }
  return { type: 'Program', body, start: 0, end: peek().end }
}

export interface TreeRow {
  depth: number
  kind: string
  label: string
  span: Span
  expr: boolean
}

/** Flattens the tree for display: one row per node, depth first. */
export function flatten(program: Program, limit = 500): TreeRow[] {
  const rows: TreeRow[] = []
  const add = (depth: number, kind: string, label: string, span: Span, expr = false) => {
    if (rows.length < limit) rows.push({ depth, kind, label, span, expr })
  }
  const ex = (e: Expr, d: number) => {
    if (e.type === 'Num') add(d, 'Num', String(e.value), e, true)
    else if (e.type === 'Str') add(d, 'Str', JSON.stringify(e.value), e, true)
    else if (e.type === 'Color') add(d, 'Color', e.value, e, true)
    else if (e.type === 'Ident') add(d, 'Ident', e.name, e, true)
    else if (e.type === 'Unary') {
      add(d, 'Unary', e.op, e, true)
      ex(e.arg, d + 1)
    } else if (e.type === 'Binary') {
      add(d, 'Binary', e.op, e, true)
      ex(e.left, d + 1)
      ex(e.right, d + 1)
    } else {
      add(d, 'Call', e.name, e, true)
      e.args.forEach((a) => ex(a, d + 1))
    }
  }
  const st = (s: Stmt, d: number) => {
    if (s.type === 'Let' || s.type === 'Assign') {
      add(d, s.type, s.name, s)
      ex(s.value, d + 1)
    } else if (s.type === 'Repeat') {
      add(d, 'Repeat', s.as ? `as ${s.as}` : '', s)
      ex(s.count, d + 1)
      s.body.forEach((b) => st(b, d + 1))
    } else if (s.type === 'If') {
      add(d, 'If', '', s)
      ex(s.test, d + 1)
      s.then.forEach((b) => st(b, d + 1))
      if (s.else) {
        add(d, 'Else', '', s.else.length ? { start: s.else[0].start, end: s.else[s.else.length - 1].end } : s)
        s.else.forEach((b) => st(b, d + 1))
      }
    } else {
      add(d, 'Command', s.name, s)
      for (const a of s.args) {
        if (a.key) {
          add(d + 1, 'Option', a.key, a, true)
          ex(a.value, d + 2)
        } else ex(a.value, d + 1)
      }
      s.body?.forEach((b) => st(b, d + 1))
    }
  }
  add(0, 'Program', `${program.body.length} statements`, program)
  program.body.forEach((s) => st(s, 1))
  return rows
}
