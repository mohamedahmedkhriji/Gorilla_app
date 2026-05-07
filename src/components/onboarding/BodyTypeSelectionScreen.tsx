import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { getOnboardingLanguage } from './onboardingI18n';
import ectomorphMenImage from '../../../assets/body type/Ectomorphe men.png';
import ectomorphWomenImage from '../../../assets/body type/Ectomorphe women.png';
import mesomorphMenImage from '../../../assets/body type/mesomorph men.png';
import mesomorphWomenImage from '../../../assets/body type/mesomorph women.png';
import endomorphMenImage from '../../../assets/body type/endomorph men.png';
import endomorphWomenImage from '../../../assets/body type/endomorph women.png';

type BodyTypeId = 'ectomorph' | 'mesomorph' | 'endomorph';
type GenderShape = 'man' | 'woman';

interface BodyTypeSelectionScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
}

type BodyCopy = {
  title: string;
  subtitle: string;
  cta: string;
  fatRange: string;
  previous: string;
  next: string;
  types: Record<BodyTypeId, {
    name: string;
    tag: string;
    desc: string;
    tip: string;
  }>;
};

const COPY: Record<string, BodyCopy> = {
  en: {
    title: "What's your body type?",
    subtitle: 'Swipe to find the closest match',
    cta: 'Next Step',
    fatRange: 'Body fat range',
    previous: 'Previous body type',
    next: 'Next body type',
    types: {
      ectomorph: {
        name: 'Ectomorph',
        tag: 'Lean & slim build',
        desc: 'Naturally slim frame. Harder to gain muscle mass.',
        tip: 'A calorie surplus with progressive overload will help you build mass in 6-8 weeks.',
      },
      mesomorph: {
        name: 'Mesomorph',
        tag: 'Athletic & muscular',
        desc: 'Naturally muscular build. Gains muscle easily.',
        tip: 'Maintain your habits. Strength training will sharpen your definition fast.',
      },
      endomorph: {
        name: 'Endomorph',
        tag: 'Broader build',
        desc: 'Wider frame. Gains size easily, higher body fat.',
        tip: 'A moderate calorie deficit + cardio will show visible results in 8-12 weeks.',
      },
    },
  },
  ar: {
    title: '\u0645\u0627 \u0646\u0648\u0639 \u062c\u0633\u0645\u0643\u061f',
    subtitle: '\u0627\u0633\u062d\u0628 \u0644\u062a\u062c\u062f \u0623\u0642\u0631\u0628 \u062a\u0637\u0627\u0628\u0642',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    fatRange: '\u0646\u0637\u0627\u0642 \u062f\u0647\u0648\u0646 \u0627\u0644\u062c\u0633\u0645',
    previous: '\u0646\u0648\u0639 \u0627\u0644\u062c\u0633\u0645 \u0627\u0644\u0633\u0627\u0628\u0642',
    next: '\u0646\u0648\u0639 \u0627\u0644\u062c\u0633\u0645 \u0627\u0644\u062a\u0627\u0644\u064a',
    types: {
      ectomorph: {
        name: '\u0625\u0643\u062a\u0648\u0645\u0648\u0631\u0641',
        tag: '\u0646\u062d\u064a\u0641 \u0648\u0631\u0634\u064a\u0642',
        desc: '\u0628\u0646\u064a\u0629 \u0646\u062d\u064a\u0641\u0629 \u0637\u0628\u064a\u0639\u064a\u0627\u064b. \u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0623\u0635\u0639\u0628.',
        tip: '\u0641\u0627\u0626\u0636 \u0633\u0639\u0631\u0627\u062a \u0645\u0639 \u062a\u062f\u0631\u062c \u0627\u0644\u0623\u062d\u0645\u0627\u0644 \u064a\u0633\u0627\u0639\u062f\u0643 \u0639\u0644\u0649 \u0628\u0646\u0627\u0621 \u0627\u0644\u0643\u062a\u0644\u0629 \u062e\u0644\u0627\u0644 6-8 \u0623\u0633\u0627\u0628\u064a\u0639.',
      },
      mesomorph: {
        name: '\u0645\u064a\u0632\u0648\u0645\u0648\u0631\u0641',
        tag: '\u0631\u064a\u0627\u0636\u064a \u0648\u0639\u0636\u0644\u064a',
        desc: '\u0628\u0646\u064a\u0629 \u0639\u0636\u0644\u064a\u0629 \u0637\u0628\u064a\u0639\u064a\u0627\u064b. \u064a\u0643\u062a\u0633\u0628 \u0627\u0644\u0639\u0636\u0644\u0627\u062a \u0628\u0633\u0647\u0648\u0644\u0629.',
        tip: '\u062d\u0627\u0641\u0638 \u0639\u0644\u0649 \u0639\u0627\u062f\u0627\u062a\u0643. \u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u0642\u0648\u0629 \u0633\u062a\u0628\u0631\u0632 \u0627\u0644\u062a\u062d\u062f\u064a\u062f \u0628\u0633\u0631\u0639\u0629.',
      },
      endomorph: {
        name: '\u0625\u0646\u062f\u0648\u0645\u0648\u0631\u0641',
        tag: '\u0628\u0646\u064a\u0629 \u0623\u0639\u0631\u0636',
        desc: '\u0625\u0637\u0627\u0631 \u0623\u0639\u0631\u0636. \u064a\u0643\u062a\u0633\u0628 \u0627\u0644\u062d\u062c\u0645 \u0628\u0633\u0647\u0648\u0644\u0629 \u0645\u0639 \u062f\u0647\u0648\u0646 \u0623\u0639\u0644\u0649.',
        tip: '\u0639\u062c\u0632 \u0633\u0639\u0631\u0627\u062a \u0645\u0639\u062a\u062f\u0644 + \u0643\u0627\u0631\u062f\u064a\u0648 \u064a\u0638\u0647\u0631 \u0646\u062a\u0627\u0626\u062c \u0648\u0627\u0636\u062d\u0629 \u062e\u0644\u0627\u0644 8-12 \u0623\u0633\u0627\u0628\u064a\u0639.',
      },
    },
  },
  it: {
    title: 'Qual e il tuo tipo di corpo?',
    subtitle: 'Scorri per trovare quello piu simile',
    cta: 'Prossimo passo',
    fatRange: 'Range grasso corporeo',
    previous: 'Tipo di corpo precedente',
    next: 'Tipo di corpo successivo',
    types: {
      ectomorph: {
        name: 'Ectomorfo',
        tag: 'Snello e asciutto',
        desc: 'Struttura naturalmente snella. Piu difficile aumentare massa muscolare.',
        tip: 'Un surplus calorico con sovraccarico progressivo ti aiutera a costruire massa in 6-8 settimane.',
      },
      mesomorph: {
        name: 'Mesomorfo',
        tag: 'Atletico e muscoloso',
        desc: 'Struttura naturalmente muscolosa. Guadagna muscolo facilmente.',
        tip: 'Mantieni le tue abitudini. La forza migliorera presto la definizione.',
      },
      endomorph: {
        name: 'Endomorfo',
        tag: 'Struttura piu ampia',
        desc: 'Frame piu largo. Aumenta facilmente di taglia, con grasso corporeo piu alto.',
        tip: 'Un deficit moderato + cardio mostrera risultati visibili in 8-12 settimane.',
      },
    },
  },
  de: {
    title: 'Was ist dein Koerpertyp?',
    subtitle: 'Wische zum passendsten Typ',
    cta: 'Naechster Schritt',
    fatRange: 'Koerperfettbereich',
    previous: 'Vorheriger Koerpertyp',
    next: 'Naechster Koerpertyp',
    types: {
      ectomorph: {
        name: 'Ektomorph',
        tag: 'Schlank und schmal',
        desc: 'Von Natur aus schlanker Rahmen. Muskelaufbau faellt schwerer.',
        tip: 'Ein Kalorienueberschuss mit progressiver Belastung hilft dir, in 6-8 Wochen Masse aufzubauen.',
      },
      mesomorph: {
        name: 'Mesomorph',
        tag: 'Athletisch und muskuloes',
        desc: 'Von Natur aus muskuloeser Bau. Baut leicht Muskeln auf.',
        tip: 'Behalte deine Gewohnheiten bei. Krafttraining schaerft deine Definition schnell.',
      },
      endomorph: {
        name: 'Endomorph',
        tag: 'Breiterer Bau',
        desc: 'Breiterer Rahmen. Baut leicht Groesse auf, mit hoeherem Koerperfett.',
        tip: 'Ein moderates Kaloriendefizit + Cardio zeigt sichtbare Ergebnisse in 8-12 Wochen.',
      },
    },
  },
  fr: {
    title: 'Quel est ton type de corps ?',
    subtitle: 'Fais glisser pour trouver le plus proche',
    cta: 'Etape suivante',
    fatRange: 'Fourchette de masse grasse',
    previous: 'Type de corps precedent',
    next: 'Type de corps suivant',
    types: {
      ectomorph: {
        name: 'Ectomorphe',
        tag: 'Fin et mince',
        desc: 'Structure naturellement fine. Plus difficile de prendre de la masse musculaire.',
        tip: 'Un surplus calorique avec surcharge progressive t aidera a prendre de la masse en 6-8 semaines.',
      },
      mesomorph: {
        name: 'Mesomorphe',
        tag: 'Athletique et muscle',
        desc: 'Structure naturellement musclee. Prend du muscle facilement.',
        tip: 'Garde tes habitudes. La musculation affinera rapidement ta definition.',
      },
      endomorph: {
        name: 'Endomorphe',
        tag: 'Structure plus large',
        desc: 'Cadre plus large. Prend facilement du volume, avec plus de masse grasse.',
        tip: 'Un deficit modere + cardio montrera des resultats visibles en 8-12 semaines.',
      },
    },
  },
};

