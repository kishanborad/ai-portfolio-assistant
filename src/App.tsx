import { useEffect, useState } from 'react';
import type { TierState } from './types';
import { Orchestrator } from './ai/orchestrator';
import { ChatPanel } from './chat/ChatPanel';

const orchestrator = new Orchestrator();

export default function App() {
  const [tierState, setTierState] = useState<TierState>(orchestrator.getTierState());

  useEffect(() => {
    const unsubscribe = orchestrator.onTierChange(setTierState);
    orchestrator.init();
    return unsubscribe;
  }, []);

  return (
    <div className="flex h-screen bg-navy font-poppins">
      <ChatPanel orchestrator={orchestrator} tierState={tierState} />
    </div>
  );
}
