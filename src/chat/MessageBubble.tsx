import type { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="gradient-accent rounded-xl rounded-br-[4px] px-4 py-3 max-w-[70%] text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-[85%]">
      <div className="w-7 h-7 rounded-full gradient-accent-light flex-shrink-0 flex items-center justify-center text-[10px] font-bold shadow-glow">
        KB
      </div>
      <div className="glass-surface border-l-[3px] border-l-accent rounded-tl-[4px] rounded-tr-xl rounded-br-xl rounded-bl-xl px-4 py-3 text-sm leading-relaxed">
        {message.content}
      </div>
    </div>
  );
}
