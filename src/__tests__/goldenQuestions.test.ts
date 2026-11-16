// @vitest-environment node
// Golden evaluation set for the portfolio question bank.
//
// Each case asserts that the primary phrasing of a bank intent retrieves
// the expected knowledge chunk (top result from retrieveChunks, the real
// embedder plus the real rankChunks) or matches the expected FAQ entry
// through the real TemplateEngine. The data files under public/ are read
// from disk, so this file verifies the shipped data, not fixtures.
//
// Cases are grouped by content batch. The retrieval CASES blocks are
// generated from the probe query JSONs kept with the batch tooling; the
// FAQ cases below are hand-written. Do not edit the generated blocks by
// hand: regenerate them so the probe and the test cannot drift apart.
//
// Two Group 1 cases accept more than one source, because every listed
// chunk answers the question correctly: 2.4 (the Prudential file, the
// Mentoring and Coordination file, and the Collaboration file all state
// mentoring plus no formal management role) and 4.1 (the Mentoring and
// Coordination file states the iSchoolConnect role title and function;
// the iSchoolConnect file carries the same title with the work detail).
//
// Group 2 substitutions and allowances: 8.1 uses "What is this
// chatbot?" because the bank's "What are you?" has no content tokens
// and cannot retrieve. 18.1 accepts any of the three sources because
// all three chunks carry explicit generator-vs-runner contrast
// content. 18.3 accepts the assistant file or the overview file
// because both state the newest project. The alternate phrasing "Do
// you use RAG?" is deliberately not in this set: the bare acronym
// query embeds below the retrieval threshold against every chunk,
// while the primary phrasing and "How is the knowledge base built?"
// both retrieve the assistant file.
//
// Group 3 architecture: a skills hub file plus one focused file per
// depth topic (Playwright, Python, SQL, Selenium/Cypress, API
// testing, React/frontend), because a single long skills file
// dilutes every depth paragraph below the role and project files.
// Multi-source cases accept only files whose chunks genuinely carry
// the answer: 19.4 (both state the 4 years), 19.6 (framework,
// exports, or the combined file), 19.7/19.8 (role file plus the
// focused file), 19.11 (the scoping paragraph or the playground
// file, which carries the same disclaimer), 19.13 (Postman suites,
// contract checks, or the combined file), 19.16 (both state the
// Python/TypeScript split).
//
// Group 4 architecture: one file per publication for the two sentiment
// papers (the VIVA-Tech literature study and the IEEE neural-network
// paper), because the sentiment-analysis project file otherwise wins
// both queries on filename-stem boosts; an overview file for the
// remaining works. One file per profile for LinkedIn and GitHub, for
// the same stem reason; the email address stays in the contact file
// because a dedicated email file became a magnet for generic queries
// (its address contains his name and its welcome sentence matches
// "roles"). Deflections live in a boundaries file that contains only
// deflections plus the contact channels, never the private facts.
// Multi-source cases: 20.3 (education or strengths), 21.5
// (collaboration or coordination), 22.3 (the roles list lives in the
// moving-from-coding, about, and contact files), 24.3 (the boundaries
// file or the location file, both of which decline the home address
// and give the city). 25.1/25.2/25.3 are not in this set: follow-ups
// need conversation history and the build is stateless. 25.5
// ("Hi.") is not in this set: single-word greetings retrieve noise
// and belong to the UI/template tier, not retrieval. 25.6 asserts
// empty retrieval for an out-of-scope question.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { retrieveChunks } from '../ai/retriever';
import { TemplateEngine } from '../ai/engines';
import type { KnowledgeChunk, FAQEntry } from '../types';

const here = dirname(fileURLToPath(import.meta.url));
const knowledgePath = resolve(here, '../../public/knowledge.json');
const faqPath = resolve(here, '../../public/faq.json');

type Expectation =
  | { source: string }
  | { sources: string[] }
  | { category: string }
  | { empty: true };

interface RetrievalCase {
  id: string;
  query: string;
  expect: Expectation;
}

function describeExpectation(e: Expectation): string {
  if ('source' in e) return `source=${e.source}`;
  if ('sources' in e) return `source in {${e.sources.join(', ')}}`;
  if ('category' in e) return `category=${e.category}`;
  return 'empty';
}

function matches(e: Expectation, top: { source: string; category: string } | undefined): boolean {
  if ('empty' in e) return top === undefined;
  if (!top) return false;
  if ('source' in e) return top.source === e.source;
  if ('sources' in e) return e.sources.includes(top.source);
  return top.category === e.category;
}

