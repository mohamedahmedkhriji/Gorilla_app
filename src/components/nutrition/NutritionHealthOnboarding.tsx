import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Shield } from 'lucide-react';
import { AppLanguage, pickLanguage } from '../../services/language';

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
  { id: 'diabetes' },
  { id: 'hypertension' },
  { id: 'kidneyDisease' },
  { id: 'cardiovascularDisease' },
  { id: 'dyslipidemia' },
  { id: 'digestiveCondition' },
  { id: 'foodAllergy' },
  { id: 'otherChronicCondition' },
] as const;

const HEALTH_COPY = {
  en: {
    eyebrow: 'Nutrition setup',
    title: 'Build safer nutrition guidance',
    body: 'Optional health details help RepSet avoid overconfident meal recommendations. This is not medical diagnosis or treatment advice.',
    noKnownCondition: 'No known condition',
    preferNotToSay: 'Prefer not to say',
    diabetesType: 'Diabetes type',
    diabetesTypes: { type1: 'Type 1', type2: 'Type 2', other: 'Other', unknown: 'Not sure' },
    kidneyWarning: 'Kidney-related nutrition may require individual guidance. RepSet will limit automated high-protein personalization.',
    clinicianPlanYes: 'I have a clinician plan',
    clinicianPlanNo: 'Not currently',
    allergies: 'Allergies',
    allergiesPlaceholder: 'nuts, shellfish...',
    intolerances: 'Intolerances',
    intolerancesPlaceholder: 'lactose, gluten...',
    acknowledge: 'I understand RepSet is a fitness nutrition tool, not a medical diagnosis or treatment service.',
    saving: 'Saving...',
    continue: 'Continue to Nutrition',
    conditions: {
      diabetes: 'Diabetes',
      hypertension: 'High blood pressure / Hypertension',
      kidneyDisease: 'Kidney disease',
      cardiovascularDisease: 'Heart / cardiovascular condition',
      dyslipidemia: 'High cholesterol / dyslipidemia',
      digestiveCondition: 'Digestive condition',
      foodAllergy: 'Food allergy / intolerance',
      otherChronicCondition: 'Other chronic condition',
    },
  },
  ar: {
    eyebrow: 'إعداد التغذية',
    title: 'أنشئ إرشادات تغذية أكثر أمانا',
    body: 'تساعد التفاصيل الصحية الاختيارية RepSet على تجنب توصيات الوجبات المبالغ في ثقتها. هذا ليس تشخيصا أو علاجا طبيا.',
    noKnownCondition: 'لا توجد حالة معروفة',
    preferNotToSay: 'أفضل عدم الإفصاح',
    diabetesType: 'نوع السكري',
    diabetesTypes: { type1: 'النوع 1', type2: 'النوع 2', other: 'آخر', unknown: 'لست متأكدا' },
    kidneyWarning: 'قد تتطلب التغذية المرتبطة بالكلى إرشادا فرديا. سيحد RepSet من التخصيص الآلي عالي البروتين.',
    clinicianPlanYes: 'لدي خطة من مختص',
    clinicianPlanNo: 'ليس حاليا',
    allergies: 'الحساسية',
    allergiesPlaceholder: 'المكسرات، المحار...',
    intolerances: 'عدم التحمل',
    intolerancesPlaceholder: 'اللاكتوز، الغلوتين...',
    acknowledge: 'أفهم أن RepSet أداة تغذية للياقة، وليس خدمة تشخيص أو علاج طبي.',
    saving: 'جار الحفظ...',
    continue: 'المتابعة إلى التغذية',
    conditions: {
      diabetes: 'السكري',
      hypertension: 'ارتفاع ضغط الدم',
      kidneyDisease: 'مرض الكلى',
      cardiovascularDisease: 'حالة قلبية / وعائية',
      dyslipidemia: 'ارتفاع الكوليسترول / اضطراب الدهون',
      digestiveCondition: 'حالة هضمية',
      foodAllergy: 'حساسية / عدم تحمل الطعام',
      otherChronicCondition: 'حالة مزمنة أخرى',
    },
  },
  it: {
    eyebrow: 'Configurazione nutrizione',
    title: 'Crea indicazioni nutrizionali piu sicure',
    body: 'I dettagli sanitari opzionali aiutano RepSet a evitare consigli alimentari troppo sicuri. Non e diagnosi o trattamento medico.',
    noKnownCondition: 'Nessuna condizione nota',
    preferNotToSay: 'Preferisco non dirlo',
    diabetesType: 'Tipo di diabete',
    diabetesTypes: { type1: 'Tipo 1', type2: 'Tipo 2', other: 'Altro', unknown: 'Non sono sicuro' },
    kidneyWarning: 'La nutrizione legata ai reni puo richiedere una guida individuale. RepSet limitera la personalizzazione automatica ad alto contenuto proteico.',
    clinicianPlanYes: 'Ho un piano clinico',
    clinicianPlanNo: 'Non al momento',
    allergies: 'Allergie',
    allergiesPlaceholder: 'noci, crostacei...',
    intolerances: 'Intolleranze',
    intolerancesPlaceholder: 'lattosio, glutine...',
    acknowledge: 'Capisco che RepSet e uno strumento di nutrizione fitness, non un servizio di diagnosi o trattamento medico.',
    saving: 'Salvataggio...',
    continue: 'Continua alla nutrizione',
    conditions: {
      diabetes: 'Diabete',
      hypertension: 'Pressione alta / Ipertensione',
      kidneyDisease: 'Malattia renale',
      cardiovascularDisease: 'Condizione cardiaca / cardiovascolare',
      dyslipidemia: 'Colesterolo alto / dislipidemia',
      digestiveCondition: 'Condizione digestiva',
      foodAllergy: 'Allergia / intolleranza alimentare',
      otherChronicCondition: 'Altra condizione cronica',
    },
  },
  de: {
    eyebrow: 'Ernaehrung einrichten',
    title: 'Sicherere Ernaehrungsempfehlungen erstellen',
    body: 'Optionale Gesundheitsdaten helfen RepSet, zu selbstsichere Mahlzeitenempfehlungen zu vermeiden. Dies ist keine medizinische Diagnose oder Behandlung.',
    noKnownCondition: 'Keine bekannte Erkrankung',
    preferNotToSay: 'Moechte ich nicht sagen',
    diabetesType: 'Diabetes-Typ',
    diabetesTypes: { type1: 'Typ 1', type2: 'Typ 2', other: 'Andere', unknown: 'Nicht sicher' },
    kidneyWarning: 'Nierenbezogene Ernaehrung kann individuelle Beratung erfordern. RepSet begrenzt automatische High-Protein-Personalisierung.',
    clinicianPlanYes: 'Ich habe einen klinischen Plan',
    clinicianPlanNo: 'Derzeit nicht',
    allergies: 'Allergien',
    allergiesPlaceholder: 'Nuesse, Schalentiere...',
    intolerances: 'Unvertraeglichkeiten',
    intolerancesPlaceholder: 'Laktose, Gluten...',
    acknowledge: 'Ich verstehe, dass RepSet ein Fitness-Ernaehrungstool ist und kein medizinischer Diagnose- oder Behandlungsdienst.',
    saving: 'Speichern...',
    continue: 'Weiter zur Ernaehrung',
    conditions: {
      diabetes: 'Diabetes',
      hypertension: 'Bluthochdruck / Hypertonie',
      kidneyDisease: 'Nierenerkrankung',
      cardiovascularDisease: 'Herz- / Kreislauferkrankung',
      dyslipidemia: 'Hoher Cholesterinspiegel / Dyslipidaemie',
      digestiveCondition: 'Verdauungsbeschwerden',
      foodAllergy: 'Lebensmittelallergie / Unvertraeglichkeit',
      otherChronicCondition: 'Andere chronische Erkrankung',
    },
  },
  fr: {
    eyebrow: 'Configuration nutrition',
    title: 'Construire des conseils nutrition plus surs',
    body: 'Les details de sante facultatifs aident RepSet a eviter des recommandations de repas trop affirmatives. Ce nest pas un diagnostic ni un traitement medical.',
    noKnownCondition: 'Aucune condition connue',
    preferNotToSay: 'Je prefere ne pas le dire',
    diabetesType: 'Type de diabete',
    diabetesTypes: { type1: 'Type 1', type2: 'Type 2', other: 'Autre', unknown: 'Pas sur' },
    kidneyWarning: 'La nutrition liee aux reins peut necessiter un accompagnement individuel. RepSet limitera la personnalisation automatique riche en proteines.',
    clinicianPlanYes: 'Jai un plan medical',
    clinicianPlanNo: 'Pas actuellement',
    allergies: 'Allergies',
    allergiesPlaceholder: 'noix, crustaces...',
    intolerances: 'Intolerances',
    intolerancesPlaceholder: 'lactose, gluten...',
    acknowledge: 'Je comprends que RepSet est un outil de nutrition fitness, pas un service de diagnostic ou de traitement medical.',
    saving: 'Enregistrement...',
    continue: 'Continuer vers Nutrition',
    conditions: {
      diabetes: 'Diabete',
      hypertension: 'Hypertension arterielle',
      kidneyDisease: 'Maladie renale',
      cardiovascularDisease: 'Condition cardiaque / cardiovasculaire',
      dyslipidemia: 'Cholesterol eleve / dyslipidemie',
      digestiveCondition: 'Trouble digestif',
      foodAllergy: 'Allergie / intolerance alimentaire',
      otherChronicCondition: 'Autre condition chronique',
    },
  },
} as const;

