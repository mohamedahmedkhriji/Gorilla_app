import React, { useState } from 'react';
import { Dumbbell, HeartPulse, ShieldAlert, Sparkles, Wrench } from 'lucide-react';
import { Button } from '../ui/Button';
import { ModernSelect } from '../ui/ModernSelect';
import { DEFAULT_ONBOARDING_CONFIG, type SimpleOption } from '../../config/onboardingConfig';
import {
  getOnboardingLanguage,
  localizeRecoveryOptions,
  localizeTrainingFocusOptions,
} from './onboardingI18n';

interface AIPlanTuningScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  trainingFocusOptions?: SimpleOption[];
  recoveryStrategyOptions?: SimpleOption[];
}

const COPY = {
  en: {
    badge: 'AI Plan Tuning',
    title: 'Shape how your AI program is built',
    subtitle: 'Fine-tune the coaching style, recovery bias, and equipment constraints before we generate your plan.',
    focus: 'Training Focus',
    recovery: 'Recovery Strategy',
    injuries: 'Injuries Or Movements To Avoid',
    equipment: 'Equipment Notes',
    optional: '(optional)',
    injuriesPlaceholder: 'e.g. lower back pain, avoid overhead pressing',
    equipmentPlaceholder: 'e.g. no barbell bench, dumbbells + cables only',
    cta: 'Next Step',
  },
  ar: {
    badge: '\u0636\u0628\u0637 \u062e\u0637\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
    title: '\u062d\u062f\u062f \u0643\u064a\u0641 \u062a\u0628\u0646\u0649 \u062e\u0637\u062a\u0643 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
    subtitle: '\u0642\u0645 \u0628\u0636\u0628\u0637 \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0648\u0623\u0648\u0644\u0648\u064a\u0629 \u0627\u0644\u062a\u0639\u0627\u0641\u064a \u0648\u0642\u064a\u0648\u062f \u0627\u0644\u0645\u0639\u062f\u0627\u062a \u0642\u0628\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062e\u0637\u0629.',
    focus: '\u062a\u0631\u0643\u064a\u0632 \u0627\u0644\u062a\u062f\u0631\u064a\u0628',
    recovery: '\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0627\u0644\u062a\u0639\u0627\u0641\u064a',
    injuries: '\u0625\u0635\u0627\u0628\u0627\u062a \u0623\u0648 \u062d\u0631\u0643\u0627\u062a \u064a\u062c\u0628 \u062a\u062c\u0646\u0628\u0647\u0627',
    equipment: '\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0645\u0639\u062f\u0627\u062a',
    optional: '(\u0627\u062e\u062a\u064a\u0627\u0631\u064a)',
    injuriesPlaceholder: '\u0645\u062b\u0627\u0644: \u0623\u0644\u0645 \u0623\u0633\u0641\u0644 \u0627\u0644\u0638\u0647\u0631\u060c \u062a\u062c\u0646\u0628 \u0627\u0644\u0636\u063a\u0637 \u0627\u0644\u0639\u0644\u0648\u064a',
    equipmentPlaceholder: '\u0645\u062b\u0627\u0644: \u0644\u0627 \u064a\u0648\u062c\u062f \u0628\u0646\u0634 \u0628\u0627\u0631\u060c \u062f\u0645\u0628\u0644 \u0648\u0643\u0648\u0627\u0628\u0644 \u0641\u0642\u0637',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
  },
  it: {
    badge: 'Ottimizzazione piano AI',
    title: 'Definisci come verra creato il tuo programma AI',
    subtitle: 'Regola stile di coaching, recupero e vincoli dell attrezzatura prima di generare il piano.',
    focus: 'Focus allenamento',
    recovery: 'Strategia di recupero',
    injuries: 'Infortuni o movimenti da evitare',
    equipment: 'Note attrezzatura',
    optional: '(opzionale)',
    injuriesPlaceholder: 'es. mal di schiena, evitare spinte sopra la testa',
    equipmentPlaceholder: 'es. niente panca bilanciere, solo manubri e cavi',
    cta: 'Prossimo passo',
  },
  de: {
    badge: 'KI-Plan Feintuning',
    title: 'Lege fest, wie dein KI-Programm erstellt wird',
    subtitle: 'Passe Coaching-Stil, Erholungsfokus und Geraetevorgaben an, bevor wir deinen Plan erstellen.',
    focus: 'Trainingsfokus',
    recovery: 'Erholungsstrategie',
    injuries: 'Verletzungen oder Bewegungen vermeiden',
    equipment: 'Geraetehinweise',
    optional: '(optional)',
    injuriesPlaceholder: 'z. B. unterer Ruecken schmerzt, kein Ueberkopfdruecken',
    equipmentPlaceholder: 'z. B. keine Langhantelbank, nur Kurzhanteln und Kabel',
    cta: 'Naechster Schritt',
  },
} as const;

