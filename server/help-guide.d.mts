import type { GuideContext, GuideReply } from '../src/lib/help';
export const APP_GUIDE: string;
export function readGuidePayload(text: string): { answer: string; actions: unknown[] };
export function localGuideAnswer(question: string, context: GuideContext): GuideReply | null;