const BODY_TYPES: BodyTypeId[] = ['ectomorph', 'mesomorph', 'endomorph'];

const BODY_TYPE_IMAGES: Record<BodyTypeId, Record<GenderShape, string>> = {
  ectomorph: { man: ectomorphMenImage, woman: ectomorphWomenImage },
  mesomorph: { man: mesomorphMenImage, woman: mesomorphWomenImage },
  endomorph: { man: endomorphMenImage, woman: endomorphWomenImage },
} as const;

const FAT_RANGES = {
  ectomorph: { man: '6-12%', woman: '10-16%' },
  mesomorph: { man: '13-20%', woman: '17-26%' },
  endomorph: { man: '21-28%', woman: '27-35%' },
} as const;

const normalizeBodyType = (value: unknown): BodyTypeId => {
  const normalized = String(value || '').trim().toLowerCase();
  return BODY_TYPES.includes(normalized as BodyTypeId) ? normalized as BodyTypeId : 'mesomorph';
};

const normalizeGender = (value: unknown): GenderShape => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' ? 'woman' : 'man';
};

function BodyFigure({ bodyType, gender }: { bodyType: BodyTypeId; gender: GenderShape }) {
  const imageSrc = BODY_TYPE_IMAGES[bodyType][gender];
  return (
    <img
      src={imageSrc}
      alt=""
      aria-hidden="true"
      className="h-[220px] w-[180px] object-contain"
      draggable={false}
    />
  );
}

