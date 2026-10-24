import type { ComponentType } from 'react';
import type { LessonSpec } from '../lib/lessons/types';
import type { RendererProps } from './types';

type Kind = LessonSpec['renderer'];
const loaders: Record<Kind, () => Promise<{ default: ComponentType<RendererProps> }>> = {
  wave: () => import('./WaveRenderer'),
  gravity: () => import('./GravityRenderer'),
  gradient: () => import('./GradientRenderer'),
};

const cache = new Map<Kind, ComponentType<RendererProps>>();

export async function loadRenderer(kind: Kind): Promise<ComponentType<RendererProps>> {
  const hit = cache.get(kind);
  if (hit) return hit;
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo-slow')) {
    // QA hook (development builds only): emulate a slow network so the in-progress state can be inspected.
    await new Promise((r) => setTimeout(r, 2500));
  }
  const mod = await loaders[kind]();
  cache.set(kind, mod.default);
  return mod.default;
}

export const getLoadedRenderer = (kind: Kind) => cache.get(kind) ?? null;
