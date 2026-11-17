import { useEffect, useState, useCallback, useRef } from 'react';
import type { TierState } from './types';
import { Orchestrator } from './ai/orchestrator';
import { ChatPanel } from './chat/ChatPanel';
import { Sidebar } from './sidebar/Sidebar';

const orchestrator = new Orchestrator();

/**
 * Embed mode (?embed=1) renders the chat alone, without the sidebar
 * or headers: the portfolio widget shell provides the panel frame,
 * header, and close controls around the iframe.
 */
function isEmbedMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [tierState, setTierState] = useState<TierState>(orchestrator.getTierState());
  const [assistantBusy, setAssistantBusy] = useState(false);
  const chatPanelRef = useRef<{ sendMessage: (query: string) => void }>(null);

  useEffect(() => {
    const unsubscribe = orchestrator.onTierChange(setTierState);
    orchestrator.init();
    return unsubscribe;
  }, []);

  const handleCategoryClick = useCallback((query: string) => {
    chatPanelRef.current?.sendMessage(query);
  }, []);

  const embed = isEmbedMode();

  if (embed) {
    return (
      <div className="flex flex-col h-screen bg-navy font-poppins">
        <ChatPanel ref={chatPanelRef} orchestrator={orchestrator} tierState={tierState} onBusyChange={setAssistantBusy} embed />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-navy font-poppins">
      <div className="flex flex-1 min-h-0">
        <Sidebar tierState={tierState} isBusy={assistantBusy} onCategoryClick={handleCategoryClick} />
        <ChatPanel ref={chatPanelRef} orchestrator={orchestrator} tierState={tierState} onBusyChange={setAssistantBusy} />
      </div>
    </div>
  );
}
