import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../ai/engines';
import type { FAQEntry } from '../types';

const TEST_FAQS: FAQEntry[] = [
  {
    question: 'Tell me about your experience',
    answer: 'I have seven years of QA automation experience.',
    keywords: ['experience', 'work', 'career', 'QA'],
    category: 'resume',
    suggestions: [{ label: 'Tech stack?', query: "What's your tech stack?" }],
  },
  {
    question: 'Show me your projects',
    answer: 'I built three interactive playgrounds.',
    keywords: ['projects', 'portfolio', 'built', 'playground'],
    category: 'projects',
    suggestions: [{ label: 'Test runner?', query: 'Tell me about the test runner' }],
  },
  {
    question: "What's your tech stack?",
    answer: 'Python, TypeScript, Playwright, Docker.',
    keywords: ['tech', 'stack', 'tools', 'languages', 'skills'],
    category: 'resume',
    suggestions: [],
  },
  {
    question: 'Tell me Contact',
    answer:
      "You can reach me on LinkedIn at https://linkedin.com/in/kishanborad27, on GitHub at https://github.com/kishanborad, or by email at borad.kishan0@gmail.com.",
    keywords: ['contact', 'email', 'linkedin', 'github', 'reach'],
    category: 'personality',
    suggestions: [],
  },
];

describe('TemplateEngine', () => {
  const engine = new TemplateEngine(TEST_FAQS);

  it('matches a query to the best FAQ entry by keyword overlap', () => {
    const result = engine.respond('Tell me about your QA experience');
    expect(result.answer).toContain('QA automation');
  });

  it('returns suggestions from the matched entry', () => {
    const result = engine.respond('What projects have you built?');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('returns fallback for unrecognized queries', () => {
    const result = engine.respond('favorite pizza topping');
    expect(result.answer).toContain("don't have specific details");
  });

  it('returns fallback for empty queries', () => {
    const result = engine.respond('');
    expect(result.answer).toContain("didn't catch that");
  });

  it('matches tech stack query correctly', () => {
    const result = engine.respond('What tools and languages do you use?');
    expect(result.answer).toContain('Python');
  });

  it('is case-insensitive', () => {
    const result = engine.respond('PROJECTS PORTFOLIO');
    expect(result.answer).toContain('playgrounds');
  });

  it('refuses out-of-scope questions instead of matching common words', () => {
    const result = engine.respond('What is the weather today?');
    expect(result.answer).toContain("don't have specific details");
  });

  it('does not match a query made only of common words', () => {
    const result = engine.respond('What is it?');
    expect(result.answer).toContain("didn't catch that");
  });

  it('does not match a single unrelated word', () => {
    const result = engine.respond('hello');
    expect(result.answer).toContain("don't have specific details");
  });

  it('still matches a normal question with only one content word', () => {
    const result = engine.respond('experience');
    expect(result.answer).toContain('QA automation');
  });

  it('still matches the standard experience question', () => {
    const result = engine.respond('Tell me about your experience');
    expect(result.answer).toContain('QA automation');
  });

  it('matches a contact question to the contact entry with all three channels', () => {
    const result = engine.respond('How do I contact Kishan?');
    expect(result.answer).toContain('linkedin.com/in/kishanborad27');
    expect(result.answer).toContain('github.com/kishanborad');
    expect(result.answer).toContain('borad.kishan0@gmail.com');
  });
});
