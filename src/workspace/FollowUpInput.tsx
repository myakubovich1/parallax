import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';

export interface FollowUpReply { kind: 'done' | 'unsupported' | 'hint'; text: string }

interface Props { suggestions: string[]; reply: FollowUpReply | null; onSubmit: (text: string) => void }

export function FollowUpInput({ suggestions, reply, onSubmit }: Props) {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(text);
    if (text.trim()) setText('');
  };
  return (
    <form className="followup frame" onSubmit={submit}>
      <span className="reg tl" aria-hidden="true" />
      <span className="reg br" aria-hidden="true" />
      <label htmlFor="followup" className="field-label">What would you like to change or understand?</label>
      <div className="followup-row">
        <input id="followup" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={`e.g. ${suggestions[0] ?? 'Explain this differently'}`} autoComplete="off" />
        <button className="btn primary" type="submit"><Icon name="send" size={16} /> Apply</button>
      </div>
      <div className="chips" aria-label="Suggestions">
        {suggestions.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => onSubmit(s)}>{s}</button>
        ))}
      </div>
      <p className={`followup-reply ${reply ? reply.kind : ''}`} role="status" aria-live="polite">
        {reply && (
          <>
            <span className="instrument-label">{reply.kind === 'done' ? 'Applied' : reply.kind === 'unsupported' ? 'Demo mode' : 'Tip'}</span> {reply.text}
          </>
        )}
      </p>
    </form>
  );
}
