import React from 'react';
import { Button } from '../ui/Button';

interface WelcomeScreenProps {
  onNext: () => void;
}

export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-10">
      <div className="relative w-52 h-52 mb-2 group">
        <div className="absolute inset-0 bg-accent/25 rounded-full blur-3xl group-hover:bg-accent/35 transition-all duration-500" />

        <div className="relative w-full h-full rounded-[28px] bg-black border border-accent/30 shadow-glow overflow-hidden flex items-center justify-center p-1">
          <div className="relative w-full h-full bg-black rounded-[22px] overflow-hidden">
            <img
              src="/81b2a047390dbe58313e9a4a6f9aa84d.jpg"
              alt="Gorilla Logo"
              className="w-full h-full object-cover"
              style={{
                filter: 'grayscale(100%) contrast(120%)',
              }}
            />
            <div className="absolute inset-0 bg-accent mix-blend-multiply" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="text-6xl md:text-7xl leading-[0.85] text-white">GORILLA</h1>
        <h2 className="text-sm font-semibold uppercase tracking-[0.26em] text-accent">Train Smart. Train Strong.</h2>
        <p className="text-text-secondary text-sm max-w-xs mx-auto leading-relaxed">
          Your AI gym trainer wherever you go.
          <br />
          Build muscle with clear guidance and better recovery.
        </p>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} className="w-full">
        Start Setup
      </Button>
    </div>
  );
}