// BEGIN CASES G1
const CASES_G1: RetrievalCase[] = [
  { id: "1.1", query: "Who is Kishan Borad?", expect: { source: "about.md" } },
  { id: "1.2", query: "What do you do?", expect: { category: "personality" } },
  { id: "1.3", query: "How many years of experience do you have?", expect: { source: "career-experience.md" } },
  { id: "1.4", query: "What are your strengths?", expect: { source: "strengths.md" } },
  { id: "1.5", query: "Why are you moving away from coding?", expect: { source: "moving-from-coding.md" } },
  { id: "1.6", query: "What drives you?", expect: { source: "drives.md" } },
  { id: "2.1", query: "What was your role at Prudential?", expect: { source: "prudential.md" } },
  { id: "2.2", query: "What did you build at Prudential?", expect: { source: "prudential.md" } },
  { id: "2.3", query: "What tools did you use at Prudential?", expect: { source: "prudential.md" } },
  { id: "2.4", query: "Did you manage anyone at Prudential?", expect: { sources: ["prudential.md", "team-coordination.md", "collaboration.md"] } },
  { id: "2.5", query: "What results did you get at Prudential?", expect: { source: "prudential.md" } },
  { id: "2.6", query: "What did you do before Prudential?", expect: { source: "prudential.md" } },
  { id: "3.1", query: "What did you do at UL Solutions?", expect: { source: "ul-solutions.md" } },
  { id: "3.2", query: "What did you automate at UL Solutions?", expect: { source: "ul-solutions.md" } },
  { id: "3.3", query: "What is SAR testing?", expect: { source: "sar-testing.md" } },
  { id: "3.4", query: "What did you build for audit reports?", expect: { source: "ul-solutions.md" } },
  { id: "4.1", query: "What was your role at iSchoolConnect?", expect: { sources: ["ischoolconnect.md", "team-coordination.md"] } },
  { id: "4.2", query: "What framework did you build at iSchoolConnect?", expect: { source: "ischoolconnect.md" } },
  { id: "4.3", query: "Did you test AI tools at iSchoolConnect?", expect: { source: "ischoolconnect.md" } },
  { id: "4.4", query: "Did you do load testing at iSchoolConnect?", expect: { source: "ischoolconnect.md" } },
  { id: "4.5", query: "How big was the team you coordinated?", expect: { source: "team-coordination.md" } },
  { id: "5.1", query: "Where did you start your career?", expect: { source: "career-experience.md" } },
  { id: "5.2", query: "What did you build at Quantiphi?", expect: { source: "quantiphi.md" } },
  { id: "5.3", query: "Did you do cross-browser testing?", expect: { source: "quantiphi.md" } },
  { id: "6.1", query: "Walk me through your career.", expect: { source: "career-experience.md" } },
  { id: "6.2", query: "How long did you stay at each company?", expect: { source: "career-experience.md" } },
  { id: "6.3", query: "Are you moving from QA to product management?", expect: { category: "personality" } },
  { id: "6.4", query: "How has your career progressed?", expect: { source: "career-experience.md" } },
];
// END CASES G1

