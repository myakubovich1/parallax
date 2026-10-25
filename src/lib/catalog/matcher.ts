import type { MathNode } from 'mathjs';
import { FORMULAS } from './formulas';
import {
  FUNCTIONS as functions,
  normalizeMath as normalize,
  parseArithmetic,
  equationKey,
  expressionKey,
} from './algebra';
function canonical(input: string): string | null {
  try {
    const tree = parseArithmetic(input);
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
const nameKey = (text: string) => normalize(text).replace(/[’'\s-]/g, '');
const signatures = FORMULAS.map((f) => {
  const equations = [f.equation, ...f.aliases.filter((a) => a.includes('='))];
  if (f.id === 'kinetic') equations.push('E = 0.5*m*v^2', 'K = 0.5*m*v^2');
  return {
    f,
    names: [f.title, f.output, ...f.aliases.filter((a) => !a.includes('='))].map(nameKey),
    relations: new Set(equations.map(equationKey).filter(Boolean)),
    expressions: new Set(equations.map((e) => expressionKey(e.split('=')[1])).filter(Boolean)),
    pairs: equations
      .map((e) => ({ lhs: normalize(e.split('=')[0]), rhs: canonical(e.split('=')[1]) }))
      .filter((pair) => pair.rhs !== null),
  };
});

/** Isolate math from ordinary requests without using a provider or altering the equation. */
function candidates(prompt: string): string[] {
  if (prompt.length > 2000) return [];
  const text = normalize(prompt)
    .replace(/[“”`$]/g, '')
    .replace(/[.?!]+$/, '')
    .trim();
  const out = new Set([text]);
  const add = (value: string) => {
    value = value.trim().replace(/^\[([\s\S]*)\]$/, '$1');
    if (value) out.add(value);
  };
  for (const clause of text.split(
    /[:;?!\n]|\b(?:please|explain|show|me|visualize|visualise|animate|plot|demonstrate|simulate|create|the|experiment|equation|formula|using|for|with|where|how|does|works?)\b/,
  )) {
    add(clause);
    const parts = clause.split('=');
    if (parts.length === 2) {
      const symbol = parts[0].trim().match(/(?:^|\s)([a-z]{1,2}\d*)$/)?.[1];
      if (symbol) add(symbol + '=' + parts[1]);
    }
  }
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') stack.push(i);
    if (text[i] === ')' && stack.length) {
      const start = stack.pop()!;
      const group = text.slice(start + 1, i);
      if (group.includes('=')) add(group);
    }
  }
  return [...out].slice(0, 40);
}

export const hasEquationInput = (prompt: string) => /[=^*/√²³⁴⁵⁶⁷⁸⁹]|^[-+]\s*[a-z]/i.test(prompt);
export const hasModelModifiers = (prompt: string) =>
  /\b(relativistic|angular momentum|damped|nonlinear|quantum|friction|drag)\b/i.test(prompt);

export function matchFormula(prompt: string) {
  const text = normalize(prompt)
    .replace(/[.?!]+$/, '')
    .trim();
  if (!text.includes('=')) {
    const clean = text.replace(/[’']/g, '');
    const exact = signatures.filter((s) => s.names.includes(nameKey(text)));
    if (exact.length === 1) return exact[0].f;
    if (!hasModelModifiers(clean)) {
      const mentions = FORMULAS.flatMap((f) =>
        [f.title, ...f.aliases.filter((a) => !a.includes('='))].flatMap((alias) => {
          const name = normalize(alias).replace(/[’']/g, '');
          const i = clean.indexOf(name);
          return i >= 0 &&
            !/[a-z]/.test(clean[i - 1] || '') &&
            !/[a-z]/.test(clean[i + name.length] || '')
            ? [{ f, start: i, end: i + name.length }]
            : [];
        }),
      );
      const matches = new Set(
        mentions
          .filter(
            (m) =>
              !mentions.some(
                (other) =>
                  other.f !== m.f &&
                  other.start <= m.start &&
                  other.end >= m.end &&
                  other.end - other.start > m.end - m.start,
              ),
          )
          .map((m) => m.f),
      );
      if (matches.size === 1) return [...matches][0];
    }
  }
  const matched = new Set<(typeof FORMULAS)[number]>();
  for (const input of candidates(prompt)) {
    const parts = input.split('=');
    if (parts.length > 2) continue;
    const relation = parts.length === 2 ? equationKey(input) : null;
    const expression = parts.length === 1 ? expressionKey(input) : null;
    const rhs = canonical(parts.at(-1)!);
    const lhs = parts.length === 2 ? normalize(parts[0]) : null;
    for (const s of signatures) {
      if (
        (relation && s.relations.has(relation)) ||
        (expression && s.expressions.has(expression)) ||
        (rhs && s.pairs.some((pair) => (!lhs || pair.lhs === lhs) && pair.rhs === rhs))
      )
        matched.add(s.f);
      // A descriptive left side, such as “kinetic energy = ½mv²”, is also supported.
      if (parts.length === 2 && s.names.includes(nameKey(parts[0]))) {
        if (
          s.pairs.some((pair) => {
            const key = equationKey(pair.lhs + '=' + parts[1]);
            return key && s.relations.has(key);
          })
        )
          matched.add(s.f);
      }
    }
  }
  return matched.size === 1 ? [...matched][0] : null;
}

const lessonEquations = [
  { id: 'gravitational-attraction' as const, equations: ['F=G*m1*m2/r^2'] },
  {
    id: 'wave-interference' as const,
    equations: ['y=y1+y2', 'y=A1*sin(k*x-2*pi*f*t)+A2*sin(k*x-2*pi*f*t+phi)'],
  },
  { id: 'gradient-descent' as const, equations: ['L=(w-3)^2', 'w_next=w-eta*2*(w-3)'] },
].map((lesson) => ({
  ...lesson,
  keys: new Set(lesson.equations.map(equationKey).filter(Boolean)),
}));

export function matchLessonEquation(prompt: string) {
  const matches = new Set<(typeof lessonEquations)[number]['id']>();
  for (const input of candidates(prompt)) {
    const key = equationKey(input);
    if (key) for (const lesson of lessonEquations) if (lesson.keys.has(key)) matches.add(lesson.id);
  }
  return matches.size === 1 ? [...matches][0] : null;
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
