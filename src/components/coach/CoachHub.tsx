import React, { useState } from 'react';
import { CoachListScreen } from './CoachListScreen';
import { CoachChatScreen } from './CoachChatScreen';

type Screen = 'list' | 'chat';

export const CoachHub: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedCoach, setSelectedCoach] = useState<any>(null);

  const handleSelectCoach = (coach: any) => {
    setSelectedCoach(coach);
    setScreen('chat');
  };

  const handleBack = () => {
    if (screen === 'chat') {
      setScreen('list');
      setSelectedCoach(null);
    }
  };

  if (screen === 'chat' && selectedCoach) {
    return <CoachChatScreen coach={selectedCoach} onBack={handleBack} />;
  }

  return <CoachListScreen onBack={handleBack} onSelectCoach={handleSelectCoach} />;
};
