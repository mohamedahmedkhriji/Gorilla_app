import React from 'react';
import { Button } from '../ui/Button';
// import { Zap } from 'lucide-react' // Removed unused import
interface WelcomeScreenProps {
  onNext: () => void;
}
export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-12">
      {/* Updated Logo Container */}
      <div className="relative w-48 h-48 mb-6 group">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl group-hover:bg-accent/30 transition-all duration-500" />

        <div className="relative w-full h-full rounded-3xl bg-black border border-accent/20 shadow-glow overflow-hidden flex items-center justify-center p-1">
          {/*
            Image Processing Strategy:
            1. grayscale: removes original colors
            2. contrast/brightness: cleans up the blacks and whites
            3. mix-blend-screen: makes black transparent (if on black bg) or just shows white
            4. Overlay div with 'mix-blend-color' or 'multiply' to tint the white parts lime
            */}
          <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
            <img
              src="/81b2a047390dbe58313e9a4a6f9aa84d.jpg"
              alt="Gorilla Logo"
              className="w-full h-full object-cover"
              style={{
                filter: 'grayscale(100%) contrast(120%)'
              }} />

            {/* This overlay tints the white parts of the image to the accent color */}
            <div className="absolute inset-0 bg-accent mix-blend-multiply" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
          GORILLA
        </h1>
        <h2 className="text-xl font-medium text-white tracking-wide">
          Train Smart. Train Strong.
        </h2>
        <p className="text-text-secondary text-base max-w-xs mx-auto leading-relaxed">
          Your AI gym trainer wherever you go. <br />
          Build muscle, recover faster.
        </p>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext} className="w-full">
        Get Started
      </Button>
    </div>);

}