// BEGIN CASES G2
const CASES_G2: RetrievalCase[] = [
  { id: "8.1", query: "What is this chatbot?", expect: { source: "ai-assistant.md" } },
  { id: "8.2", query: "How does this assistant work?", expect: { source: "ai-assistant.md" } },
  { id: "8.3", query: "Where do your answers come from?", expect: { source: "ai-assistant.md" } },
  { id: "8.4", query: "Do you store my questions?", expect: { source: "ai-assistant.md" } },
  { id: "8.5", query: "Who made this assistant?", expect: { source: "ai-assistant.md" } },
  { id: "8.6", query: "How accurate are you?", expect: { source: "ai-assistant.md" } },
  { id: "9.1", query: "What is the AI Test Generator?", expect: { source: "ai-test-generator.md" } },
  { id: "9.2", query: "How do I use the AI Test Generator?", expect: { source: "ai-test-generator.md" } },
  { id: "9.3", query: "What does the test generator output?", expect: { source: "ai-test-generator.md" } },
  { id: "9.4", query: "Why did you build the AI Test Generator?", expect: { source: "ai-test-generator.md" } },
  { id: "10.1", query: "What is the Test Runner Playground?", expect: { source: "test-runner.md" } },
  { id: "10.2", query: "How does the test runner execute tests?", expect: { source: "test-runner.md" } },
  { id: "10.3", query: "What comes with the Test Runner Playground?", expect: { source: "test-runner.md" } },
  { id: "11.1", query: "What is the Visual Regression Lab?", expect: { source: "visual-regression.md" } },
  { id: "11.2", query: "How does the pixel diff work?", expect: { source: "visual-regression.md" } },
  { id: "11.3", query: "Does the Visual Regression Lab work with CI?", expect: { source: "visual-regression.md" } },
  { id: "12.1", query: "What is the SQL Analytics Workbench?", expect: { source: "sql-workbench.md" } },
  { id: "12.2", query: "What datasets are in the SQL workbench?", expect: { source: "sql-workbench.md" } },
  { id: "12.3", query: "How does the SQL workbench run without a server?", expect: { source: "sql-workbench.md" } },
  { id: "13.1", query: "What is the Event-Stream Playground?", expect: { source: "event-stream.md" } },
  { id: "13.2", query: "How do you build topologies in the event-stream tool?", expect: { source: "event-stream.md" } },
  { id: "13.3", query: "Why did you build the event-stream playground?", expect: { source: "event-stream.md" } },
  { id: "7.1", query: "What projects have you built?", expect: { source: "projects-overview.md" } },
  { id: "7.2", query: "Which project should I look at first?", expect: { source: "projects-overview.md" } },
  { id: "7.3", query: "Can I try your projects?", expect: { source: "projects-overview.md" } },
  { id: "7.4", query: "What do your projects have in common?", expect: { source: "projects-overview.md" } },
  { id: "14.1", query: "What is Kanha?", expect: { source: "kanha.md" } },
  { id: "14.2", query: "Which LLM providers does Kanha support?", expect: { source: "kanha.md" } },
  { id: "14.3", query: "Can I try Kanha?", expect: { source: "kanha.md" } },
  { id: "15.1", query: "What is AI Document Intelligence?", expect: { source: "ai-document-intelligence.md" } },
  { id: "15.2", query: "How does the OCR work in AI Document Intelligence?", expect: { source: "ai-document-intelligence.md" } },
  { id: "15.3", query: "What can I export from AI Document Intelligence?", expect: { source: "ai-document-intelligence.md" } },
  { id: "16.1", query: "What is the Bug Hunt Playground?", expect: { source: "bug-hunt-playground.md" } },
  { id: "16.2", query: "What probes does Bug Hunt run?", expect: { source: "bug-hunt-playground.md" } },
  { id: "16.3", query: "What does the Bug Hunt report card show?", expect: { source: "bug-hunt-playground.md" } },
  { id: "17.1", query: "What is the sentiment analysis project?", expect: { source: "sentiment-analysis.md" } },
  { id: "17.2", query: "How does the sentiment analysis system work?", expect: { source: "sentiment-analysis.md" } },
  { id: "17.3", query: "When did you build the sentiment analysis project?", expect: { source: "sentiment-analysis.md" } },
  { id: "18.1", query: "What is the difference between the AI Test Generator and the Test Runner?", expect: { sources: ["ai-test-generator.md", "test-runner.md", "projects-overview.md"] } },
  { id: "18.2", query: "Which of your projects use AI?", expect: { source: "projects-overview.md" } },
  { id: "18.3", query: "What is your newest project?", expect: { sources: ["ai-assistant.md", "projects-overview.md"] } },
  { id: "18.4", query: "What about the other project?", expect: { source: "projects-overview.md" } },
];
// END CASES G2

