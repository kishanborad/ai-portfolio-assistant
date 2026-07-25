import { useEffect, useState, useCallback, useRef } from 'react';
import type { TierState } from './types';
import { Orchestrator } from './ai/orchestrator';
import { ChatPanel } from './chat/ChatPanel';
import { Sidebar } from './sidebar/Sidebar';

const orchestrator = new Orchestrator();

export default function App() {
  const [tierState, setTierState] = useState<TierState>(orchestrator.getTierState());
  const chatPanelRef = useRef<{ sendMessage: (query: string) => void }>(null);

  useEffect(() => {
    const unsubscribe = orchestrator.onTierChange(setTierState);
    orchestrator.init();
    return unsubscribe;
  }, []);

  const handleCategoryClick = useCallback((query: string) => {
    chatPanelRef.current?.sendMessage(query);
  }, []);

  return (
    <div className="flex h-screen bg-navy font-poppins">
      <Sidebar tierState={tierState} onCategoryClick={handleCategoryClick} />
      <ChatPanel ref={chatPanelRef} orchestrator={orchestrator} tierState={tierState} />
    </div>
  );
}
