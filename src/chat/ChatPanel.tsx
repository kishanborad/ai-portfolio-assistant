import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { Message, ResponseMeta, SuggestionChip, TierState } from '../types';
import { MessageBubble } from './MessageBubble';
import { Avatar } from './Avatar';
import type { Orchestrator } from '../ai/orchestrator';
import { logQuestionToServer } from '../ai/serverLog';

interface ChatPanelProps {
  orchestrator: Orchestrator;
  tierState: TierState;
  onBusyChange?: (busy: boolean) => void;
  embed?: boolean;
}

const GREETING = "Hey, welcome. I'm Kishan's assistant, happy to chat about his work, his projects, and how he thinks about quality and delivery. Questions are logged anonymously to improve answers. What are you curious about?";

const STARTER_CHIPS: SuggestionChip[] = [
  { label: 'Tell me about your experience', query: 'Tell me about your experience' },
  { label: 'Show me your projects', query: 'Show me your projects' },
  { label: "What's your tech stack?", query: "What's your tech stack?" },
];

type Theme = 'day' | 'night';

const THEME_STORAGE_KEY = 'assistant-theme';

function readInitialTheme(): Theme {
  if (typeof document !== 'undefined') {
    const applied = document.documentElement.getAttribute('data-theme');
    if (applied === 'day' || applied === 'night') return applied;
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'night';
  }
  return 'day';
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const night = theme === 'night';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={night ? 'Switch to day mode' : 'Switch to night mode'}
      title={night ? 'Switch to day mode' : 'Switch to night mode'}
      className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:text-ink"
    >
      {night ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export const ChatPanel = forwardRef<{ sendMessage: (query: string) => void }, ChatPanelProps>(
  function ChatPanel({ orchestrator, tierState, onBusyChange, embed = false }, ref) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'bot',
      content: GREETING,
      tier: 'template',
      timestamp: Date.now(),
    },
  ]);
  const [suggestions, setSuggestions] = useState<SuggestionChip[]>(STARTER_CHIPS);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);
  const answerTimerRef = useRef<number | undefined>(undefined);
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [themeChosen, setThemeChosen] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Until the visitor picks a theme, follow the system preference live.
  useEffect(() => {
    if (themeChosen) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setTheme(event.matches ? 'night' : 'day');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [themeChosen]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'night' ? 'day' : 'night';
    setTheme(next);
    setThemeChosen(true);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage unavailable: the choice still applies for this visit
    }
  }, [theme]);

  const scrollToBottom = useCallback(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    onBusyChange?.(isTyping);
  }, [isTyping, onBusyChange]);

  useEffect(() => () => window.clearTimeout(answerTimerRef.current), []);

  const avatarState = isTyping ? 'thinking' : justAnswered ? 'speaking' : 'idle';

  const handleSend = useCallback(async (query: string) => {
    if (!query.trim() || isTyping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      tier: tierState.current,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSuggestions([]);
    setIsTyping(true);
    setIsStreaming(false);

    // The bot message appears with the first streamed token and grows
    // as tokens arrive, so the first words show in split seconds.
    // Whole-answer engines (template, WASM) still append once, at done.
    const botMessage: Message = {
      id: `bot-${Date.now()}`,
      role: 'bot',
      content: '',
      tier: tierState.current,
      timestamp: Date.now(),
    };
    let botContent = '';
    let started = false;
    let firstTokenMs: number | null = null;
    let meta: ResponseMeta | undefined;
    const startedAt = Date.now();

    // Fast path: a matched template answer is already complete, so
    // answer it synchronously instead of pushing it through the
    // streaming generator. The logged duration covers the match only.
    const fast = orchestrator.tryTemplate(query);
    if (fast !== null) {
      if (fast.suggestions.length > 0) {
        setSuggestions(fast.suggestions);
      }
      void logQuestionToServer({
        question: query.trim(),
        tier: tierState.current,
        route: 'template',
        templateScore: fast.score,
        fallback: false,
        durationMs: Date.now() - startedAt,
        firstTokenMs: null,
      });
      setMessages((prev) => [...prev, { ...botMessage, content: fast.answer }]);
      setIsTyping(false);
      setIsStreaming(false);
      setJustAnswered(true);
      window.clearTimeout(answerTimerRef.current);
      answerTimerRef.current = window.setTimeout(() => setJustAnswered(false), 3500);
      inputRef.current?.focus();
      return;
    }

    for await (const chunk of orchestrator.send(query)) {
      if (chunk.type === 'token') {
        if (firstTokenMs === null) {
          firstTokenMs = Date.now() - startedAt;
        }
        botContent += chunk.content;
        if (!started) {
          started = true;
          setIsStreaming(true);
          setMessages((prev) => [...prev, { ...botMessage, content: botContent }]);
        } else {
          setMessages((prev) => prev.map((m) => (m.id === botMessage.id ? { ...m, content: botContent } : m)));
        }
      } else if (chunk.type === 'done') {
        botContent = chunk.content;
        meta = chunk.meta;
        if (chunk.suggestions.length > 0) {
          setSuggestions(chunk.suggestions);
        }
      }
    }

    // Record the question and how it was answered, server-side only,
    // so missed questions can be turned into keyword mappings later.
    void logQuestionToServer({
      question: query.trim(),
      tier: meta?.tier ?? tierState.current,
      route: meta?.route ?? 'template',
      templateScore: meta?.templateScore ?? null,
      fallback: meta?.fallback ?? false,
      durationMs: Date.now() - startedAt,
      firstTokenMs,
    });

    if (!started) {
      setMessages((prev) => [...prev, { ...botMessage, content: botContent }]);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === botMessage.id ? { ...m, content: botContent } : m)));
    }
    setIsTyping(false);
    setIsStreaming(false);
    setJustAnswered(true);
    window.clearTimeout(answerTimerRef.current);
    answerTimerRef.current = window.setTimeout(() => setJustAnswered(false), 3500);
    inputRef.current?.focus();
  }, [orchestrator, tierState, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  useImperativeHandle(ref, () => ({
    sendMessage: (query: string) => handleSend(query),
  }), [handleSend]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Mobile top bar - small screens only, hidden in embed mode */}
      {!embed && (
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-line bg-navy-deep/90">
          <div className="flex items-center gap-3">
            <Avatar state={avatarState} sizeClass="h-8 w-8" />
            <div>
              <div className="text-sm font-semibold">Kishan's Assistant</div>
              <div className="text-[10px] text-accent">{tierState.label}</div>
            </div>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      )}

      {/* Header - hidden in embed mode */}
      {!embed && (
        <div className="px-5 py-3 border-b border-line flex items-center gap-3">
          <Avatar state={avatarState} sizeClass="h-7 w-7" />
          <div>
            <div className="text-sm font-semibold">Kishan's Assistant</div>
            <div className="text-[10px] text-dimmed">Powered by Phi-3 · In-browser</div>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 px-5 py-5 overflow-y-auto flex flex-col gap-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Suggestion chips after last bot message */}
        {suggestions.length > 0 && !isTyping && (
          <div className="flex gap-2 flex-wrap ml-10">
            {suggestions.map((chip) => (
              <button
                key={chip.query}
                onClick={() => handleSend(chip.query)}
                className="px-3 py-1.5 rounded-full text-[11px] text-accent border border-accent/25 bg-accent/10 hover:bg-accent/20 hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Typing indicator: only until the first streamed token lands */}
        {isTyping && !isStreaming && (
          <div className="flex gap-3 max-w-[85%] opacity-60">
            <Avatar state="thinking" sizeClass="h-7 w-7" />
            <div className="bg-chip border border-line rounded-tl-[4px] rounded-tr-xl rounded-br-xl rounded-bl-xl px-5 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'typing-dot 1.4s 0s infinite' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'typing-dot 1.4s 0.2s infinite' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'typing-dot 1.4s 0.4s infinite' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-5 py-3 border-t border-line bg-navy-deep/50">
        <div className="flex gap-3 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about his work, projects, or skills..."
            className="flex-1 bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-dimmed focus:outline-none focus:ring-2 focus:ring-accent/30 focus:shadow-glow transition-all duration-200"
            disabled={isTyping}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-[10px] gradient-accent flex items-center justify-center shadow-glow hover:shadow-glow-strong hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-on-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

