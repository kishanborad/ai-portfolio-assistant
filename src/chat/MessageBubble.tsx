import type { Message } from '../types';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: Message;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const time = formatTime(message.timestamp);

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="gradient-accent rounded-xl rounded-br-[4px] px-4 py-3 max-w-[70%] text-sm leading-relaxed text-on-accent">
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
        <div className="bg-chip border border-line rounded-xl rounded-tl-[4px] px-4 py-3 text-sm leading-relaxed">
          {message.content}
        </div>
        <span className="text-[10px] text-dimmed">{time}</span>
      </div>
    </div>
  );
}
