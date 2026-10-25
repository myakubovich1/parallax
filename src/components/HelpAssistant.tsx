import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { localGuideAnswer } from '../../server/help-guide.mjs';
import { useMediaQuery } from '../lib/clock';
import {
  guideActionLabel,
  guideSuggestions,
  type GuideAction,
  type GuideContext,
  type GuideMessage,
} from '../lib/help';
import { Icon } from './Icon';

const STORAGE = 'parallax.help.v1';
const redact = (text: string) => text.replace(/sk-[\w-]{12,}|AIza[\w-]{25,}/g, '[redacted key]');
function safeActions(value: unknown): GuideAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 3)
    .filter(
      (a): a is GuideAction =>
        a &&
        (['open-library', 'open-saved', 'open-settings', 'show-modes'].includes(a.type) ||
          (a.type === 'fill-question' && typeof a.question === 'string' && a.question.length <= 500) ||
          (a.type === 'highlight-control' &&
            typeof a.controlId === 'string' &&
            /^(range|generated)-[a-zA-Z0-9_-]+$/.test(a.controlId))),
    );
}
function loadChat(): GuideMessage[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE) || '[]');
    return Array.isArray(value)
      ? value
          .slice(-24)
          .filter(
            (m) =>
              m &&
              ['user', 'assistant'].includes(m.role) &&
              typeof m.content === 'string' &&
              m.content.length <= 5000,
          )
          .map((m) => ({
            id: typeof m.id === 'string' ? m.id : crypto.randomUUID(),
            role: m.role,
            content: redact(m.content),
            actions: safeActions(m.actions),
            source: m.source === 'gemma' ? 'gemma' : 'guide',
          }))
      : [];
  } catch {
    return [];
  }
}
export function HelpAssistant({
  open,
  onClose,
  pageKey,
  getContext,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  pageKey: string;
  getContext: () => GuideContext;
  onAction: (action: GuideAction) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const headingId = useId();
  const mobile = useMediaQuery('(max-width: 700px)');
  const [messages, setMessages] = useState<GuideMessage[]>(loadChat);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<GuideContext>(() => ({
    screen: 'entry',
    title: '',
    mode: '',
    summary: '',
    error: '',
    controls: [],
    readouts: '',
    savedCount: 0,
  }));
  const nested = context.screen === 'saved' || context.screen === 'settings';
  useEffect(() => {
    if (open) setContext(getContext());
  }, [open, pageKey, getContext]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (node.open) node.close();
    if (!open) return;
    if (mobile || document.querySelector('dialog.dialog[open]')) node.showModal();
    else node.show();
    const frame = requestAnimationFrame(() => composer.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, mobile, nested]);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(messages.slice(-24)));
    } catch {
      /* Chat still works if browser storage is unavailable. */
    }
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, pending, open]);
  useEffect(() => () => controller.current?.abort(), []);

  const stop = () => {
    sequence.current++;
    controller.current?.abort();
    controller.current = null;
    setPending(false);
    setError('Response stopped. You can retry your question.');
  };
  const send = async (question?: string, retry = false) => {
    const text = redact((question ?? draft).trim());
    if (!text || text.length > 1600 || pending) return;
    const current = getContext();
    setContext(current);
    setError(null);
    const history = retry
      ? messages
      : [...messages, { id: crypto.randomUUID(), role: 'user' as const, content: text }];
    setMessages(history.slice(-24));
    setDraft('');
    const local = localGuideAnswer(text, current);
    if (local) {
      setMessages([
        ...history.slice(-23),
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: local.answer,
          actions: local.actions,
          source: 'guide',
        },
      ]);
      return;
    }
    const ac = new AbortController();
    controller.current = ac;
    const id = ++sequence.current;
    setPending(true);
    try {
      const response = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 1600) })),
          context: current,
        }),
      });
      const data = await response.json().catch(() => null);
      if (id !== sequence.current) return;
      if (!response.ok)
        throw new Error(data?.error || 'The guide is unavailable. Please retry or use a quick help topic.');
      if (typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 5000)
        throw new Error('The guide couldn’t complete its answer. Please retry.');
      setMessages([
        ...history.slice(-23),
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: redact(data.answer),
          actions: safeActions(data.actions),
          source: data.source === 'guide' ? 'guide' : 'gemma',
        },
      ]);
    } catch (e) {
      if (id === sequence.current && !ac.signal.aborted)
        setError(
          e instanceof Error && !(e instanceof TypeError)
            ? e.message
            : 'The guide couldn’t connect. Please retry or choose a quick help topic.',
        );
    } finally {
      if (id === sequence.current) {
        setPending(false);
        controller.current = null;
      }
    }
  };
  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')?.content;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };
  return (
    <dialog
      ref={dialog}
      id="parallax-help-dialog"
      className="robot-guide-dialog"
      aria-labelledby={headingId}
      aria-modal={mobile || context.screen === 'saved' || context.screen === 'settings'}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="guide-header">
        <div>
          <span className="instrument-label">Your lab guide</span>
          <h2 id={headingId}>Ask Parallax</h2>
        </div>
        <div className="row">
          <button
            className="icon-btn"
            type="button"
            aria-label="Clear conversation"
            title="Clear conversation"
            onClick={() => {
              stop();
              setMessages([]);
              setDraft('');
              setError(null);
              composer.current?.focus();
            }}
          >
            <Icon name="trash" />
          </button>
          <button className="icon-btn" type="button" aria-label="Close Parallax guide" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </header>
      <p className="guide-context">
        {context.screen === 'lesson'
          ? `Exploring ${context.title}`
          : context.screen === 'saved'
            ? 'Your saved experiments'
            : context.screen === 'settings'
              ? 'Your preferences'
              : context.screen === 'error'
                ? 'Let’s get you unstuck'
                : 'Let’s find something to explore'}
      </p>
      <div
        ref={scroll}
        className="guide-conversation"
        role="log"
        aria-label="Guide conversation"
        aria-relevant="additions text"
        aria-busy={pending}
        tabIndex={0}
      >
        {!messages.length && (
          <div className="guide-welcome">
            <span aria-hidden="true">✦</span>
            <h3>What would you like to figure out?</h3>
            <p>
              I can help you choose a question, understand an experiment, or find your way around Parallax.
            </p>
          </div>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`guide-message ${message.role}`}
            aria-label={message.role === 'user' ? 'You' : 'Parallax guide'}
          >
            <span className="guide-speaker">{message.role === 'user' ? 'You' : 'Parallax'}</span>
            <div className="guide-answer">{message.content}</div>
            {!!message.actions?.length && (
              <div className="guide-actions">
                {message.actions.map((action, i) => (
                  <button key={i} type="button" className="btn small" onClick={() => onAction(action)}>
                    {guideActionLabel(action)}
                  </button>
                ))}
              </div>
            )}
            {message.role === 'assistant' && (
              <small className="guide-source">
                {message.source === 'gemma' ? 'Gemma' : 'From the Parallax guide'}
              </small>
            )}
          </article>
        ))}
        {pending && (
          <p className="guide-pending" role="status">
            Parallax is thinking…
          </p>
        )}
        {error && (
          <div className="guide-error" role="alert">
            <p>{error}</p>
            {lastQuestion && (
              <button type="button" className="btn small" onClick={() => void send(lastQuestion, true)}>
                Retry question
              </button>
            )}
          </div>
        )}
      </div>
      <div className="guide-suggestions" aria-label="Suggested help questions">
        {guideSuggestions(context).map((question) => (
          <button key={question} type="button" disabled={pending} onClick={() => void send(question)}>
            {question}
          </button>
        ))}
      </div>
      <form className="guide-composer" onSubmit={submit}>
        <label htmlFor="guide-question" className="sr-only">
          Ask about using Parallax
        </label>
        <textarea
          ref={composer}
          id="guide-question"
          value={draft}
          maxLength={1600}
          rows={2}
          placeholder="Ask about using Parallax…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {pending ? (
          <button type="button" className="btn" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn primary" disabled={!draft.trim()}>
            Send <Icon name="send" size={16} />
          </button>
        )}
      </form>
      <p className="guide-footnote">
        Quick help comes from our guide. Other questions use Gemma with recent chat and this screen’s context.
        Chat stays in this tab until cleared.
      </p>
    </dialog>
  );
}
