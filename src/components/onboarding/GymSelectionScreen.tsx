import React from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, MapPin, AlertCircle } from 'lucide-react';
interface GymSelectionScreenProps {
  onNext: () => void;
}
export function GymSelectionScreen({ onNext }: GymSelectionScreenProps) {
  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">Select Your Gym</h2>
        <p className="text-text-secondary">
          Find your primary training location.
        </p>
      </div>

      <div className="relative">
        <Input placeholder="Search gyms nearby..." className="pl-10" />
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
          size={20} />

      </div>

      <div className="space-y-3">
        <div className="p-4 bg-card rounded-xl border border-accent/20 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
            <MapPin size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white">Iron Paradise Gym</h3>
            <p className="text-xs text-text-secondary">0.8 miles away</p>
          </div>
          <span className="px-2 py-1 bg-accent/10 text-accent text-[10px] uppercase font-bold rounded">
            Partner
          </span>
        </div>

        <div className="p-4 bg-card rounded-xl border border-white/5 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-tertiary shrink-0">
            <MapPin size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white">Metro Fitness</h3>
            <p className="text-xs text-text-secondary">1.2 miles away</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3">
        <AlertCircle className="text-yellow-500 shrink-0" size={20} />
        <p className="text-xs text-yellow-200/80 leading-relaxed">
          This app is designed for gym training only. Home workouts are not
          currently supported.
        </p>
      </div>

      <div className="flex-1" />

      <Button onClick={onNext}>Confirm Gym</Button>
    </div>);

}