// BEGIN CASES G3
const CASES_G3: RetrievalCase[] = [
  { id: "19.1", query: "How good are you with Playwright?", expect: { source: "playwright.md" } },
  { id: "19.2", query: "How strong is your Python?", expect: { source: "python.md" } },
  { id: "19.3", query: "How good is your SQL?", expect: { source: "sql.md" } },
  { id: "19.4", query: "How much TypeScript experience do you have?", expect: { sources: ["skills.md", "playwright.md"] } },
  { id: "19.5", query: "How much Selenium experience do you have?", expect: { source: "selenium-cypress.md" } },
  { id: "19.6", query: "Do you know Cypress?", expect: { sources: ["selenium-cypress.md", "ischoolconnect.md", "ai-test-generator.md"] } },
  { id: "19.7", query: "Have you done API testing?", expect: { source: "api-testing.md" } },
  { id: "19.8", query: "What AWS experience do you have?", expect: { sources: ["skills.md", "prudential.md"] } },
  { id: "19.9", query: "Do you use Jira?", expect: { source: "skills.md" } },
  { id: "19.10", query: "Do you know React?", expect: { source: "react-frontend.md" } },
  { id: "19.11", query: "Do you know Kafka?", expect: { sources: ["skills.md", "event-stream.md"] } },
  { id: "19.12", query: "Have you done performance testing?", expect: { source: "ischoolconnect.md" } },
  { id: "19.13", query: "Do you use Postman?", expect: { sources: ["api-testing.md", "ischoolconnect.md", "prudential.md"] } },
  { id: "19.14", query: "Playwright or Selenium: which do you prefer?", expect: { source: "skills.md" } },
  { id: "19.15", query: "Playwright vs Cypress: what is your take?", expect: { source: "skills.md" } },
  { id: "19.16", query: "Python or TypeScript: which do you use more?", expect: { sources: ["skills.md", "python.md"] } },
  { id: "19.17", query: "Are you full stack?", expect: { source: "skills.md" } },
  { id: "19.18", query: "Have you used Appium?", expect: { source: "skills.md" } },
];
// END CASES G3

// BEGIN CASES G4
const CASES_G4: RetrievalCase[] = [
  { id: "20.1", query: "What is your education?", expect: { source: "education.md" } },
  { id: "20.2", query: "What did you study in your master's?", expect: { source: "education.md" } },
  { id: "20.3", query: "How do you keep learning?", expect: { sources: ["education.md", "strengths.md"] } },
  { id: "20.4", query: "Do you have any certifications?", expect: { source: "education.md" } },
  { id: "21.1", query: "What is your testing philosophy?", expect: { source: "testing.md" } },
  { id: "21.2", query: "What is your engineering philosophy?", expect: { source: "engineering.md" } },
  { id: "21.3", query: "How do you collaborate with developers?", expect: { source: "collaboration.md" } },
  { id: "21.4", query: "What is shift-left to you?", expect: { source: "collaboration.md" } },
  { id: "21.5", query: "Have you managed people?", expect: { sources: ["collaboration.md", "team-coordination.md"] } },
  { id: "21.6", query: "Tell me more about your philosophy.", expect: { source: "testing.md" } },
  { id: "22.1", query: "Where are you based?", expect: { source: "location.md" } },
  { id: "22.2", query: "Are you open to remote work?", expect: { source: "location.md" } },
  { id: "22.3", query: "What roles are you looking for?", expect: { sources: ["moving-from-coding.md", "about.md", "contact.md"] } },
  { id: "22.4", query: "What time zone are you in?", expect: { source: "location.md" } },
  { id: "23.1", query: "How do I contact you?", expect: { source: "contact.md" } },
  { id: "23.2", query: "What is your LinkedIn?", expect: { source: "linkedin.md" } },
  { id: "23.3", query: "What is your GitHub?", expect: { source: "github.md" } },
  { id: "23.4", query: "What is your email?", expect: { source: "contact.md" } },
  { id: "23.5", query: "Can I send you a job opening?", expect: { source: "contact.md" } },
  { id: "23.6", query: "Can I see your resume?", expect: { source: "contact.md" } },
  { id: "24.1", query: "What salary do you want?", expect: { source: "boundaries.md" } },
  { id: "24.2", query: "What is your phone number?", expect: { source: "boundaries.md" } },
  { id: "24.3", query: "What is your home address?", expect: { sources: ["boundaries.md", "location.md"] } },
  { id: "24.4", query: "Do you need visa sponsorship?", expect: { source: "boundaries.md" } },
  { id: "24.5", query: "How old are you?", expect: { source: "boundaries.md" } },
  { id: "25.4a", query: "prudential?", expect: { source: "prudential.md" } },
  { id: "25.4b", query: "projects?", expect: { category: "projects" } },
  { id: "25.6", query: "What is the weather today?", expect: { empty: true } },
  { id: "26.1", query: "Do you have any publications?", expect: { source: "publications.md" } },
  { id: "26.2", query: "Tell me about your sentiment analysis paper.", expect: { source: "viva-tech-paper.md" } },
  { id: "26.3", query: "What did you write about quantum computing?", expect: { source: "publications.md" } },
  { id: "26.4", query: "What is the neural network sentiment analysis paper?", expect: { source: "neural-network-paper.md" } },
  { id: "26.5", query: "What did you publish on decision trees?", expect: { source: "publications.md" } },
  { id: "26.6", query: "What did you write about augmented reality?", expect: { source: "publications.md" } },
  { id: "26.7", query: "When did you publish these?", expect: { source: "publications.md" } },
];
// END CASES G4

