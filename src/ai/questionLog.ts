import type { ResponseRoute, Tier } from '../types';

/**
 * One logged question: what was asked, which tier and route answered
 * it, and how long it took. Answers are never stored. The log lives
 * only in this browser's localStorage; nothing is sent anywhere.
 * Kishan reviews the exported log and turns missed questions into
 * keyword-map entries, which ship through the normal review flow.
 */
export interface QuestionLogEntry {
  askedAt: string;
  question: string;
  tier: Tier;
  route: ResponseRoute;
  templateScore: number | null;
  fallback: boolean;
  durationMs: number;
  firstTokenMs: number | null;
}

const STORAGE_KEY = 'assistant-question-log-v1';
const MAX_ENTRIES = 200;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function readStored(): QuestionLogEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is QuestionLogEntry =>
        typeof e === 'object' && e !== null && typeof (e as { question?: unknown }).question === 'string',
    );
  } catch {
    return [];
  }
}

export function getQuestionLog(now: number = Date.now()): QuestionLogEntry[] {
  return readStored().filter((e) => now - Date.parse(e.askedAt) <= RETENTION_MS);
}

export function logQuestion(entry: QuestionLogEntry): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const log = getQuestionLog();
    log.push(entry);
    const trimmed = log.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Logging must never break answering.
  }
}

export function clearQuestionLog(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the log is best effort.
  }
}

export function exportQuestionLog(now: number = Date.now()): string {
  return JSON.stringify(
    { exportedAt: new Date(now).toISOString(), entries: getQuestionLog(now) },
    null,
    2,
  );
}
