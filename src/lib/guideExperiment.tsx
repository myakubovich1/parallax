import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { GuideSnapshot } from './help';

type Reader = () => GuideSnapshot;
const Context = createContext<{
  read: () => GuideSnapshot | null;
  focused: () => string | null;
  register: (reader: Reader) => () => void;
} | null>(null);

/** Share committed experiment state without lifting simulation state or re-rendering the app per frame. */
export function GuideExperimentProvider({ children }: { children: ReactNode }) {
  const reader = useRef<Reader | null>(null);
  const focused = useRef<string | null>(null);
  const registry = useMemo(
    () => ({
      read: () => reader.current?.() ?? null,
      focused: () => focused.current,
      register: (next: Reader) => {
        reader.current = next;
        focused.current = null;
        return () => {
          if (reader.current === next) {
            reader.current = null;
            focused.current = null;
          }
        };
      },
    }),
    [],
  );
  useEffect(() => {
    const remember = (event: Event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const input = event.target.matches('input[type=range]')
        ? event.target
        : event.target
            .closest('.param, .catalog-control, .generated-param')
            ?.querySelector('input[type=range]');
      if (input?.id && /^(range|generated|preview)-[\w-]+$/.test(input.id)) focused.current = input.id;
    };
    const events = ['focusin', 'input', 'pointerdown'];
    events.forEach((name) => document.addEventListener(name, remember, true));
    return () => events.forEach((name) => document.removeEventListener(name, remember, true));
  }, []);
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}

export function useGuideExperiment() {
  const registry = useContext(Context);
  if (!registry) throw new Error('GuideExperimentProvider is required');
  return registry;
}

export function usePublishGuideExperiment(read: Reader) {
  const registry = useGuideExperiment();
  const latest = useRef(read);
  useLayoutEffect(() => {
    latest.current = read;
  });
  useLayoutEffect(() => registry.register(() => latest.current()), [registry]);
}

export const guideValue = (value: number, unit = '') =>
  `${Number.isFinite(value) ? Number(value.toPrecision(12)) : 'unavailable'}${unit ? ` ${unit}` : ''}`;