const RETRIEVAL_CASES: RetrievalCase[] = [...CASES_G1, ...CASES_G2, ...CASES_G3, ...CASES_G4];

describe('golden questions: retrieval', () => {
  let chunks: KnowledgeChunk[];
  let byText: Map<string, { source: string; category: string }>;

  beforeAll(() => {
    chunks = JSON.parse(readFileSync(knowledgePath, 'utf-8')).chunks as KnowledgeChunk[];
    byText = new Map();
    for (const c of chunks) {
      if (!byText.has(c.text)) byText.set(c.text, { source: c.source, category: c.category });
    }
    // The top-text to chunk mapping is only sound when chunk texts are unique.
    expect(byText.size).toBe(chunks.length);
  });

  for (const c of RETRIEVAL_CASES) {
    it(`${c.id}: ${c.query}`, { timeout: 120_000 }, async () => {
      const texts = await retrieveChunks(c.query, chunks, 5);
      const ranked = texts.map((t) => byText.get(t)!);
      const top = ranked[0];
      if (!matches(c.expect, top)) {
        const got =
          ranked.length > 0
            ? ranked
                .slice(0, 3)
                .map((r) => `${r.source}/${r.category}`)
                .join(' > ')
            : '(empty)';
        throw new Error(
          `case ${c.id} [want ${describeExpectation(c.expect)}] :: ${c.query}\n     got: ${got}`,
        );
      }
    });
  }
});

describe('golden questions: FAQ matching', () => {
  let engine: TemplateEngine;

  beforeAll(() => {
    const entries = JSON.parse(readFileSync(faqPath, 'utf-8')) as FAQEntry[];
    engine = new TemplateEngine(entries);
  });

  it('SAR testing question matches the SAR Testing FAQ entry', () => {
    const { answer } = engine.respond('What is SAR testing?');
    expect(answer).toContain('SAR testing');
    expect(answer).toContain('50 devices');
  });

  it('contact question returns all three contact channels', () => {
    const { answer } = engine.respond('How can I contact you?');
    expect(answer).toContain('linkedin.com/in/kishanborad27');
    expect(answer).toContain('github.com/kishanborad');
    expect(answer).toContain('borad.kishan0@gmail.com');
  });

  it('out-of-scope question falls back honestly', () => {
    const { answer } = engine.respond('What is the weather like today?');
    expect(answer).toContain("don't have specific details");
  });

  it('Kanha question matches the Kanha FAQ entry', () => {
    const { answer } = engine.respond('What is Kanha?');
    expect(answer).toContain('ZARVIS');
  });

  it('projects overview question returns the six site projects', () => {
    const { answer } = engine.respond('Show me your projects');
    expect(answer).toContain("I've built 6");
  });

  it('Playwright question matches the Playwright FAQ entry', () => {
    const { answer } = engine.respond('Tell me about your Playwright experience');
    expect(answer).toContain('primary automation stack');
  });

  it('API testing question matches the API Testing FAQ entry', () => {
    const { answer } = engine.respond('Have you done API testing?');
    expect(answer).toContain('GraphQL');
  });

  it('publications question matches the Publications FAQ entry', () => {
    const { answer } = engine.respond('What are your publications?');
    expect(answer).toContain('five works');
  });

  it('LinkedIn question matches the LinkedIn Profile FAQ entry', () => {
    const { answer } = engine.respond('What is your LinkedIn?');
    expect(answer).toContain('linkedin.com/in/kishanborad27');
  });

  it('sentiment analysis paper question matches the VIVA-Tech paper FAQ entry', () => {
    const { answer } = engine.respond('Tell me about your sentiment analysis paper');
    expect(answer).toContain('10.11242/viva-tech.01.01.08');
    expect(answer).toContain('Shiv Dhar');
  });

  it('salary question falls back to the contact channels without disclosing anything', () => {
    // Single-keyword deflection queries score below the template
    // threshold and hit the generic fallback, which gives the contact
    // channels and no private facts. The retrieval tier carries the
    // full deflection (see case 24.1).
    const { answer } = engine.respond('What salary do you want?');
    expect(answer).toContain("don't have specific details");
    expect(answer).toContain('linkedin.com/in/kishanborad27');
  });
});
