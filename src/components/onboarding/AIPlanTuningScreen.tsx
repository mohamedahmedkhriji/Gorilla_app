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
  const isArabic = language === 'ar';
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

  const handleNext = () => {
    onDataChange?.({
      aiTrainingFocus,
      aiRecoveryPriority,
      aiLimitations: aiLimitations.trim(),
      aiEquipmentNotes: aiEquipmentNotes.trim(),
    });
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          <Sparkles size={12} />
          {isArabic ? 'ضبط خطة الذكاء الاصطناعي' : 'AI Plan Tuning'}
        </span>
        <h2 className="text-2xl font-light text-white">
          {isArabic ? 'حدّد كيف تُبنى خطتك بالذكاء الاصطناعي' : 'Shape how your AI program is built'}
        </h2>
        <p className="text-text-secondary">
          {isArabic
            ? 'قم بضبط أسلوب التدريب وأولوية التعافي وقيود المعدات قبل إنشاء الخطة.'
            : 'Fine-tune the coaching style, recovery bias, and equipment constraints before we generate your plan.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            <Dumbbell size={14} className="text-accent" />
            {isArabic ? 'تركيز التدريب' : 'Training Focus'}
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
            {isArabic ? 'استراتيجية التعافي' : 'Recovery Strategy'}
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
            {isArabic ? 'إصابات أو حركات يجب تجنبها' : 'Injuries Or Movements To Avoid'}
            <span className="text-[10px] font-medium normal-case tracking-normal text-text-secondary">
              {isArabic ? '(اختياري)' : '(optional)'}
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
            placeholder={isArabic ? 'مثال: ألم أسفل الظهر، تجنب الضغط العلوي' : 'e.g. lower back pain, avoid overhead pressing'}
          />
        </div>

        <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            <Wrench size={14} className="text-accent" />
            {isArabic ? 'ملاحظات المعدات' : 'Equipment Notes'}
            <span className="text-[10px] font-medium normal-case tracking-normal text-text-secondary">
              {isArabic ? '(اختياري)' : '(optional)'}
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
            placeholder={isArabic ? 'مثال: لا يوجد بنش بار، دمبل وكوابل فقط' : 'e.g. no barbell bench, dumbbells + cables only'}
          />
        </div>
      </div>

      <div className="flex-1" />

      <Button onClick={handleNext}>{isArabic ? 'الخطوة التالية' : 'Next Step'}</Button>
    </div>
  );
}
