import type { TierState } from '../types';

interface SidebarProps {
  tierState: TierState;
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
          ? 'bg-green-500/15 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
          : isLoading
            ? 'bg-accent/15 border-accent/30'
            : 'bg-white/5 border-white/10'
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
          isReady ? 'bg-green-500' : isLoading ? 'bg-accent animate-pulse' : 'bg-dimmed'
        }`}
      />
      <span className={isReady ? 'text-green-400' : isLoading ? 'text-accent' : 'text-muted'}>
        {tierState.label}
      </span>
    </div>
  );
}

export function Sidebar({ tierState, onCategoryClick }: SidebarProps) {
  return (
    <aside className="w-[260px] border-r border-white/[0.08] flex flex-col p-5 bg-navy-deep/90 flex-shrink-0 hidden md:flex">
      {/* Avatar + Name */}
      <div className="text-center mb-5">
        <div className="w-16 h-16 rounded-full gradient-accent-light mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]">
          KB
        </div>
        <div className="text-[15px] font-semibold">Kishan Borad</div>
        <div className="text-[11px] text-muted mt-0.5">QA Engineer & Developer</div>
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

      {/* Privacy Note */}
      <div className="mt-auto pt-4">
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-dimmed leading-relaxed">
          🔒 Runs entirely in your browser. No data is sent to any server.
        </div>
      </div>
    </aside>
  );
}
