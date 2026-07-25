import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, SuggestionChip, TierState } from '../types';
import { MessageBubble } from './MessageBubble';
import type { Orchestrator } from '../ai/orchestrator';

interface ChatPanelProps {
  orchestrator: Orchestrator;
  tierState: TierState;
}

const GREETING = "Hey! I'm Kishan's AI assistant, running entirely in your browser — no data leaves this page. I can tell you about my experience, projects, technical skills, or engineering philosophy. What are you curious about?";

const STARTER_CHIPS: SuggestionChip[] = [
  { label: 'Tell me about your experience', query: 'Tell me about your experience' },
  { label: 'Show me your projects', query: 'Show me your projects' },
  { label: "What's your tech stack?", query: "What's your tech stack?" },
];

export function ChatPanel({ orchestrator, tierState }: ChatPanelProps) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

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

    let botContent = '';

    for await (const chunk of orchestrator.send(query)) {
      if (chunk.type === 'token') {
        botContent += chunk.content;
      } else if (chunk.type === 'done') {
        botContent = chunk.content;
        if (chunk.suggestions.length > 0) {
          setSuggestions(chunk.suggestions);
        }
      }
    }

    const botMessage: Message = {
      id: `bot-${Date.now()}`,
      role: 'bot',
      content: botContent,
      tier: tierState.current,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, botMessage]);
    setIsTyping(false);
    inputRef.current?.focus();
  }, [orchestrator, tierState, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.08] flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg gradient-accent-light flex items-center justify-center text-xs font-bold shadow-glow">
          AI
        </div>
        <div>
          <div className="text-sm font-semibold">Kishan's Assistant</div>
          <div className="text-[10px] text-dimmed">Powered by Phi-3 · In-browser</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-5 py-5 overflow-y-auto flex flex-col gap-4">
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

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 max-w-[85%] opacity-60">
            <div className="w-7 h-7 rounded-full gradient-accent-light flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
              KB
            </div>
            <div className="glass-surface rounded-tl-[4px] rounded-tr-xl rounded-br-xl rounded-bl-xl px-5 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'typing-dot 1.4s 0s infinite' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'typing-dot 1.4s 0.2s infinite' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: 'typing-dot 1.4s 0.4s infinite' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-5 py-3 border-t border-white/[0.08] bg-navy-deep/50">
        <div className="flex gap-3 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about Kishan..."
            className="flex-1 bg-[rgba(20,20,30,0.8)] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#f4f4f6] placeholder:text-dimmed focus:outline-none focus:ring-2 focus:ring-accent/30 focus:shadow-glow transition-all duration-200"
            disabled={isTyping}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-[10px] gradient-accent flex items-center justify-center shadow-glow hover:shadow-glow-strong hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
