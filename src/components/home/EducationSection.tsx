import React from 'react';
import { Card } from '../ui/Card';
import {
  emojiBooksBg,
  emojiComingSoon,
  emojiExercises,
  emojiExercisesBg,
  emojiRightArrow,
} from '../../services/emojiTheme';
import { getActiveLanguage, getStoredLanguage } from '../../services/language';

interface EducationSectionProps {
  onExercises: () => void;
  onBooks: () => void;
}

export function EducationSection({ onExercises, onBooks }: EducationSectionProps) {
  const isArabic = getActiveLanguage(getStoredLanguage()) === 'ar';
  const copy = {
    learningHub: isArabic ? 'مركز التعلّم' : 'Learning Hub',
    exercises: isArabic ? 'التمارين' : 'Exercises',
    browse: isArabic ? 'استعراض' : 'Browse',
    books: isArabic ? 'الكتب' : 'Books',
    comingSoon: isArabic ? 'قريبًا' : 'Coming Soon',
  };
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.15em] px-1">{copy.learningHub}</h3>

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
              <img src={emojiExercises} alt={copy.exercises} className="h-7 w-7 object-contain" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xl leading-none text-white mb-1">{copy.exercises}</div>
                <div className="text-[11px] text-text-secondary uppercase tracking-[0.09em]">
                  {copy.browse}
                </div>
              </div>
              <img
                src={emojiRightArrow}
                alt=""
                aria-hidden="true"
                className="mb-1 h-[18px] w-[18px] shrink-0 object-contain opacity-70"
              />
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
              <img src={emojiComingSoon} alt={copy.comingSoon} className="h-7 w-7 object-contain" />
            </div>
            <div className="text-xl leading-none text-white mb-1">{copy.books}</div>
            <div className="text-[11px] text-text-secondary uppercase tracking-[0.09em]">
              {copy.comingSoon}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
