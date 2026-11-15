import { useEffect, useRef, useState } from 'react';
import type { TierState } from '../types';
import { Avatar, type AvatarState } from '../chat/Avatar';
import { exportQuestionLog, getQuestionLog } from '../ai/questionLog';

interface SidebarProps {
  tierState: TierState;
  isBusy: boolean;
  onCategoryClick: (query: string) => void;
}

const CATEGORIES = [
  { emoji: '🏢', label: 'Experience', query: 'Tell me about your experience' },
  { emoji: '🚀', label: 'Projects', query: 'Show me your projects' },
  { emoji: '💡', label: 'Philosophy', query: 'What is your testing philosophy?' },
  { emoji: '👤', label: 'About Me', query: 'Tell me about yourself' },
];

function StatusBadge({ tierState }: { tierState: TierState }) {
  const isLoading = tierState.status === 'loading';
  const isReady = tierState.status === 'ready' && tierState.current !== 'template';

  return (
    <div
      className={`rounded-lg px-3 py-2 text-center text-[11px] border transition-all duration-500 ${
        isReady
          ? 'bg-status/15 border-status/30 shadow-glow'
          : isLoading
            ? 'bg-accent/15 border-accent/30'
            : 'bg-chip border-line'
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
          isReady ? 'bg-status' : isLoading ? 'bg-accent animate-pulse' : 'bg-dimmed'
        }`}
      />
      <span className={isReady ? 'text-status' : isLoading ? 'text-accent' : 'text-muted'}>
        {tierState.label}
      </span>
    </div>
  );
}

export function Sidebar({ tierState, isBusy, onCategoryClick }: SidebarProps) {
  const [greeted, setGreeted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const wasBusyRef = useRef(false);
  const speakTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (isBusy) {
      setGreeted(true);
      setSpeaking(false);
      wasBusyRef.current = true;
      return;
    }
    if (wasBusyRef.current) {
      wasBusyRef.current = false;
      setSpeaking(true);
      speakTimerRef.current = window.setTimeout(() => setSpeaking(false), 3500);
    }
    return () => window.clearTimeout(speakTimerRef.current);
  }, [isBusy]);

  const avatarState: AvatarState = isBusy
    ? 'thinking'
    : speaking
      ? 'speaking'
      : greeted
        ? 'idle'
        : 'greeting';

  const [logCount, setLogCount] = useState(0);
  useEffect(() => {
    if (!isBusy) {
      setLogCount(getQuestionLog().length);
    }
  }, [isBusy]);

  const downloadLog = () => {
    const blob = new Blob([exportQuestionLog()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'kishan-assistant-question-log.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-[260px] border-r border-line flex flex-col p-5 bg-navy-deep/90 flex-shrink-0 hidden md:flex">
      {/* Avatar + Name */}
      <div className="text-center mb-5">
        <Avatar state={avatarState} sizeClass="mx-auto mb-3 h-16 w-16" onGreetingDone={() => setGreeted(true)} />
        <div className="text-[15px] font-semibold">Kishan Borad</div>
        <div className="text-[11px] text-muted mt-0.5">Associate Product Owner & Scrum Master</div>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <StatusBadge tierState={tierState} />
      </div>

      {/* Category Chips */}
      <div className="text-[10px] uppercase tracking-widest text-dimmed mb-2">Explore</div>
      <div className="flex flex-col gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => onCategoryClick(cat.query)}
            className="px-3 py-2 rounded-lg text-left text-xs glass-surface-hover cursor-pointer"
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Contact */}
      <div className="text-[10px] uppercase tracking-widest text-dimmed mb-2 mt-5">Contact</div>
      <div className="flex flex-col gap-1.5">
        <a
          href="https://linkedin.com/in/kishanborad27"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded-lg text-left text-xs glass-surface-hover cursor-pointer"
        >
          💼 LinkedIn
        </a>
        <a
          href="https://github.com/kishanborad"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded-lg text-left text-xs glass-surface-hover cursor-pointer"
        >
          💻 GitHub
        </a>
        <a
          href="mailto:borad.kishan0@gmail.com"
          className="px-3 py-2 rounded-lg text-left text-xs glass-surface-hover cursor-pointer"
        >
          ✉️ Email
        </a>
      </div>

      {/* Question log */}
      <div className="text-[10px] uppercase tracking-widest text-dimmed mb-2 mt-5">Question log</div>
      <button
        type="button"
        onClick={downloadLog}
        disabled={logCount === 0}
        className="px-3 py-2 rounded-lg text-left text-xs glass-surface-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ⬇️ Download log ({logCount})
      </button>
      <div className="text-[10px] text-dimmed leading-relaxed mt-1.5 px-1">
        Questions stay in this browser. The download helps Kishan teach the assistant new phrasings.
      </div>

      {/* Privacy Note */}
      <div className="mt-auto pt-4">
        <div className="p-3 rounded-lg bg-chip border border-line text-[10px] text-dimmed leading-relaxed">
          🔒 Your questions and answers stay in your browser. Model weights and fonts are downloaded from content delivery networks.
        </div>
      </div>
    </aside>
  );
}
