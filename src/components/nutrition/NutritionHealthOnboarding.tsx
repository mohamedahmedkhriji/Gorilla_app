import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Shield } from 'lucide-react';

type DiabetesType = 'type1' | 'type2' | 'other' | 'unknown';

export interface NutritionHealthOnboardingPayload {
  noKnownCondition?: boolean;
  preferNotToSay?: boolean;
  conditions: {
    diabetes?: { enabled: boolean; type?: DiabetesType };
    hypertension?: boolean;
    kidneyDisease?: { enabled: boolean; clinicianNutritionPlan?: boolean | null };
    cardiovascularDisease?: boolean;
    dyslipidemia?: boolean;
    digestiveCondition?: boolean;
    foodAllergy?: boolean;
    otherChronicCondition?: boolean;
  };
  allergies: string[];
  intolerances: string[];
  clinicianNutritionPlan?: boolean | null;
}

const conditionOptions = [
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'hypertension', label: 'High blood pressure / Hypertension' },
  { id: 'kidneyDisease', label: 'Kidney disease' },
  { id: 'cardiovascularDisease', label: 'Heart / cardiovascular condition' },
  { id: 'dyslipidemia', label: 'High cholesterol / dyslipidemia' },
  { id: 'digestiveCondition', label: 'Digestive condition' },
  { id: 'foodAllergy', label: 'Food allergy / intolerance' },
  { id: 'otherChronicCondition', label: 'Other chronic condition' },
] as const;

const listFromText = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function NutritionHealthOnboarding({
  saving,
  error,
  onComplete,
}: {
  saving: boolean;
  error?: string;
  onComplete: (payload: NutritionHealthOnboardingPayload) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({ noKnownCondition: false, preferNotToSay: false });
  const [diabetesType, setDiabetesType] = useState<DiabetesType>('unknown');
  const [kidneyClinicianPlan, setKidneyClinicianPlan] = useState<boolean | null>(null);
  const [allergiesText, setAllergiesText] = useState('');
  const [intolerancesText, setIntolerancesText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const hasCondition = useMemo(
    () => conditionOptions.some((option) => selected[option.id]),
    [selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (id === 'noKnownCondition') {
        return { noKnownCondition: !prev.noKnownCondition, preferNotToSay: false };
      }
      if (id === 'preferNotToSay') {
        return { noKnownCondition: false, preferNotToSay: !prev.preferNotToSay };
      }
      return {
        ...prev,
        noKnownCondition: false,
        preferNotToSay: false,
        [id]: !prev[id],
      };
    });
  };

  const submit = async () => {
    const payload: NutritionHealthOnboardingPayload = {
      noKnownCondition: selected.noKnownCondition,
      preferNotToSay: selected.preferNotToSay,
      conditions: {
        diabetes: selected.diabetes ? { enabled: true, type: diabetesType } : undefined,
        hypertension: selected.hypertension || undefined,
        kidneyDisease: selected.kidneyDisease ? { enabled: true, clinicianNutritionPlan: kidneyClinicianPlan } : undefined,
        cardiovascularDisease: selected.cardiovascularDisease || undefined,
        dyslipidemia: selected.dyslipidemia || undefined,
        digestiveCondition: selected.digestiveCondition || undefined,
        foodAllergy: selected.foodAllergy || undefined,
        otherChronicCondition: selected.otherChronicCondition || undefined,
      },
      allergies: listFromText(allergiesText),
      intolerances: listFromText(intolerancesText),
      clinicianNutritionPlan: kidneyClinicianPlan,
    };
    await onComplete(payload);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-2xl flex-col justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#0d131c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-300">
            <Shield size={21} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">Nutrition setup</div>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">Build safer nutrition guidance</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Optional health details help RepSet avoid overconfident meal recommendations. This is not medical diagnosis or treatment advice.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => toggle('noKnownCondition')}
            className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold transition ${
              selected.noKnownCondition ? 'border-cyan-300 bg-cyan-300 text-black' : 'border-white/10 bg-white/[0.035] text-white hover:border-cyan-300/45'
            }`}
          >
            No known condition
            {selected.noKnownCondition ? <Check size={17} /> : null}
          </button>

          <div className="grid gap-2 sm:grid-cols-2">
            {conditionOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                className={`min-h-12 rounded-2xl border px-3 text-left text-xs font-semibold transition ${
                  selected[option.id] ? 'border-cyan-300/80 bg-cyan-300/16 text-cyan-50' : 'border-white/10 bg-white/[0.035] text-text-secondary hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => toggle('preferNotToSay')}
            className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold transition ${
              selected.preferNotToSay ? 'border-cyan-300 bg-cyan-300 text-black' : 'border-white/10 bg-white/[0.035] text-white hover:border-cyan-300/45'
            }`}
          >
            Prefer not to say
            {selected.preferNotToSay ? <Check size={17} /> : null}
          </button>
        </div>

        {selected.diabetes ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/18 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Diabetes type</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['type1', 'type2', 'other', 'unknown'] as DiabetesType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDiabetesType(type)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${diabetesType === type ? 'bg-cyan-300 text-black' : 'bg-white/5 text-text-secondary'}`}
                >
                  {type === 'type1' ? 'Type 1' : type === 'type2' ? 'Type 2' : type === 'other' ? 'Other' : 'Not sure'}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selected.kidneyDisease ? (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/8 p-3">
            <div className="flex gap-2 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <p>Kidney-related nutrition may require individual guidance. RepSet will limit automated high-protein personalization.</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setKidneyClinicianPlan(true)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${kidneyClinicianPlan === true ? 'bg-amber-200 text-black' : 'bg-white/5 text-amber-100'}`}>I have a clinician plan</button>
              <button type="button" onClick={() => setKidneyClinicianPlan(false)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${kidneyClinicianPlan === false ? 'bg-amber-200 text-black' : 'bg-white/5 text-amber-100'}`}>Not currently</button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-text-secondary">
            Allergies
            <input value={allergiesText} onChange={(event) => setAllergiesText(event.target.value)} placeholder="nuts, shellfish..." className="mt-1 w-full rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/70" />
          </label>
          <label className="text-xs font-semibold text-text-secondary">
            Intolerances
            <input value={intolerancesText} onChange={(event) => setIntolerancesText(event.target.value)} placeholder="lactose, gluten..." className="mt-1 w-full rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/70" />
          </label>
        </div>

        <label className="mt-5 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-text-secondary">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300" />
          I understand RepSet is a fitness nutrition tool, not a medical diagnosis or treatment service.
        </label>

        {error ? <div className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

        <button
          type="button"
          disabled={saving || !acknowledged || (!hasCondition && !selected.noKnownCondition && !selected.preferNotToSay)}
          onClick={submit}
          className="mt-5 min-h-12 w-full rounded-2xl bg-cyan-300 px-4 text-sm font-black text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? 'Saving...' : 'Continue to Nutrition'}
        </button>
      </div>
    </div>
  );
}
