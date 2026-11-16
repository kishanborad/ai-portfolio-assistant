import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logQuestionToServer, type ServerLogEntry } from '../ai/serverLog';

const ENTRY: ServerLogEntry = {
  question: 'Who is Kishan?',
  tier: 'template',
  route: 'template',
  templateScore: 5,
  fallback: false,
  durationMs: 120,
  firstTokenMs: null,
};

describe('logQuestionToServer', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({} as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts one row with the mapped columns and auth headers', async () => {
    await logQuestionToServer(ENTRY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/question_logs');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('test-anon-key');
    expect(headers.Authorization).toBe('Bearer test-anon-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Prefer).toBe('return=minimal');
    expect(JSON.parse(init.body as string)).toEqual({
      question: 'Who is Kishan?',
      tier: 'template',
      route: 'template',
      template_score: 5,
      fallback: false,
      duration_ms: 120,
      first_token_ms: null,
    });
  });

  it('sends no request when the env vars are unset', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await logQuestionToServer(ENTRY);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not throw when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(logQuestionToServer(ENTRY)).resolves.toBeUndefined();
  });

  it('truncates questions longer than 500 chars', async () => {
    await logQuestionToServer({ ...ENTRY, question: 'x'.repeat(600) });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { question: string };
    expect(body.question).toHaveLength(500);
  });
});