export function BodyTypeSelectionScreen({
  onNext,
  onDataChange,
  onboardingData,
}: BodyTypeSelectionScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const gender = normalizeGender(onboardingData?.gender);
  const [selected, setSelected] = useState<BodyTypeId>(() => normalizeBodyType(onboardingData?.bodyType));
  const startXRef = useRef(0);
  const dragDeltaRef = useRef(0);
  const didSwipeRef = useRef(false);
  const draggingRef = useRef(false);
  const selectedIndex = BODY_TYPES.indexOf(selected);

  const selectedCopy = copy.types[selected];
  const fatRange = FAT_RANGES[selected][gender];

  const selectByIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(BODY_TYPES.length - 1, index));
    setSelected(BODY_TYPES[nextIndex]);
  };

  const handleSubmit = () => {
    onDataChange?.({
      bodyType: selected,
      bodyTypeLabel: selectedCopy.name,
    });
    onNext();
  };

  const orderedCards = useMemo(() => BODY_TYPES, []);

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">{copy.title}</h2>
        <p className="text-sm text-text-secondary">{copy.subtitle}</p>
      </div>

      <div
        className="relative h-[284px] touch-pan-y cursor-grab overflow-hidden active:cursor-grabbing"
        onPointerDown={(event) => {
          draggingRef.current = true;
          didSwipeRef.current = false;
          dragDeltaRef.current = 0;
          startXRef.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          const delta = event.clientX - startXRef.current;
          dragDeltaRef.current = delta;
          if (Math.abs(delta) < 58) return;
          didSwipeRef.current = true;
          selectByIndex(selectedIndex + (delta < 0 ? 1 : -1));
          startXRef.current = event.clientX;
          dragDeltaRef.current = 0;
        }}
        onPointerUp={(event) => {
          if (draggingRef.current && !didSwipeRef.current && Math.abs(dragDeltaRef.current) > 34) {
            didSwipeRef.current = true;
            selectByIndex(selectedIndex + (dragDeltaRef.current < 0 ? 1 : -1));
          }
          draggingRef.current = false;
          dragDeltaRef.current = 0;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          draggingRef.current = false;
          dragDeltaRef.current = 0;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        {orderedCards.map((id, index) => {
          const offset = index - selectedIndex;
          const distance = Math.abs(offset);
          const isSelected = id === selected;
          const scale = distance === 0 ? 1 : distance === 1 ? 0.82 : 0.68;
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.45 : 0.25;

          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                setSelected(id);
              }}
              className={`absolute left-1/2 top-3 flex h-[260px] w-[200px] -translate-x-1/2 flex-col items-center justify-center rounded-2xl border transition-[transform,opacity,background-color,border-color] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                isSelected ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/[0.02]'
              }`}
              style={{
                transform: `translateX(calc(-50% + ${offset * 156}px)) scale(${scale})`,
                opacity,
                zIndex: 10 - distance,
              }}
            >
              <BodyFigure bodyType={id} gender={gender} />
            </button>
          );
        })}
      </div>

      <div className="space-y-3 text-center">
        <div className="text-xs uppercase tracking-widest text-text-tertiary">{copy.fatRange}</div>
        <div className="text-3xl font-bold text-accent">{fatRange}</div>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-lg font-bold tracking-[0.08em] text-white">{selectedCopy.name}</span>
          <span className="text-xs font-medium tracking-[0.12em] text-text-tertiary">{selectedCopy.tag}</span>
        </div>
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-text-secondary">{selectedCopy.desc}</p>
      </div>

      <div className="flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => selectByIndex(selectedIndex - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-text-secondary transition-colors hover:border-accent hover:text-accent"
          aria-label={copy.previous}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          {BODY_TYPES.map((id) => (
            <span
              key={id}
              className={`h-1.5 transition-all duration-300 ${
                id === selected ? 'w-5 rounded-sm bg-accent' : 'w-1.5 rounded-full bg-white/20'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => selectByIndex(selectedIndex + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-text-secondary transition-colors hover:border-accent hover:text-accent"
          aria-label={copy.next}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="flex-1" />

      <Button onClick={handleSubmit}>{copy.cta}</Button>
    </div>
  );
}
