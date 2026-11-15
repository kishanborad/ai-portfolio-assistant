import { describe, it, expect, beforeEach } from 'vitest';
import {
  logQuestion,
  getQuestionLog,
  clearQuestionLog,
  exportQuestionLog,
  type QuestionLogEntry,
} from '../ai/questionLog';

const ENTRY: QuestionLogEntry = {
  askedAt: new Date().toISOString(),
  question: 'Who is Kishan?',
  tier: 'template',
  route: 'template',
  templateScore: 3,
  fallback: false,
  durationMs: 2,
  firstTokenMs: null,
};

describe('questionLog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty and records a logged question', () => {
    expect(getQuestionLog()).toEqual([]);
    logQuestion(ENTRY);
    const log = getQuestionLog();
    expect(log).toHaveLength(1);
    expect(log[0].question).toBe('Who is Kishan?');
    expect(log[0].fallback).toBe(false);
  });

  it('never stores answers', () => {
    logQuestion(ENTRY);
    const raw = localStorage.getItem('assistant-question-log-v1') ?? '';
    expect(raw).not.toContain('QA Engineer');
    expect(exportQuestionLog()).toContain('Who is Kishan?');
  });

  it('caps the log at 200 entries, keeping the newest', () => {
    for (let i = 0; i < 205; i++) {
      logQuestion({ ...ENTRY, question: `question ${i}` });
    }
    const log = getQuestionLog();
    expect(log).toHaveLength(200);
    expect(log[0].question).toBe('question 5');
    expect(log[199].question).toBe('question 204');
  });

  it('drops entries older than 90 days', () => {
    const old = { ...ENTRY, askedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString() };
    logQuestion(old);
    logQuestion(ENTRY);
    expect(getQuestionLog()).toHaveLength(1);
  });

  it('returns an empty log when storage holds garbage', () => {
    localStorage.setItem('assistant-question-log-v1', '{not json');
    expect(getQuestionLog()).toEqual([]);
  });

  it('clears the log', () => {
    logQuestion(ENTRY);
    clearQuestionLog();
    expect(getQuestionLog()).toEqual([]);
  });

  it('exports valid JSON with an export timestamp', () => {
    logQuestion(ENTRY);
    const parsed = JSON.parse(exportQuestionLog()) as { exportedAt: string; entries: unknown[] };
    expect(typeof parsed.exportedAt).toBe('string');
    expect(parsed.entries).toHaveLength(1);
  });
});
