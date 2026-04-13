import React from 'react';
import { Card } from '../ui/Card';
import {
  emojiBooksBg,
  emojiBooks,
  emojiExercises,
  emojiExercisesBg,
  emojiRightArrow,
} from '../../services/emojiTheme';
import { getActiveLanguage, getStoredLanguage, pickLanguage } from '../../services/language';

interface EducationSectionProps {
  onExercises: () => void;
  onBooks: () => void;
  exercisesCoachmarkTargetId?: string;
  booksCoachmarkTargetId?: string;
}

export function EducationSection({
  onExercises,
  onBooks,
  exercisesCoachmarkTargetId,
  booksCoachmarkTargetId,
}: EducationSectionProps) {
  const language = getActiveLanguage(getStoredLanguage());
  const copy = pickLanguage(language, {
    en: {
      learningHub: 'Learning Hub',
      exercises: 'Library',
      browse: 'Browse',
      books: 'Plan',
      comingSoon: 'Coming Soon',
    },
    ar: {
      learningHub: 'مركز التعلّم',
      exercises: 'التمارين',
      browse: 'استعراض',
      books: 'الكتب',
      comingSoon: 'قريبًا',
    },
    it: {
      learningHub: 'Centro Formazione',
      exercises: 'Libreria',
      browse: 'Esplora',
      books: 'Piano',
      comingSoon: 'In arrivo',
    },
    de: {
      learningHub: 'Lernzentrum',
      exercises: 'Bibliothek',
      browse: 'Ansehen',
      books: 'Plan',
      comingSoon: 'Demnachst',
    },
    fr: {
      learningHub: 'Centre d apprentissage',
      exercises: 'Bibliotheque',
      browse: 'Explorer',
      books: 'Plan',
      comingSoon: 'Bientot disponible',
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 px-1">
        <h3 className="text-base font-electrolize font-bold uppercase tracking-[0.12em] text-text-primary">
          {copy.learningHub}
        </h3>
        <div className="mb-[0.18rem] h-px flex-1 bg-gradient-to-r from-white/20 via-white/10 to-transparent" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card
          onClick={onExercises}
          whileHover={{ y: -4 }}
          coachmarkTargetId={exercisesCoachmarkTargetId}
          className="p-4 relative overflow-hidden cursor-pointer border border-white/15 shadow-card transition-all duration-300 hover:border-info/35 hover:shadow-[0_12px_32px_rgba(0,0,0,0.45),0_0_14px_rgba(191,255,0,0.05)] group"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${emojiExercisesBg})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-info/15 border border-info/35 flex items-center justify-center text-info mb-3">
              <img src={emojiExercises} alt={copy.exercises} className="h-7 w-7 object-contain" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="truncate text-[1.9rem] font-electrolize font-bold leading-none text-text-primary">{copy.exercises}</h4>
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

        <Card
          onClick={onBooks}
          whileHover={{ y: -4 }}
          coachmarkTargetId={booksCoachmarkTargetId}
          className="p-4 relative overflow-hidden cursor-pointer border border-white/15 shadow-card transition-all duration-300 hover:border-accent/35 hover:shadow-[0_12px_32px_rgba(0,0,0,0.45),0_0_14px_rgba(191,255,0,0.07)] group"
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${emojiBooksBg})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/65 via-background/45 to-background/25"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent)] pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/35 flex items-center justify-center text-accent mb-3">
              <img src={emojiBooks} alt={copy.books} className="h-7 w-7 object-contain" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="truncate text-[1.9rem] font-electrolize font-bold leading-none text-text-primary">{copy.books}</h4>
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
      </div>
    </div>
  );
}
