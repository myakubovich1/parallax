const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

export const fixed = (v: number, digits = 2) => (Object.is(v, -0) ? 0 : v).toFixed(digits).replace(/^-0(\.0+)?$/, '0$1');

/** 1.67 × 10⁻⁶ — exact digits are preserved, only notation changes. */
export function sci(v: number, digits = 3): string {
  if (v === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  if (exp >= -2 && exp < 4) return v.toPrecision(digits);
  const mant = v / 10 ** exp;
  return `${mant.toFixed(digits - 1)} × 10${String(exp).split('').map((c) => SUP[c]).join('')}`;
}

export const signed = (v: number, digits = 2) => (v >= 0 ? '+' : '−') + fixed(Math.abs(v), digits);
