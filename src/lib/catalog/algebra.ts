import { parse, type MathNode } from 'mathjs';

export const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'sqrt', 'exp', 'log']);
const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-',
  '⁺': '+',
};

/** Preserve grouping when normalizing notation copied from the displayed equations. */
export function normalizeMath(input: string): string {
  let text = input
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (s) => '^' + [...s].map((c) => SUPERSCRIPTS[c]).join(''))
    .replace(/½/g, '(1/2)')
    .replace(/π/gi, 'pi')
    .replace(/ω/gi, 'omega')
    .replace(/λ/gi, 'lambda')
    .replace(/θ/gi, 'theta')
    .replace(/ρ/gi, 'rho')
    .replace(/τ/gi, 'tau')
    .replace(/[Δ∆]/g, 'delta')
    .replace(/√/g, 'sqrt')
    .normalize('NFKC')
    .replace(/[φϕ]/gi, 'phi')
    .replace(/η/gi, 'eta')
    .replace(/α/gi, 'alpha')
    .toLowerCase()
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\(?:cdot|times)/g, '*')
    .replace(/[×·]/g, '*')
    .replace(/[−–]/g, '-')
    .replace(/±/g, '+')
    .replace(/\*\*/g, '^')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')');
  // Work from inner groups outward; do not flatten an exponent or a fraction.
  for (let i = 0; i < 8; i++) {
    const next = text
      .replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))')
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
      .replace(/\^\{([^{}]+)\}/g, '^($1)')
      .replace(/_\{([^{}]+)\}/g, '_$1')
      .replace(/\\(?:mathrm|operatorname)\{([^{}]+)\}/g, '$1');
    if (next === text) break;
    text = next;
  }
  return text.replace(/_/g, '').replace(/\\/g, '').replace(/[{}]/g, '').trim();
}

