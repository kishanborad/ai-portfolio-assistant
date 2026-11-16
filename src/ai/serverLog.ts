/**
 * Server-side question logging (Supabase).
 *
 * Each answered question is sent as one row to the question_logs
 * table: the question text plus routing metadata only. Answers are
 * never stored, and nothing identifying the visitor is collected.
 * Logging is fire-and-forget with a short timeout, and it never
 * throws: a missing backend, a paused project, or a failed request
 * simply means the question is not recorded. When the Supabase
 * env vars are unset (local dev, PR builds), this is a no-op.
 */
export interface ServerLogEntry {
  question: string;
  tier: string;
  route: string;
  templateScore: number | null;
  fallback: boolean;
  durationMs: number | null;
  firstTokenMs: number | null;
}

const TIMEOUT_MS = 3000;
const MAX_QUESTION_CHARS = 500;

export async function logQuestionToServer(entry: ServerLogEntry): Promise<void> {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !key) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      await fetch(`${url}/rest/v1/question_logs`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          question: entry.question.slice(0, MAX_QUESTION_CHARS),
          tier: entry.tier,
          route: entry.route,
          template_score: entry.templateScore,
          fallback: entry.fallback,
          duration_ms: entry.durationMs,
          first_token_ms: entry.firstTokenMs,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Logging must never break answering.
  }
}
