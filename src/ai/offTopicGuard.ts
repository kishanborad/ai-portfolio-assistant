// Questions about anything other than Kishan, his portfolio, and his
// playgrounds must reach the generic fallback instead of the model.
// The score floor alone cannot separate the two ("What does Muse do?"
// scores 0.258, above the 0.15 floor), so this guard covers the clear
// cases deterministically. It never fires on portfolio questions.

const PORTFOLIO_ANCHORS = [
  'kishan', 'borad', 'portfolio', 'playwright', 'selenium', 'cypress', 'python', 'sql', 'typescript', 'javascript',
  'react', 'aws', 'docker', 'jira', 'jenkins', 'prudential', 'ischoolconnect', 'quantiphi', 'workbench', 'playground',
  'assistant', 'experience', 'resume', 'career', 'project', 'skill', 'testing', 'scrum', 'qa', 'github', 'linkedin',
  'contact', 'education', 'publication', 'paper', 'postman', 'jmeter', 'test generator', 'regression lab',
  'event stream', 'ul solutions', 'product owner',
];

const WEATHER_WORDS = ['weather', 'forecast'];
const CREATIVE_WORDS = ['joke', 'poem', 'poetry', 'story', 'riddle', 'song', 'limerick', 'haiku'];
const OTHER_PRODUCTS = ['muse', 'chatgpt', 'claude', 'gemini', 'copilot', 'perplexity', 'grok', 'llama', 'mistral'];
const ABOUT_QUESTION_WORDS = ['what', 'who', 'how', 'why', 'when', 'where', 'tell', 'explain', 'describe'];

const tokens = (query: string): string[] => query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function hasAnchor(query: string, queryTokens: string[]): boolean {
  const lower = query.toLowerCase();
  return PORTFOLIO_ANCHORS.some((anchor) =>
    anchor.includes(' ') ? lower.includes(anchor) : queryTokens.includes(anchor),
  );
}

export function isOffTopic(query: string): boolean {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return false;
  if (hasAnchor(query, queryTokens)) return false;
  if (WEATHER_WORDS.some((w) => queryTokens.includes(w))) return true;
  if (CREATIVE_WORDS.some((w) => queryTokens.includes(w))) return true;
  const namesProduct = OTHER_PRODUCTS.some((p) => queryTokens.includes(p));
  const asksAboutIt = ABOUT_QUESTION_WORDS.some((w) => queryTokens.includes(w));
  return namesProduct && asksAboutIt;
}
