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
