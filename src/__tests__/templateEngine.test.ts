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
  {
    question: 'Tell me About Me',
    answer: 'I am Kishan Borad, based in the US, with seven years in QA and delivery.',
    keywords: ['about', 'who', 'personal', 'background', 'interests'],
    category: 'personality',
    suggestions: [],
  },
];

const TEST_MAP = [
  { tokens: ['kishan', 'borad'], target: 'Tell me About Me' },
  { phrase: 'who are you', target: 'Tell me About Me' },
  { phrase: 'about yourself', target: 'Tell me About Me' },
  { tokens: ['job', 'jobs', 'worked'], target: 'Tell me about your experience' },
  { tokens: ['languages'], target: "What's your tech stack?" },
  { phrase: 'how many projects', target: 'Show me your projects' },
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

  it('reports its winning score and whether it matched', () => {
    expect(engine.respond('Tell me about your experience').matched).toBe(true);
    expect(engine.respond('favorite pizza topping').matched).toBe(false);
    expect(engine.respond('favorite pizza topping').score).toBe(0);
  });
});

describe('TemplateEngine with a keyword map', () => {
  const mapped = new TemplateEngine(TEST_FAQS, TEST_MAP);

  it('answers the reported question about who Kishan is', () => {
    const result = mapped.respond('Can you tell me who kishan is and what he does');
    expect(result.matched).toBe(true);
    expect(result.answer).toContain('Kishan Borad');
  });

  it('answers a bare name question', () => {
    expect(mapped.respond('Who is Kishan?').answer).toContain('Kishan Borad');
  });

  it('answers a question made only of common words when a phrase maps it', () => {
    expect(mapped.respond('Who are you?').answer).toContain('Kishan Borad');
  });

  it('answers an about-yourself paraphrase', () => {
    expect(mapped.respond('Tell me about yourself').answer).toContain('Kishan Borad');
  });

  it('links a jobs paraphrase to the experience entry', () => {
    expect(mapped.respond('What jobs have you had?').answer).toContain('QA automation');
  });

  it('links a single synonym to the tech stack entry', () => {
    expect(mapped.respond('What languages?').answer).toContain('Python');
  });

  it('links a project-count paraphrase to the projects entry', () => {
    expect(mapped.respond('How many projects have you built?').answer).toContain('playgrounds');
  });

  it('still lets real keyword overlap outscore a mapped entry', () => {
    const result = mapped.respond('What projects have you built?');
    expect(result.answer).toContain('playgrounds');
  });

  it('still falls back for unmapped out-of-scope questions', () => {
    const result = mapped.respond('What is the weather today?');
    expect(result.matched).toBe(false);
    expect(result.answer).toContain("don't have specific details");
  });
});
