import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMediaQuery } from './clock';
import { readPref, writePref } from './storage';

export type MotionPref = 'system' | 'reduce' | 'full';
interface Settings {
  effects: boolean;
  setEffects: (v: boolean) => void;
  motion: MotionPref;
  setMotion: (v: MotionPref) => void;
  reducedMotion: boolean;
}

const Ctx = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [effects, setEffects] = useState(() => readPref('effects', true));
  const [motion, setMotion] = useState<MotionPref>(() => readPref('motion', 'system'));
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reducedMotion = motion === 'reduce' || (motion === 'system' && systemReduce);

  useEffect(() => {
    writePref('effects', effects);
    document.documentElement.dataset.effects = effects ? 'on' : 'off';
  }, [effects]);
  useEffect(() => {
    writePref('motion', motion);
    document.documentElement.dataset.motion = reducedMotion ? 'reduce' : 'full';
  }, [motion, reducedMotion]);

  const value = useMemo(() => ({ effects, setEffects, motion, setMotion, reducedMotion }), [effects, motion, reducedMotion]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSettings outside SettingsProvider');
  return s;
}
