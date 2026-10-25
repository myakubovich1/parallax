import { parse, type MathNode } from 'mathjs';
import { FORMULAS } from './formulas';
const functions = new Set(['sin', 'cos', 'tan', 'asin', 'sqrt', 'exp', 'log']);
function normalize(text: string) {
  return text
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/½/g, '(1/2)')
    .replace(/π/gi, 'pi')
    .replace(/ω/gi, 'omega')
    .replace(/λ/gi, 'lambda')
    .replace(/θ/gi, 'theta')
    .replace(/ρ/gi, 'rho')
    .replace(/τ/gi, 'tau')
    .replace(/[Δ∆]/g, 'delta')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))')
    .replace(/\\(?:cdot|times)/g, '*')
    .replace(/[×·]/g, '*')
    .replace(/[−–]/g, '-')
    .replace(/±/g, '+')
    .replace(/\*\*/g, '^')
    .replace(/_/g, '')
    .replace(/\\/g, '')
    .replace(/[{}]/g, '')
    .trim();
}
function canonical(input: string): string | null {
  try {
    let text = normalize(input).replace(/\s+/g, '');
    if (text.length > 180 || /[=;\[\]"'<>]/.test(text)) return null;
    text = text.replace(/\b(\d+)\/(\d+)(?=[a-z(])/g, '($1/$2)*');
    const known = [
      'lambda',
      'omega',
      'theta',
      'alpha',
      'deltat',
      'deltal',
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
    const rendered = tokens.map((t) => {
      if (!/^[a-z]/.test(t)) return t;
      const out: string[] = [];
      let rest = t;
      while (rest) {
        const base = known.find((k) => rest.startsWith(k));
        const word = base
          ? rest.match(new RegExp('^' + base + '\\d*'))?.[0]
          : rest.match(/^[a-z]\d*/)?.[0];
        if (!word) throw Error();
        out.push(word);
        rest = rest.slice(word.length);
      }
      return out.join('*');
    });
    text = rendered
      .map((token, i) => {
        const previous = rendered[i - 1] ?? '';
        const fn = functions.has(previous.split('*').at(-1) ?? '');
        return /[a-z0-9)]$/.test(previous) && /^[a-z0-9(]/.test(token) && !(token === '(' && fn)
          ? '*' + token
          : token;
      })
      .join('');
    const tree = parse(text);
    let count = 0;
    function canon(n: MathNode, depth = 0): string {
      if (++count > 100 || depth > 25) throw Error();
      if (n.type === 'ParenthesisNode') return canon((n as any).content, depth + 1);
      if (n.type === 'ConstantNode') {
        const v = Number((n as any).value);
        if (!Number.isFinite(v)) throw Error();
        return String(v);
      }
      if (n.type === 'SymbolNode') return (n as any).name;
      if (n.type === 'FunctionNode') {
        const f = (n as any).fn.name;
        if (!functions.has(f) || (n as any).args.length !== 1) throw Error();
        return f + '(' + canon((n as any).args[0], depth + 1) + ')';
      }
      if (n.type !== 'OperatorNode') throw Error();
      const { op, args } = n as any;
      if (op === '^' && args[1].type !== 'ConstantNode')
        return '^(' + args.map((a: MathNode) => canon(a, depth + 1)).join(',') + ')';
      if (['*', '/', '^'].includes(op) || (op === '-' && args.length === 1)) {
        let coefficient = 1;
        const factors = new Map<string, number>();
        function collect(node: MathNode, power = 1) {
          if (node.type === 'ParenthesisNode') return collect((node as any).content, power);
          if (node.type === 'ConstantNode') {
            coefficient *= Number((node as any).value) ** power;
            return;
          }
          if (node.type === 'OperatorNode') {
            const o = node as any;
            if (o.op === '*') {
              for (const a of o.args) collect(a, power);
              return;
            }
            if (o.op === '/') {
              collect(o.args[0], power);
              collect(o.args[1], -power);
              return;
            }
            if (o.op === '-' && o.args.length === 1) {
              coefficient *= (-1) ** power;
              collect(o.args[0], power);
              return;
            }
            if (o.op === '^' && o.args[1].type === 'ConstantNode') {
              collect(o.args[0], power * Number(o.args[1].value));
              return;
            }
          }
          const key = canon(node, depth + 1);
          factors.set(key, (factors.get(key) || 0) + power);
        }
        collect(n);
        if (!Number.isFinite(coefficient)) throw Error();
        return JSON.stringify([
          Number(coefficient.toPrecision(12)),
          [...factors].filter(([, v]) => v !== 0).sort(([a], [b]) => a.localeCompare(b)),
        ]);
      }
      if (op === '+') {
        const terms: string[] = [];
        function sum(node: any) {
          if (node.type === 'OperatorNode' && node.op === '+') node.args.forEach(sum);
          else terms.push(canon(node, depth + 1));
        }
        args.forEach(sum);
        return '+' + terms.sort().join('|');
      }
      if (op === '-' && args.length === 2)
        return '-(' + args.map((a: MathNode) => canon(a, depth + 1)).join(',') + ')';
      throw Error();
    }
    return canon(tree);
  } catch {
    return null;
  }
}
const signatures = FORMULAS.map((f) => {
  const equations = [f.equation, ...f.aliases.filter((a) => a.includes('='))];
  if (f.id === 'kinetic') equations.push('E = 0.5*m*v^2', 'K = 0.5*m*v^2');
  return {
    f,
    pairs: equations
      .map((e) => ({ lhs: normalize(e.split('=')[0]), rhs: canonical(e.split('=')[1]) }))
      .filter((pair) => pair.rhs !== null),
  };
});
export function matchFormula(prompt: string) {
  const text = normalize(prompt)
    .replace(
      /^(?:please\s+)?(?:explain|show me|show|visualize|visualise|plot|what is|what's|demonstrate)\s+/,
      '',
    )
    .replace(/[.?!]+$/, '')
    .trim();
  if (!text.includes('=')) {
    const clean = text.replace(/[’']/g, '');
    const named = FORMULAS.find((f) =>
      [f.title, ...f.aliases.filter((a) => !a.includes('='))].some(
        (a) => clean === normalize(a).replace(/[’']/g, ''),
      ),
    );
    if (named) return named;
    if (!/\b(relativistic|angular|damped|nonlinear|quantum|friction|drag)\b/.test(clean)) {
      const namedMatches = FORMULAS.filter((f) =>
        [f.title, ...f.aliases.filter((a) => !a.includes('='))].some((a) => {
          const name = normalize(a).replace(/[’']/g, '');
          const i = clean.indexOf(name);
          return (
            i >= 0 &&
            !/[a-z]/.test(clean[i - 1] || '') &&
            !/[a-z]/.test(clean[i + name.length] || '')
          );
        }),
      );
      if (namedMatches.length === 1) return namedMatches[0];
    }
  }
  const parts = text.split('=');
  if (parts.length > 2) return null;
  const rhs = canonical(parts.at(-1)!);
  if (!rhs) return null;
  const lhs = parts.length === 2 ? normalize(parts[0]) : null;
  const matches = signatures.filter((s) =>
    s.pairs.some((pair) => (!lhs || pair.lhs === lhs) && pair.rhs === rhs),
  );
  return matches.length === 1 ? matches[0].f : null;
}

export type InputReview =
  | { kind: 'correction'; original: string; corrected: string; title: string; reason: string }
  | { kind: 'clarify'; message: string };

/** Suggest small, explainable repairs. Never replace an equation without confirmation. */
export function reviewFormula(prompt: string): InputReview | null {
  const original = prompt.trim();
  if (matchFormula(original)) return null;
  if (
    /^(?:sex|science|physics|maths?|chemistry|biology|stuff|anything|test|hello|hi)[.!?]*$/i.test(
      original,
    )
  ) {
    return {
      kind: 'clarify',
      message:
        'What would you like to understand about this topic? Ask a specific scientific question, or enter an equation.',
    };
  }
  // Prose, custom topics and unfamiliar valid formulas still go to the lesson provider.
  const text = normalize(original);
  if (text.length > 180 || (!text.includes('=') && !/[\d][*/^]|[*/^][\d(]|[²³]/.test(original)))
    return null;
  if (/[;\[\]"'<>]/.test(text)) return null;
  const repairs: string[] = [];
  if (/\/{2,}/.test(original)) repairs.push('There is an extra division sign.');
  if (/={2,}/.test(original)) repairs.push('An equation needs a single equals sign.');
  let repaired = original.replace(/\/{2,}/g, '/').replace(/={2,}/g, '=');
  const opens = (repaired.match(/\(/g) ?? []).length;
  const closes = (repaired.match(/\)/g) ?? []).length;
  if (opens === closes + 1 && !/\)\s*\(/.test(repaired)) {
    repaired += ')';
    repairs.push('A closing parenthesis appears to be missing.');
  }
  if (repaired !== original) {
    const parts = repaired.split('=');
    if (parts.length <= 2 && parts.every((p) => canonical(p))) {
      return {
        kind: 'correction',
        original,
        corrected: repaired,
        title: matchFormula(repaired)?.title ?? 'Equation',
        reason: repairs.join(' ') + ' Please confirm the suggested equation.',
      };
    }
  }
  const parts = text.split('=');
  if (parts.length > 2 || parts.some((p) => !p.trim() || !canonical(p))) {
    return {
      kind: 'clarify',
      message:
        'This equation looks incomplete. Check the operators, both sides of the equals sign, and any parentheses, then try again.',
    };
  }
  const rhs = canonical(parts.at(-1)!);
  const lhs = parts.length === 2 ? parts[0].replace(/\s/g, '') : null;
  function product(signature: string | null): [number, [string, number][]] | null {
    try {
      const value = JSON.parse(signature ?? 'null');
      return Array.isArray(value) && typeof value[0] === 'number' && Array.isArray(value[1])
        ? [value[0], value[1]]
        : null;
    } catch {
      return null;
    }
  }
  const entered = product(rhs);
  if (!entered) return null;
  const reviewSignatures = [
    ...signatures,
    {
      f: { title: 'Gravitational attraction', equation: 'F = G*m_1*m_2/r^2' },
      pairs: [{ lhs: 'f', rhs: canonical('G*m_1*m_2/r^2') }],
    },
  ];
  const candidates = reviewSignatures.filter(({ pairs }) =>
    pairs.some((pair) => {
      if (lhs && pair.lhs.replace(/\s/g, '') !== lhs) return false;
      const known = product(pair.rhs);
      if (!known || !entered[0] || !known[0]) return false;
      if (
        JSON.stringify(entered[1].map(([name]) => name)) !==
        JSON.stringify(known[1].map(([name]) => name))
      )
        return false;
      const powerDifference = entered[1].reduce(
        (sum, [, power], i) => sum + Math.abs(power - known[1][i][1]),
        0,
      );
      const ratio = Math.abs(entered[0] / known[0]);
      const coefficientDifference =
        entered[0] === known[0] ? 0 : [0.5, 2].includes(ratio) ? 1 : Infinity;
      return powerDifference + coefficientDifference === 1;
    }),
  );
  if (candidates.length !== 1) return null;
  const formula = candidates[0].f;
  return {
    kind: 'correction',
    original,
    corrected: formula.equation,
    title: formula.title,
    reason: `This is close to the standard ${formula.title.toLowerCase()} formula, but its coefficient or exponent differs. Is that what you intended?`,
  };
}