/** Parse bounded arithmetic only; this module never evaluates user code. */
export function parseArithmetic(input: string): MathNode {
  let text = normalizeMath(input).replace(/\s+/g, '');
  if (text.length > 180 || /[=;\[\]"'<>]/.test(text)) throw Error('Unsupported expression');
  text = text.replace(/\b(\d+)\/(\d+)(?=[a-z(])/g, '($1/$2)*');
  const known = [
    'lambda',
    'omega',
    'theta',
    'alpha',
    'deltat',
    'deltal',
    'phi',
    'eta',
    'rho',
    'tau',
    'pi',
    'exp',
    'sqrt',
    'asin',
    'sin',
    'cos',
    'tan',
    'log',
    'dt',
  ];
  const tokens = text.match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?|[a-z]+\d*|[^\s]/g) || [];
  const rendered = tokens.map((token) => {
    if (!/^[a-z]/.test(token)) return token;
    const out: string[] = [];
    let rest = token;
    while (rest) {
      const base = known.find((k) => rest.startsWith(k));
      const word = base
        ? rest.match(new RegExp('^' + base + '\\d*'))?.[0]
        : rest.match(/^[a-z]\d*/)?.[0];
      if (!word) throw Error('Unsupported symbol');
      out.push(word);
      rest = rest.slice(word.length);
    }
    return out.join('*');
  });
  text = rendered
    .map((token, i) => {
      const previous = rendered[i - 1] ?? '';
      const fn = FUNCTIONS.has(previous.split('*').at(-1) ?? '');
      return /[a-z0-9)]$/.test(previous) && /^[a-z0-9(]/.test(token) && !(token === '(' && fn)
        ? '*' + token
        : token;
    })
    .join('');
  return parse(text);
}

type Polynomial = Map<string, number>;
type Rational = { n: Polynomial; d: Polynomial };
const ONE = '[]';

/** Exact polynomial/rational rearrangements, up to a nonzero scalar; no sampled guesses. */
function algebraKey(lhs: string | null, rhs: string): string | null {
  try {
    let operations = 0,
      nodes = 0;
    const constant = (v: number): Polynomial => {
      if (!Number.isFinite(v)) throw Error('Nonfinite coefficient');
      return new Map(v === 0 ? [] : [[ONE, v]]);
    };
    const symbol = (name: string): Polynomial => new Map([[JSON.stringify([[name, 1]]), 1]]);
    const addTerm = (p: Polynomial, key: string, amount: number) => {
      if (++operations > 4096) throw Error('Expression too complex');
      const value = (p.get(key) ?? 0) + amount;
      if (!Number.isFinite(value)) throw Error('Nonfinite coefficient');
      if (value === 0) p.delete(key);
      else p.set(key, value);
      if (p.size > 64) throw Error('Too many terms');
    };
    const add = (a: Polynomial, b: Polynomial, sign = 1) => {
      const out = new Map(a);
      b.forEach((v, key) => addTerm(out, key, sign * v));
      return out;
    };
    const multiply = (a: Polynomial, b: Polynomial) => {
      const out: Polynomial = new Map();
      for (const [ka, va] of a)
        for (const [kb, vb] of b) {
          const factors = new Map<string, number>(JSON.parse(ka));
          for (const [name, power] of JSON.parse(kb))
            factors.set(name, (factors.get(name) ?? 0) + power);
          const key = JSON.stringify([...factors].sort(([x], [y]) => x.localeCompare(y)));
          addTerm(out, key, va * vb);
        }
      return out;
    };
    const sorted = (p: Polynomial, scale: number) =>
      [...p]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, Number((v / scale).toPrecision(12))]);
    const rationalKey = (r: Rational) => {
      const scale = [...r.d].sort(([a], [b]) => a.localeCompare(b))[0]?.[1];
      if (!scale) throw Error('Zero denominator');
      return JSON.stringify([sorted(r.n, scale), sorted(r.d, scale)]);
    };
    const literal = (node: any): number | null => {
      if (node.type === 'ParenthesisNode') return literal(node.content);
      if (node.type === 'ConstantNode') return Number(node.value);
      if (node.type === 'OperatorNode' && ['+', '-'].includes(node.op) && node.args.length === 1) {
        const v = literal(node.args[0]);
        return v === null ? null : node.op === '-' ? -v : v;
      }
      return null;
    };
    function walk(node: MathNode, depth = 0): Rational {
      if (++nodes > 100 || depth > 25) throw Error('Expression too complex');
      const n = node as any;
      if (n.type === 'ParenthesisNode') return walk(n.content, depth + 1);
      if (n.type === 'ConstantNode') return { n: constant(Number(n.value)), d: constant(1) };
      if (n.type === 'SymbolNode') return { n: symbol(n.name), d: constant(1) };
      if (n.type === 'FunctionNode') {
        if (!FUNCTIONS.has(n.fn.name) || n.args.length !== 1) throw Error('Unsupported function');
        return {
          n: symbol(n.fn.name + '(' + rationalKey(walk(n.args[0], depth + 1)) + ')'),
          d: constant(1),
        };
      }
      if (n.type !== 'OperatorNode') throw Error('Unsupported syntax');
      if (n.args.length === 1 && ['+', '-'].includes(n.op)) {
        const a = walk(n.args[0], depth + 1);
        return { n: multiply(constant(n.op === '-' ? -1 : 1), a.n), d: a.d };
      }
      if (n.args.length !== 2) throw Error('Unsupported operator');
      if (n.op === '^' && n.args[0].type === 'SymbolNode' && n.args[0].name === 'e') {
        return {
          n: symbol('exp(' + rationalKey(walk(n.args[1], depth + 1)) + ')'),
          d: constant(1),
        };
      }
      const a = walk(n.args[0], depth + 1);
      if (n.op === '^') {
        const exponent = literal(n.args[1]);
        if (exponent === null || !Number.isInteger(exponent) || Math.abs(exponent) > 8) {
          return {
            n: symbol(
              'pow(' + rationalKey(a) + ',' + rationalKey(walk(n.args[1], depth + 1)) + ')',
            ),
            d: constant(1),
          };
        }
        let result: Rational = { n: constant(1), d: constant(1) };
        for (let i = 0; i < Math.abs(exponent); i++)
          result = { n: multiply(result.n, a.n), d: multiply(result.d, a.d) };
        return exponent < 0 ? { n: result.d, d: result.n } : result;
      }
      const b = walk(n.args[1], depth + 1);
      if (n.op === '*') return { n: multiply(a.n, b.n), d: multiply(a.d, b.d) };
      if (n.op === '/') return { n: multiply(a.n, b.d), d: multiply(a.d, b.n) };
      if (n.op === '+' || n.op === '-')
        return {
          n: add(multiply(a.n, b.d), multiply(b.n, a.d), n.op === '+' ? 1 : -1),
          d: multiply(a.d, b.d),
        };
      throw Error('Unsupported operator');
    }
    const a: Rational =
      lhs === null ? { n: symbol('__result__'), d: constant(1) } : walk(parseArithmetic(lhs));
    const b = walk(parseArithmetic(rhs));
    if (!a.d.size || !b.d.size) return null;
    const residual = add(multiply(a.n, b.d), multiply(b.n, a.d), -1);
    const scale = [...residual].sort(([x], [y]) => x.localeCompare(y))[0]?.[1];
    return scale ? JSON.stringify(sorted(residual, scale)) : null;
  } catch {
    return null;
  }
}

export function equationKey(input: string): string | null {
  const parts = input.split('=');
  return parts.length === 2 ? algebraKey(parts[0], parts[1]) : null;
}
export const expressionKey = (input: string) => algebraKey(null, input);
