import React from 'react';
import { Card } from '../ui/Card';
import {
  emojiBooksBg,
  emojiBooks,
  emojiExercises,
  emojiExercisesBg,
  emojiRightArrow,
} from '../../services/emojiTheme';
import { pickLanguage } from '../../services/language';
import { useAppLanguage } from '../../hooks/useAppLanguage';
import { HOME_CARD_HOVER_CLASS, HOME_CARD_OVERLAY_CLASS, HOME_CARD_TITLE_CLASS } from './homeCardStyles';

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
  const { language } = useAppLanguage();
  const copy = pickLanguage(language, {
    en: {
      learningHub: 'Learning Hub',
      exercises: 'Library',
      books: 'Plan',
    },
    ar: {
      learningHub: 'مركز التعلّم',
      exercises: 'التمارين',
      books: 'الكتب',
    },
    it: {
      learningHub: 'Centro Formazione',
      exercises: 'Libreria',
      books: 'Piano',
    },
    de: {
      learningHub: 'Lernzentrum',
      exercises: 'Bibliothek',
      books: 'Plan',
    },
    fr: {
      learningHub: 'Centre d apprentissage',
      exercises: 'Bibliotheque',
      books: 'Plan',
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 px-1">
        <h3 className="text-base font-electrolize font-bold uppercase tracking-[0.12em] text-text-primary">
          {copy.learningHub}
        </h3>
        <div
          className="mb-[0.18rem] h-px flex-1 bg-gradient-to-r from-white/20 via-white/10 to-transparent"
          aria-hidden="true"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card
          onClick={onExercises}
          whileHover={{ y: -2 }}
          coachmarkTargetId={exercisesCoachmarkTargetId}
          className={`group relative overflow-hidden border border-white/15 p-4 shadow-card ${HOME_CARD_HOVER_CLASS} cursor-pointer hover:border-info/35`}
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${emojiExercisesBg})` }}
            aria-hidden="true"
          />
          <div
            className={HOME_CARD_OVERLAY_CLASS}
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-info/35 bg-info/15 text-info">
              <img src={emojiExercises} alt={copy.exercises} className="h-7 w-7 object-contain" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h4 className={HOME_CARD_TITLE_CLASS}>{copy.exercises}</h4>
              </div>
              <img
                src={emojiRightArrow}
                alt=""
                aria-hidden="true"
                className="mb-0.5 h-[18px] w-[18px] shrink-0 object-contain opacity-70 transition-opacity group-hover:opacity-100"
              />
            </div>
          </div>
        </Card>

        <Card
          onClick={onBooks}
          whileHover={{ y: -2 }}
          coachmarkTargetId={booksCoachmarkTargetId}
          className={`group relative overflow-hidden border border-white/15 p-4 shadow-card ${HOME_CARD_HOVER_CLASS} cursor-pointer hover:border-accent/35`}
        >
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${emojiBooksBg})` }}
            aria-hidden="true"
          />
          <div
            className={HOME_CARD_OVERLAY_CLASS}
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
              <img src={emojiBooks} alt={copy.books} className="h-7 w-7 object-contain" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h4 className={HOME_CARD_TITLE_CLASS}>{copy.books}</h4>
              </div>
              <img
                src={emojiRightArrow}
                alt=""
                aria-hidden="true"
                className="mb-0.5 h-[18px] w-[18px] shrink-0 object-contain opacity-70 transition-opacity group-hover:opacity-100"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