const resolveOptionValue = (
  value: unknown,
  options: { value: string; label: string }[],
  fallback: string,
) => {
  const normalized = String(value || '').trim().toLowerCase();
  return options.some((option) => option.value === normalized) ? normalized : fallback;
};

export function AIPlanTuningScreen({
  onNext,
  onDataChange,
  onboardingData,
  trainingFocusOptions,
  recoveryStrategyOptions,
}: AIPlanTuningScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language] ?? COPY.en;
  const trainingOptions = trainingFocusOptions?.length
    ? trainingFocusOptions
    : DEFAULT_ONBOARDING_CONFIG.options.aiTrainingFocus;
  const recoveryOptions = recoveryStrategyOptions?.length
    ? recoveryStrategyOptions
    : DEFAULT_ONBOARDING_CONFIG.options.aiRecoveryPriority;
  const localizedTrainingOptions = localizeTrainingFocusOptions(trainingOptions, language);
  const localizedRecoveryOptions = localizeRecoveryOptions(recoveryOptions, language);
  const [aiTrainingFocus, setAiTrainingFocus] = useState(
    resolveOptionValue(onboardingData?.aiTrainingFocus, trainingOptions, 'balanced'),
  );
  const [aiRecoveryPriority, setAiRecoveryPriority] = useState(
    resolveOptionValue(onboardingData?.aiRecoveryPriority, recoveryOptions, 'balanced'),
  );
  const [aiLimitations, setAiLimitations] = useState(String(onboardingData?.aiLimitations || '').trim());
  const [aiEquipmentNotes, setAiEquipmentNotes] = useState(String(onboardingData?.aiEquipmentNotes || '').trim());

  const fieldClassName =
    'w-full rounded-2xl border border-white/10 bg-background/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60 focus:bg-background focus:ring-2 focus:ring-accent/20';

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          <Sparkles size={12} />
          {copy.badge}
        </span>
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            <Dumbbell size={14} className="text-accent" />
            {copy.focus}
          </label>
          <ModernSelect
            value={aiTrainingFocus}
            onChange={(nextValue) => {
              setAiTrainingFocus(nextValue);
              onDataChange?.({ aiTrainingFocus: nextValue });
            }}
            options={localizedTrainingOptions}
            className="w-full"
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            <HeartPulse size={14} className="text-accent" />
            {copy.recovery}
          </label>
          <ModernSelect
            value={aiRecoveryPriority}
            onChange={(nextValue) => {
              setAiRecoveryPriority(nextValue);
              onDataChange?.({ aiRecoveryPriority: nextValue });
            }}
            options={localizedRecoveryOptions}
            className="w-full"
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            <ShieldAlert size={14} className="text-accent" />
            {copy.injuries}
            <span className="text-[10px] font-medium normal-case tracking-normal text-text-secondary">
              {copy.optional}
            </span>
          </label>
          <textarea
            value={aiLimitations}
            onChange={(e) => {
              const nextValue = e.target.value;
              setAiLimitations(nextValue);
              onDataChange?.({ aiLimitations: nextValue });
            }}
            rows={3}
            className={`${fieldClassName} resize-none`}
            placeholder={copy.injuriesPlaceholder}
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            <Wrench size={14} className="text-accent" />
            {copy.equipment}
            <span className="text-[10px] font-medium normal-case tracking-normal text-text-secondary">
              {copy.optional}
            </span>
          </label>
          <input
            value={aiEquipmentNotes}
            onChange={(e) => {
              const nextValue = e.target.value;
              setAiEquipmentNotes(nextValue);
              onDataChange?.({ aiEquipmentNotes: nextValue });
            }}
            className={fieldClassName}
            placeholder={copy.equipmentPlaceholder}
          />
        </div>
      </div>

      <div className="flex-1" />

      <Button
        onClick={() => {
          onDataChange?.({
            aiTrainingFocus,
            aiRecoveryPriority,
            aiLimitations: aiLimitations.trim(),
            aiEquipmentNotes: aiEquipmentNotes.trim(),
          });
          onNext();
        }}
      >
        {copy.cta}
      </Button>
    </div>
  );
}
