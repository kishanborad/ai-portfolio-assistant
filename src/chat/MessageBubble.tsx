import type { Message } from '../types';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: Message;
  // In the embedded chat the text runs one step smaller so more of the
  // conversation fits the narrow panel.
  embed?: boolean;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function MessageBubble({ message, embed = false }: MessageBubbleProps) {
  const time = formatTime(message.timestamp);

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className={`gradient-accent rounded-xl rounded-br-[4px] px-4 py-3 max-w-[70%] ${embed ? 'text-[13px]' : 'text-sm'} leading-relaxed text-on-accent`}>
          {message.content}
        </div>
        <span className="text-[10px] text-dimmed">{time}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-[85%]">
      <Avatar sizeClass="h-7 w-7" animated={false} />
      <div className="flex flex-col gap-1 min-w-0">
        <div className={`bg-chip border border-line rounded-xl rounded-tl-[4px] px-4 py-3 ${embed ? 'text-[13px]' : 'text-sm'} leading-relaxed`}>
          {message.content}
        </div>
        <span className="text-[10px] text-dimmed">{time}</span>
      </div>
    </div>
  );
}