const listFromText = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function NutritionHealthOnboarding({
  saving,
  error,
  onComplete,
  language = 'en',
}: {
  saving: boolean;
  error?: string;
  onComplete: (payload: NutritionHealthOnboardingPayload) => Promise<void> | void;
  language?: AppLanguage;
}) {
  const copy = pickLanguage(language, HEALTH_COPY);
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
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">{copy.eyebrow}</div>
            <h2 className="mt-2 text-2xl font-black leading-tight text-white">{copy.title}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {copy.body}
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
            {copy.noKnownCondition}
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
                {copy.conditions[option.id]}
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
            {copy.preferNotToSay}
            {selected.preferNotToSay ? <Check size={17} /> : null}
          </button>
        </div>

        {selected.diabetes ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/18 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{copy.diabetesType}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['type1', 'type2', 'other', 'unknown'] as DiabetesType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDiabetesType(type)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${diabetesType === type ? 'bg-cyan-300 text-black' : 'bg-white/5 text-text-secondary'}`}
                >
                  {copy.diabetesTypes[type]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selected.kidneyDisease ? (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/8 p-3">
            <div className="flex gap-2 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <p>{copy.kidneyWarning}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setKidneyClinicianPlan(true)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${kidneyClinicianPlan === true ? 'bg-amber-200 text-black' : 'bg-white/5 text-amber-100'}`}>{copy.clinicianPlanYes}</button>
              <button type="button" onClick={() => setKidneyClinicianPlan(false)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${kidneyClinicianPlan === false ? 'bg-amber-200 text-black' : 'bg-white/5 text-amber-100'}`}>{copy.clinicianPlanNo}</button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-text-secondary">
            {copy.allergies}
            <input value={allergiesText} onChange={(event) => setAllergiesText(event.target.value)} placeholder={copy.allergiesPlaceholder} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/70" />
          </label>
          <label className="text-xs font-semibold text-text-secondary">
            {copy.intolerances}
            <input value={intolerancesText} onChange={(event) => setIntolerancesText(event.target.value)} placeholder={copy.intolerancesPlaceholder} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/24 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/70" />
          </label>
        </div>

        <label className="mt-5 flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-text-secondary">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300" />
          {copy.acknowledge}
        </label>

        {error ? <div className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

        <button
          type="button"
          disabled={saving || !acknowledged || (!hasCondition && !selected.noKnownCondition && !selected.preferNotToSay)}
          onClick={submit}
          className="mt-5 min-h-12 w-full rounded-2xl bg-cyan-300 px-4 text-sm font-black text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? copy.saving : copy.continue}
        </button>
      </div>
    </div>
  );
}
