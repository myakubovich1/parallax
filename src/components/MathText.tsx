import { Fragment } from 'react';

/** Renders mini-markup: A_1 → A₁ as <sub>, r^2 → <sup>, braces group: w_{next}. */
export function MathText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
  };
  while (i < text.length) {
    const ch = text[i];
    if ((ch === '_' || ch === '^') && i + 1 < text.length) {
      flush();
      let content: string;
      if (text[i + 1] === '{') {
        const end = text.indexOf('}', i + 2);
        content = text.slice(i + 2, end < 0 ? undefined : end);
        i = end < 0 ? text.length : end + 1;
      } else {
        content = text[i + 1];
        i += 2;
      }
      out.push(ch === '_' ? <sub key={i}>{content}</sub> : <sup key={i}>{content}</sup>);
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return <>{out.map((n, k) => <Fragment key={k}>{n}</Fragment>)}</>;
}
