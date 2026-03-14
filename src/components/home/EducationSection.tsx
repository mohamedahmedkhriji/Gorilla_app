import React from 'react';
import { Card } from '../ui/Card';
import { ChevronRight } from 'lucide-react';
import { emojiBooksBg, emojiComingSoon, emojiExercises, emojiExercisesBg } from '../../services/emojiTheme';

interface EducationSectionProps {
  onExercises: () => void;
  onBooks: () => void;
}

export function EducationSection({ onExercises, onBooks }: EducationSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.15em] px-1">Learning Hub</h3>

      <div className="grid grid-cols-2 gap-4">
        <Card onClick={onExercises} className="p-4 relative overflow-hidden cursor-pointer border border-white/15 hover:border-info/35 transition-colors group">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${emojiExercisesBg})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-info/15 border border-info/35 flex items-center justify-center text-info mb-3">
              <img src={emojiExercises} alt="Exercises" className="h-7 w-7 object-contain" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xl leading-none text-white mb-1">Exercises</div>
                <div className="text-[11px] text-text-secondary uppercase tracking-[0.09em]">
                  Browse
                </div>
              </div>
              <ChevronRight size={18} className="mb-1 shrink-0 text-text-tertiary group-hover:text-text-primary transition-colors" />
            </div>
          </div>
        </Card>

        <Card onClick={onBooks} className="p-4 relative overflow-hidden cursor-pointer border border-white/15 hover:border-accent/35 transition-colors group">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${emojiBooksBg})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent mb-3">
              <img src={emojiComingSoon} alt="Coming soon" className="h-7 w-7 object-contain" />
            </div>
            <div className="text-xl leading-none text-white mb-1">Books</div>
            <div className="text-[11px] text-text-secondary uppercase tracking-[0.09em]">
              Coming Soon
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
