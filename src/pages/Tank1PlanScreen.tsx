import React, { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { api } from '../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../services/language';
import { recordBookApplied } from '../services/bookUsage';
import { getAssignedBookPlan, getPlanSwitchPrompt } from '../services/bookPlanSelection';

interface Tank1PlanScreenProps {
  onBack: () => void;
}

type Tank1Exercise = {
  name: string;
  prescription: string;
  comment: string;
  technique?: string;
  pairing?: string;
};

type Tank1Day = {
  dayLabel: string;
  focus: string;
  summary?: string;
  details?: string[];
  targetMuscles?: string[];
  exercises?: Tank1Exercise[];
};

type Tank1Month = {
  title: string;
  block: string;
  goal: string[];
  intensity: string[];
  tempo: string;
  rest: string[];
  split: string;
  progressionTitle: string;
  progression: string[];
  days: Tank1Day[];
};

const TANK1_DAY_NAME_BY_LABEL: Record<string, string> = {
  'Day 1': 'monday',
  'Day 2': 'tuesday',
  'Day 4': 'thursday',
  'Day 5': 'friday',
  'Day 6': 'saturday',
};

const HEAVY_EXERCISE_PATTERN = /(squat|deadlift|barbell row|bench press|shoulder press|pull-up|pull up|close grip bench|chest supported row|t-bar row)/i;

const PLAN_TEXT_TRANSLATIONS: Partial<Record<AppLanguage, Record<string, string>>> = {
  ar: {
    'Month 1 Plan': 'خطة الشهر الأول',
    'Month 2 Plan': 'خطة الشهر الثاني',
    'Block A (4-6 Weeks)': 'البلوك A (4-6 أسابيع)',
    'Block B (4-6 Weeks)': 'البلوك B (4-6 أسابيع)',
    Goal: 'الهدف',
    'Intensity Techniques': 'تقنيات الشدة',
    Split: 'التقسيمة',
    Tempo: 'التمبو',
    Rest: 'الراحة',
    'Month 1 Progression': 'تدرج الشهر الأول',
    'Month 2 Progression': 'تدرج الشهر الثاني',
    'RepSet comment:': 'ملاحظة RepSet:',
    'Technique:': 'التكنيك:',
    'Exact pairing:': 'الاقتران الدقيق:',
    'Day 1': 'اليوم 1',
    'Day 2': 'اليوم 2',
    'Day 4': 'اليوم 4',
    'Day 5': 'اليوم 5',
    'Day 6': 'اليوم 6',
    'Chest + Triceps': 'الصدر + الترايسبس',
    'Back + Biceps': 'الظهر + البايسبس',
    Legs: 'الأرجل',
    'Shoulders + Arms': 'الأكتاف + الذراعين',
    'V-Shape Specialization': 'تخصص شكل V',
    'Destroy mode.': 'وضع التدمير.',
    'High pump plus stretch hypertrophy.': 'ضخ عالي مع تضخم بالتمدد.',
    'Neural learning': 'تعلم عصبي',
    'Stretch hypertrophy': 'تضخم بالتمدد',
    'Base volume accumulation': 'بناء حجم أساسي',
    'Technique mastery': 'إتقان التكنيك',
    'New stimulus': 'تحفيز جديد',
    'More stretch hypertrophy': 'تضخم أكبر بالتمدد',
    'More machine precision': 'دقة أكبر على الأجهزة',
    'Higher metabolic stress': 'إجهاد أيضي أعلى',
    'Joint-friendly volume': 'حجم تدريب مناسب للمفاصل',
    'Density training': 'تدريب كثافة',
    'Week 1: None, learn control.': 'الأسبوع 1: بدون تقنيات شدة، فقط تعلّم التحكم.',
    'Week 2: Introduce dropsets, supersets, and rest-pause work.': 'الأسبوع 2: إدخال الدروب سيت، السوبر سيت، والريست-بوز.',
    'Week 3: Light techniques.': 'الأسبوع 3: تقنيات خفيفة.',
    'Week 4: Aggressive techniques and intensity shock.': 'الأسبوع 4: تقنيات قوية وصدمة شدة.',
    '3 second eccentric on the default working tempo.': '3 ثوانٍ في النزول كتمبو افتراضي.',
    '3 second eccentric remains mandatory.': '3 ثوانٍ في النزول تظل إلزامية.',
    'Hypertrophy work: 75 seconds': 'تمارين التضخم: 75 ثانية',
    'Heavy work: 2 to 3 minutes': 'التمارين الثقيلة: من 2 إلى 3 دقائق',
    'Hypertrophy work: 60 to 75 seconds': 'تمارين التضخم: من 60 إلى 75 ثانية',
    'Heavy work: 2 minutes': 'التمارين الثقيلة: دقيقتان',
    'Day 1 chest + triceps, Day 2 back + biceps, Day 3 recovery, Day 4 legs, Day 5 shoulders + arms, Day 6 weak point.': 'اليوم 1 صدر + ترايسبس، اليوم 2 ظهر + بايسبس، اليوم 3 استشفاء، اليوم 4 أرجل، اليوم 5 أكتاف + ذراعين، اليوم 6 نقطة ضعف.',
    'Week 1: Learn movement, perfect tempo, and build mind-muscle connection.': 'الأسبوع 1: تعلم الحركة، أتقن التمبو، وابنِ اتصال العقل بالعضلة.',
    'Week 2: Add intensity techniques, push closer to failure, and make a slight load increase.': 'الأسبوع 2: أضف تقنيات الشدة، اقترب أكثر من الفشل، وارفع الحمل قليلًا.',
    'Week 3: Adaptation, technique precision, and volume accumulation.': 'الأسبوع 3: تكيّف، دقة في التكنيك، وتراكم في الحجم التدريبي.',
    'Week 4: Intensity shock, high metabolic stress, and expanded fiber recruitment.': 'الأسبوع 4: صدمة شدة، إجهاد أيضي مرتفع، وتجنيد أكبر للألياف.',
    'Focus muscles: Lats (width priority), side delts (width illusion), upper chest (frame balance), serratus and core tightening, rear delts (3D width).': 'العضلات المستهدفة: اللاتس لتوسيع الظهر، الأكتاف الجانبية لإحساس العرض، أعلى الصدر لتوازن الإطار، السيرatus وشد الكور، والأكتاف الخلفية لعرض ثلاثي الأبعاد.',
    'Rest: 45 to 60 seconds.': 'الراحة: من 45 إلى 60 ثانية.',
    'Tempo: 3 second eccentric.': 'التمبو: 3 ثوانٍ في النزول.',
    Lats: 'اللاتس',
    'Side Delts': 'الأكتاف الجانبية',
    'Upper Chest': 'أعلى الصدر',
    Core: 'الكور',
    'Rear Delts': 'الأكتاف الخلفية',
  },
  it: {
    'Month 1 Plan': 'Piano Mese 1',
    'Month 2 Plan': 'Piano Mese 2',
    'Block A (4-6 Weeks)': 'Blocco A (4-6 Settimane)',
    'Block B (4-6 Weeks)': 'Blocco B (4-6 Settimane)',
    Goal: 'Obiettivo',
    'Intensity Techniques': 'Tecniche di intensita',
    Split: 'Split',
    Tempo: 'Tempo',
    Rest: 'Recupero',
    'Month 1 Progression': 'Progressione Mese 1',
    'Month 2 Progression': 'Progressione Mese 2',
    'RepSet comment:': 'Commento RepSet:',
    'Technique:': 'Tecnica:',
    'Exact pairing:': 'Abbinamento esatto:',
    'Day 1': 'Giorno 1',
    'Day 2': 'Giorno 2',
    'Day 4': 'Giorno 4',
    'Day 5': 'Giorno 5',
    'Day 6': 'Giorno 6',
    'Chest + Triceps': 'Petto + Tricipiti',
    'Back + Biceps': 'Schiena + Bicipiti',
    Legs: 'Gambe',
    'Shoulders + Arms': 'Spalle + Braccia',
    'V-Shape Specialization': 'Specializzazione V-Shape',
    'Destroy mode.': 'Modalita distruzione.',
    'High pump plus stretch hypertrophy.': 'Alto pump piu ipertrofia in allungamento.',
    'Neural learning': 'Apprendimento neurale',
    'Stretch hypertrophy': 'Ipertrofia in allungamento',
    'Base volume accumulation': 'Accumulo del volume di base',
    'Technique mastery': 'Padronanza della tecnica',
    'New stimulus': 'Nuovo stimolo',
    'More stretch hypertrophy': 'Piu ipertrofia in allungamento',
    'More machine precision': 'Piu precisione con le macchine',
    'Higher metabolic stress': 'Maggiore stress metabolico',
    'Joint-friendly volume': 'Volume piu adatto alle articolazioni',
    'Density training': 'Allenamento di densita',
    'Week 1: None, learn control.': 'Settimana 1: nessuna tecnica, impara il controllo.',
    'Week 2: Introduce dropsets, supersets, and rest-pause work.': 'Settimana 2: introduci dropset, superset e rest-pause.',
    'Week 3: Light techniques.': 'Settimana 3: tecniche leggere.',
    'Week 4: Aggressive techniques and intensity shock.': 'Settimana 4: tecniche aggressive e shock di intensita.',
    '3 second eccentric on the default working tempo.': '3 secondi di eccentrica come tempo di lavoro standard.',
    '3 second eccentric remains mandatory.': '3 secondi di eccentrica restano obbligatori.',
    'Hypertrophy work: 75 seconds': 'Lavoro ipertrofia: 75 secondi',
    'Heavy work: 2 to 3 minutes': 'Lavoro pesante: da 2 a 3 minuti',
    'Hypertrophy work: 60 to 75 seconds': 'Lavoro ipertrofia: da 60 a 75 secondi',
    'Heavy work: 2 minutes': 'Lavoro pesante: 2 minuti',
    'Day 1 chest + triceps, Day 2 back + biceps, Day 3 recovery, Day 4 legs, Day 5 shoulders + arms, Day 6 weak point.': 'Giorno 1 petto + tricipiti, Giorno 2 schiena + bicipiti, Giorno 3 recupero, Giorno 4 gambe, Giorno 5 spalle + braccia, Giorno 6 punto debole.',
    'Week 1: Learn movement, perfect tempo, and build mind-muscle connection.': 'Settimana 1: impara il movimento, perfeziona il tempo e costruisci la connessione mente-muscolo.',
    'Week 2: Add intensity techniques, push closer to failure, and make a slight load increase.': 'Settimana 2: aggiungi tecniche di intensita, spingiti piu vicino al cedimento e aumenta leggermente il carico.',
    'Week 3: Adaptation, technique precision, and volume accumulation.': 'Settimana 3: adattamento, precisione tecnica e accumulo di volume.',
    'Week 4: Intensity shock, high metabolic stress, and expanded fiber recruitment.': 'Settimana 4: shock di intensita, alto stress metabolico e maggiore reclutamento delle fibre.',
    'Focus muscles: Lats (width priority), side delts (width illusion), upper chest (frame balance), serratus and core tightening, rear delts (3D width).': 'Muscoli focus: dorsali (priorita larghezza), deltoidi laterali (illusione di larghezza), parte alta del petto (equilibrio della struttura), serrato e core piu stretti, deltoidi posteriori (larghezza 3D).',
    'Rest: 45 to 60 seconds.': 'Recupero: da 45 a 60 secondi.',
    'Tempo: 3 second eccentric.': 'Tempo: 3 secondi di eccentrica.',
    Lats: 'Gran dorsali',
    'Side Delts': 'Deltoidi laterali',
    'Upper Chest': 'Parte alta del petto',
    Core: 'Core',
    'Rear Delts': 'Deltoidi posteriori',
  },
  de: {
    'Month 1 Plan': 'Monat-1-Plan',
    'Month 2 Plan': 'Monat-2-Plan',
    'Block A (4-6 Weeks)': 'Block A (4-6 Wochen)',
    'Block B (4-6 Weeks)': 'Block B (4-6 Wochen)',
    Goal: 'Ziel',
    'Intensity Techniques': 'Intensitaetstechniken',
    Split: 'Split',
    Tempo: 'Tempo',
    Rest: 'Pause',
    'Month 1 Progression': 'Monat-1-Fortschritt',
    'Month 2 Progression': 'Monat-2-Fortschritt',
    'RepSet comment:': 'RepSet-Kommentar:',
    'Technique:': 'Technik:',
    'Exact pairing:': 'Exakte Kombination:',
    'Day 1': 'Tag 1',
    'Day 2': 'Tag 2',
    'Day 4': 'Tag 4',
    'Day 5': 'Tag 5',
    'Day 6': 'Tag 6',
    'Chest + Triceps': 'Brust + Trizeps',
    'Back + Biceps': 'Ruecken + Bizeps',
    Legs: 'Beine',
    'Shoulders + Arms': 'Schultern + Arme',
    'V-Shape Specialization': 'V-Shape-Spezialisierung',
    'Destroy mode.': 'Zerstoerungsmodus.',
    'High pump plus stretch hypertrophy.': 'Hoher Pump plus Stretch-Hypertrophie.',
    'Neural learning': 'Neuronales Lernen',
    'Stretch hypertrophy': 'Stretch-Hypertrophie',
    'Base volume accumulation': 'Grundlegender Volumenaufbau',
    'Technique mastery': 'Technikbeherrschung',
    'New stimulus': 'Neuer Reiz',
    'More stretch hypertrophy': 'Mehr Stretch-Hypertrophie',
    'More machine precision': 'Mehr Praezision an Maschinen',
    'Higher metabolic stress': 'Hoeherer metabolischer Stress',
    'Joint-friendly volume': 'Gelenkschonendes Volumen',
    'Density training': 'Dichtetraining',
    'Week 1: None, learn control.': 'Woche 1: keine Intensitaetstechniken, lerne Kontrolle.',
    'Week 2: Introduce dropsets, supersets, and rest-pause work.': 'Woche 2: Fuehre Dropsets, Supersaetze und Rest-Pause ein.',
    'Week 3: Light techniques.': 'Woche 3: leichte Techniken.',
    'Week 4: Aggressive techniques and intensity shock.': 'Woche 4: aggressive Techniken und Intensitaetsschock.',
    '3 second eccentric on the default working tempo.': '3 Sekunden exzentrisch als Standard-Arbeitstempo.',
    '3 second eccentric remains mandatory.': '3 Sekunden exzentrisch bleiben Pflicht.',
    'Hypertrophy work: 75 seconds': 'Hypertrophiearbeit: 75 Sekunden',
    'Heavy work: 2 to 3 minutes': 'Schwere Arbeit: 2 bis 3 Minuten',
    'Hypertrophy work: 60 to 75 seconds': 'Hypertrophiearbeit: 60 bis 75 Sekunden',
    'Heavy work: 2 minutes': 'Schwere Arbeit: 2 Minuten',
    'Day 1 chest + triceps, Day 2 back + biceps, Day 3 recovery, Day 4 legs, Day 5 shoulders + arms, Day 6 weak point.': 'Tag 1 Brust + Trizeps, Tag 2 Ruecken + Bizeps, Tag 3 Erholung, Tag 4 Beine, Tag 5 Schultern + Arme, Tag 6 Schwachstelle.',
    'Week 1: Learn movement, perfect tempo, and build mind-muscle connection.': 'Woche 1: Lerne die Bewegung, perfektioniere das Tempo und baue die Mind-Muscle-Connection auf.',
    'Week 2: Add intensity techniques, push closer to failure, and make a slight load increase.': 'Woche 2: Fuege Intensitaetstechniken hinzu, gehe naeher ans Muskelversagen und erhoehe das Gewicht leicht.',
    'Week 3: Adaptation, technique precision, and volume accumulation.': 'Woche 3: Anpassung, Technikpraezision und Volumenaufbau.',
    'Week 4: Intensity shock, high metabolic stress, and expanded fiber recruitment.': 'Woche 4: Intensitaetsschock, hoher metabolischer Stress und erweiterte Fasereinbindung.',
    'Focus muscles: Lats (width priority), side delts (width illusion), upper chest (frame balance), serratus and core tightening, rear delts (3D width).': 'Fokusmuskeln: Lats (Breite zuerst), seitliche Delts (Breitenillusion), obere Brust (Rahmenbalance), Serratus und Core-Straffung, hintere Delts (3D-Breite).',
    'Rest: 45 to 60 seconds.': 'Pause: 45 bis 60 Sekunden.',
    'Tempo: 3 second eccentric.': 'Tempo: 3 Sekunden exzentrisch.',
    Lats: 'Lats',
    'Side Delts': 'Seitliche Delts',
    'Upper Chest': 'Obere Brust',
    Core: 'Core',
    'Rear Delts': 'Hintere Delts',
  },
};

const TANK1_PLAN_I18N: Record<AppLanguage, {
  title: string;
  badge: string;
  summary: string;
  usePlan: string;
  usingPlan: string;
  activePlan: string;
  modalTitle: string;
  modalBody: string;
  modalHint: string;
  confirm: string;
  cancel: string;
  noSession: string;
  saveFailed: string;
  success: string;
}> = {
  en: {
    title: 'Tank-1 Plan',
    badge: 'RepSet Template',
    summary: 'Bodybuilding periodization template with RepSet comments, technique instructions, exact pairings, Month 1 progression, and Month 2 progression using the same split.',
    usePlan: 'Use As My Plan',
    usingPlan: 'Saving...',
    activePlan: 'Active In My Plan',
    modalTitle: 'Choose Tank-1 as your personal plan?',
    modalBody: 'This will save Tank-1 as your active plan on the My Plan page.',
    modalHint: 'You can still edit this plan later if you want to personalize it more.',
    confirm: 'Yes, Use Tank-1',
    cancel: 'Cancel',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save Tank-1 as your plan.',
    success: 'Tank-1 is now saved as your active plan in My Plan.',
  },
  ar: {
    title: 'خطة Tank-1',
    badge: 'قالب RepSet',
    summary: 'قالب فترة تدريب كمال أجسام مع ملاحظات RepSet، وتعليمات التكنيك، والاقترانات الدقيقة، وتدرج الشهر الأول والشهر الثاني بنفس التقسيمة.',
    usePlan: 'اجعلها خطتي',
    usingPlan: 'جارٍ الحفظ...',
    activePlan: 'مفعلة في خطتي',
    modalTitle: 'هل تريد اختيار Tank-1 كخطتك الشخصية؟',
    modalBody: 'سيتم حفظ Tank-1 كخطتك النشطة داخل صفحة خطتي.',
    modalHint: 'ويمكنك تعديل هذه الخطة لاحقًا إذا أردت تخصيصها أكثر.',
    confirm: 'نعم، اختر Tank-1',
    cancel: 'إلغاء',
    noSession: 'لا توجد جلسة مستخدم نشطة.',
    saveFailed: 'تعذر حفظ Tank-1 كخطتك.',
    success: 'تم حفظ Tank-1 كخطتك النشطة داخل صفحة خطتي.',
  },
  it: {
    title: 'Piano Tank-1',
    badge: 'Template RepSet',
    summary: 'Template di periodizzazione bodybuilding con commenti RepSet, istruzioni tecniche, abbinamenti esatti, progressione del mese 1 e del mese 2 con la stessa split.',
    usePlan: 'Usalo Come Mio Piano',
    usingPlan: 'Salvataggio...',
    activePlan: 'Attivo In My Plan',
    modalTitle: 'Vuoi scegliere Tank-1 come piano personale?',
    modalBody: 'Questo salvera Tank-1 come piano attivo nella pagina My Plan.',
    modalHint: 'Potrai comunque modificare questo piano piu avanti se vorrai personalizzarlo meglio.',
    confirm: 'Si, usa Tank-1',
    cancel: 'Annulla',
    noSession: 'Nessuna sessione utente attiva trovata.',
    saveFailed: 'Impossibile salvare Tank-1 come tuo piano.',
    success: 'Tank-1 ora e salvato come piano attivo in My Plan.',
  },
  de: {
    title: 'Tank-1-Plan',
    badge: 'RepSet-Vorlage',
    summary: 'Bodybuilding-Periodisierungsvorlage mit RepSet-Kommentaren, Technikhinweisen, exakten Kombinationen sowie Monat-1- und Monat-2-Fortschritt bei gleicher Split-Struktur.',
    usePlan: 'Als Meinen Plan Nutzen',
    usingPlan: 'Speichern...',
    activePlan: 'In My Plan Aktiv',
    modalTitle: 'Moechtest du Tank-1 als deinen persoenlichen Plan waehlen?',
    modalBody: 'Dadurch wird Tank-1 als aktiver Plan auf der Seite My Plan gespeichert.',
    modalHint: 'Du kannst diesen Plan spaeter immer noch bearbeiten und weiter personalisieren.',
    confirm: 'Ja, Tank-1 nutzen',
    cancel: 'Abbrechen',
    noSession: 'Keine aktive Benutzersitzung gefunden.',
    saveFailed: 'Tank-1 konnte nicht als dein Plan gespeichert werden.',
    success: 'Tank-1 ist jetzt als aktiver Plan in My Plan gespeichert.',
  },
};

const TANK1_PAYLOAD_I18N: Record<AppLanguage, { planName: string; description: string }> = {
  en: {
    planName: 'Tank-1 Personal Plan',
    description: 'Tank-1 template applied as an active personal plan.',
  },
  ar: {
    planName: 'خطة Tank-1 الشخصية',
    description: 'تم تطبيق قالب Tank-1 كخطة شخصية نشطة.',
  },
  it: {
    planName: 'Piano Personale Tank-1',
    description: 'Template Tank-1 applicato come piano personale attivo.',
  },
  de: {
    planName: 'Tank-1 Persoenlicher Plan',
    description: 'Tank-1-Vorlage als aktiver persoenlicher Plan angewendet.',
  },
};

const getStoredUserId = () => {
  if (typeof window === 'undefined') return 0;

  try {
    const localUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || localUser?.id || 0);
  } catch {
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  }
};

const parsePrescription = (exercise: Tank1Exercise) => {
  const normalized = String(exercise.prescription || '').trim().toLowerCase();
  const setsMatch = normalized.match(/^(\d+)\s*x\s*(.+)$/i);
  if (setsMatch) {
    return {
      sets: Math.max(1, Number(setsMatch[1] || 1)),
      reps: setsMatch[2].replace(/\s+/g, ' ').trim(),
    };
  }

  const roundsMatch = normalized.match(/^(\d+)\s*rounds?$/i);
  if (roundsMatch) {
    return {
      sets: Math.max(1, Number(roundsMatch[1] || 1)),
      reps: exercise.name === 'Vacuum Holds' ? '20-30 sec' : 'Rounds',
    };
  }

  return {
    sets: 3,
    reps: '8-12',
  };
};

const localizePlanText = (value: string, language: AppLanguage) => (
  PLAN_TEXT_TRANSLATIONS[language]?.[value] || value
);

const inferRestSeconds = (month: Tank1Month, day: Tank1Day, exercise: Tank1Exercise) => {
  if (day.dayLabel === 'Day 6') return 60;
  if (HEAVY_EXERCISE_PATTERN.test(exercise.name)) {
    return month.title === 'Month 2 Plan' ? 120 : 150;
  }
  return month.title === 'Month 2 Plan' ? 60 : 75;
};

const buildTank1PlanPayload = (language: AppLanguage) => {
  const payloadCopy = TANK1_PAYLOAD_I18N[language] || TANK1_PAYLOAD_I18N.en;
  const weekPlans = monthPlans.map((month) => ({
    weeklyWorkouts: month.days.map((day) => ({
      dayName: TANK1_DAY_NAME_BY_LABEL[day.dayLabel] || 'monday',
      workoutName: day.focus,
      workoutType: 'Custom',
      targetMuscles: day.targetMuscles || [],
      notes: [day.summary, ...(day.details || [])].filter(Boolean).join(' '),
      exercises: (day.exercises || []).map((exercise) => {
        const parsed = parsePrescription(exercise);
        return {
          exerciseName: exercise.name,
          sets: parsed.sets,
          reps: parsed.reps,
          restSeconds: inferRestSeconds(month, day, exercise),
          targetWeight: 20,
          targetMuscles: day.targetMuscles || [],
          notes: [
            `RepSet comment: ${exercise.comment}`,
            exercise.technique ? `Technique: ${exercise.technique}` : '',
            exercise.pairing ? `Exact pairing: ${exercise.pairing}` : '',
            `Tempo: ${month.tempo}`,
          ].filter(Boolean).join(' '),
        };
      }),
    })),
  }));

  return {
    planName: payloadCopy.planName,
    description: payloadCopy.description,
    cycleWeeks: 12,
    templateWeekCount: 2,
    selectedDays: Object.values(TANK1_DAY_NAME_BY_LABEL),
    weeklyWorkouts: weekPlans[0]?.weeklyWorkouts || [],
    weekPlans,
  };
};

const vShapeDayTemplate: Tank1Day = {
  dayLabel: 'Day 6',
  focus: 'V-Shape Specialization',
  summary: 'High pump plus stretch hypertrophy.',
  details: [
    'Focus muscles: Lats (width priority), side delts (width illusion), upper chest (frame balance), serratus and core tightening, rear delts (3D width).',
    'Rest: 45 to 60 seconds.',
    'Tempo: 3 second eccentric.',
  ],
  targetMuscles: ['Lats', 'Side Delts', 'Upper Chest', 'Core', 'Rear Delts'],
  exercises: [
    {
      name: 'Wide Grip Pull-Ups',
      prescription: '4 x failure',
      comment: 'Your V-shape starts at the pull-up bar. Pull elbows outward to create wing expansion.',
      technique: 'Week 2+: Add rest-pause.',
    },
    {
      name: 'Single Arm Lat Pulldown',
      prescription: '3 x 12 each',
      comment: 'Unilateral work fixes narrow back genetics.',
      technique: 'Week 2+: Dropset.',
    },
    {
      name: 'Straight Arm Pulldown',
      prescription: '3 x 15',
      comment: 'This engraves lat lines into your torso.',
      technique: 'Week 2+: Superset with pulldown.',
      pairing: 'Straight Arm Pulldown -> Pulldown',
    },
    {
      name: 'Cable Lateral Raise',
      prescription: '4 x 15',
      comment: 'Side delts create the illusion of a small waist.',
      technique: 'Week 2+: Giant set.',
      pairing: 'Raise -> Partial -> Hold',
    },
    {
      name: 'Machine Lateral Raise',
      prescription: '3 x 20',
      comment: 'Delts respond to burn, not ego.',
    },
    {
      name: 'Incline Upper Chest Press',
      prescription: '3 x 12',
      comment: 'Upper chest completes the V-frame.',
      technique: 'Week 2+: Dropset.',
    },
    {
      name: 'Serratus Cable Crunch',
      prescription: '3 x 20',
      comment: 'Tight core sharpens torso taper.',
    },
    {
      name: 'Vacuum Holds',
      prescription: '5 rounds',
      comment: 'Waist control is the secret of classic physiques.',
      technique: 'Hold 20 to 30 seconds.',
    },
  ],
};

const monthPlans: Tank1Month[] = [
  {
    title: 'Month 1 Plan',
    block: 'Block A (4-6 Weeks)',
    goal: [
      'Neural learning',
      'Stretch hypertrophy',
      'Base volume accumulation',
      'Technique mastery',
    ],
    intensity: [
      'Week 1: None, learn control.',
      'Week 2: Introduce dropsets, supersets, and rest-pause work.',
    ],
    tempo: '3 second eccentric on the default working tempo.',
    rest: [
      'Hypertrophy work: 75 seconds',
      'Heavy work: 2 to 3 minutes',
    ],
    split: 'Day 1 chest + triceps, Day 2 back + biceps, Day 3 recovery, Day 4 legs, Day 5 shoulders + arms, Day 6 weak point.',
    progressionTitle: 'Month 1 Progression',
    progression: [
      'Week 1: Learn movement, perfect tempo, and build mind-muscle connection.',
      'Week 2: Add intensity techniques, push closer to failure, and make a slight load increase.',
    ],
    days: [
      {
        dayLabel: 'Day 1',
        focus: 'Chest + Triceps',
        targetMuscles: ['Chest', 'Triceps'],
        exercises: [
          {
            name: 'Incline Barbell Press',
            prescription: '4 x 8',
            comment: 'Upper chest sets your physique ceiling.',
            technique: 'Week 2: Last set rest-pause (8 + 3 + 2).',
          },
          {
            name: 'Flat Dumbbell Press',
            prescription: '3 x 10',
            comment: 'Press inward to recruit inner chest fibers.',
            technique: 'Week 2: Dropset on the last set with 30 percent less weight.',
          },
          {
            name: 'Machine Chest Fly',
            prescription: '3 x 12',
            comment: 'Freeze the contraction like time stopped.',
            technique: 'Week 2: Superset added.',
            pairing: 'Machine Chest Fly -> Push-ups to failure',
          },
          {
            name: 'Chest Dips',
            prescription: '3 x failure',
            comment: 'Lean forward to shift tension to the chest.',
          },
          {
            name: 'Skull Crushers',
            prescription: '3 x 10',
            comment: 'Stretch the long head brutally.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Rope Pushdown',
            prescription: '3 x 12',
            comment: 'Break the rope apart at lockout.',
            technique: 'Week 2: Superset added.',
            pairing: 'Rope Pushdown -> Overhead Extension',
          },
        ],
      },
      {
        dayLabel: 'Day 2',
        focus: 'Back + Biceps',
        targetMuscles: ['Back', 'Biceps'],
        exercises: [
          {
            name: 'Pull-ups',
            prescription: '4 x failure',
            comment: 'Drive elbows down to widen the lats.',
          },
          {
            name: 'Barbell Row',
            prescription: '4 x 8',
            comment: 'Back thickness is built here.',
            technique: 'Week 2: Rest-pause on the last set.',
          },
          {
            name: 'Lat Pulldown',
            prescription: '3 x 12',
            comment: 'Pause for 1 second at the bottom.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Seated Cable Row',
            prescription: '3 x 12',
            comment: 'Crack a walnut between the scapula.',
            technique: 'Week 2: Superset added.',
            pairing: 'Seated Cable Row -> Straight Arm Pulldown',
          },
          {
            name: 'Incline DB Curl',
            prescription: '3 x 10',
            comment: 'Painful stretch builds the peak.',
          },
          {
            name: 'Hammer Curl',
            prescription: '3 x 12',
            comment: 'Density builder.',
            technique: 'Week 2: Dropset.',
          },
        ],
      },
      {
        dayLabel: 'Day 4',
        focus: 'Legs',
        summary: 'Destroy mode.',
        targetMuscles: ['Quadriceps', 'Hamstrings', 'Calves'],
        exercises: [
          {
            name: 'Back Squat',
            prescription: '4 x 6',
            comment: 'Depth separates amateurs from athletes.',
            technique: 'Week 2: Rest-pause.',
          },
          {
            name: 'Leg Press',
            prescription: '3 x 12',
            comment: 'Slow negative ignites the quads.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Romanian Deadlift',
            prescription: '3 x 10',
            comment: 'Hamstrings grow in the stretch.',
          },
          {
            name: 'Seated Leg Curl',
            prescription: '3 x 12',
            comment: 'Squeeze like holding a coin.',
            technique: 'Week 2: Superset added.',
            pairing: 'Seated Leg Curl -> Leg Extension',
          },
          {
            name: 'Leg Extension',
            prescription: '3 x 15',
            comment: 'Pain equals quad detail.',
          },
          {
            name: 'Standing Calf Raise',
            prescription: '5 x 12',
            comment: 'Full stretch unlocks the calves.',
            technique: 'Week 2: Dropset every set.',
          },
        ],
      },
      {
        dayLabel: 'Day 5',
        focus: 'Shoulders + Arms',
        targetMuscles: ['Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          {
            name: 'DB Shoulder Press',
            prescription: '4 x 8',
            comment: 'Shoulders define upper body width.',
            technique: 'Week 2: Rest-pause.',
          },
          {
            name: 'Lateral Raise',
            prescription: '4 x 15',
            comment: 'Raise elbows, not weights.',
            technique: 'Week 2: Giant set added.',
            pairing: 'Lateral Raise -> Partials -> Hold',
          },
          {
            name: 'Rear Delt Fly',
            prescription: '3 x 15',
            comment: 'Rear delts create the 3D look.',
          },
          {
            name: 'Cable Curl',
            prescription: '3 x 12',
            comment: 'Constant tension peak builder.',
            technique: 'Week 2: Dropset.',
          },
          {
            name: 'Overhead Triceps Extension',
            prescription: '3 x 12',
            comment: 'Long head grows the sleeves.',
            technique: 'Week 2: Superset added.',
            pairing: 'Overhead Triceps Extension -> Pushdown',
          },
        ],
      },
      {
        ...vShapeDayTemplate,
      },
    ],
  },
  {
    title: 'Month 2 Plan',
    block: 'Block B (4-6 Weeks)',
    goal: [
      'New stimulus',
      'More stretch hypertrophy',
      'More machine precision',
      'Higher metabolic stress',
      'Joint-friendly volume',
      'Density training',
    ],
    intensity: [
      'Week 3: Light techniques.',
      'Week 4: Aggressive techniques and intensity shock.',
    ],
    tempo: '3 second eccentric remains mandatory.',
    rest: [
      'Hypertrophy work: 60 to 75 seconds',
      'Heavy work: 2 minutes',
    ],
    split: 'Day 1 chest + triceps, Day 2 back + biceps, Day 3 recovery, Day 4 legs, Day 5 shoulders + arms, Day 6 weak point.',
    progressionTitle: 'Month 2 Progression',
    progression: [
      'Week 3: Adaptation, technique precision, and volume accumulation.',
      'Week 4: Intensity shock, high metabolic stress, and expanded fiber recruitment.',
    ],
    days: [
      {
        dayLabel: 'Day 1',
        focus: 'Chest + Triceps',
        targetMuscles: ['Chest', 'Triceps'],
        exercises: [
          {
            name: 'Incline Dumbbell Press',
            prescription: '4 x 10',
            comment: 'Freedom of dumbbells forces real chest activation.',
            technique: 'Week 4: Rest-pause (10 + 4 + 3).',
          },
          {
            name: 'Smith Machine Flat Press',
            prescription: '3 x 10',
            comment: 'Stability allows deeper fiber recruitment.',
            technique: 'Week 4: Dropset with 25 percent less weight.',
          },
          {
            name: 'Low Cable Fly',
            prescription: '3 x 15',
            comment: 'Stretch the chest like opening armor.',
            technique: 'Week 4: Superset added.',
            pairing: 'Low Cable Fly -> Push-ups',
          },
          {
            name: 'Close Grip Bench Press',
            prescription: '3 x 8',
            comment: 'Heavy triceps create pressing power.',
          },
          {
            name: 'Rope Pushdown',
            prescription: '3 x 12',
            comment: 'Lockout defines arm sharpness.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'Bench Dips',
            prescription: '3 x failure',
            comment: 'Bodyweight destruction finishes the triceps.',
          },
        ],
      },
      {
        dayLabel: 'Day 2',
        focus: 'Back + Biceps',
        targetMuscles: ['Back', 'Biceps'],
        exercises: [
          {
            name: 'Chest Supported Row',
            prescription: '4 x 10',
            comment: 'Eliminate cheating to isolate back thickness.',
            technique: 'Week 4: Rest-pause.',
          },
          {
            name: 'Neutral Grip Pulldown',
            prescription: '3 x 12',
            comment: 'Neutral grip maximizes lat length tension.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'T-Bar Row',
            prescription: '3 x 8',
            comment: 'Back density builder.',
          },
          {
            name: 'Straight Arm Pulldown',
            prescription: '3 x 15',
            comment: 'Lat isolation teaches mind-muscle control.',
            technique: 'Week 4: Superset added.',
            pairing: 'Straight Arm Pulldown -> Neutral Grip Pulldown',
          },
          {
            name: 'EZ Bar Curl',
            prescription: '3 x 10',
            comment: 'Controlled negative builds the peak.',
          },
          {
            name: 'Preacher Curl',
            prescription: '3 x 12',
            comment: 'No cheating means pure biceps load.',
            technique: 'Week 4: Dropset.',
          },
        ],
      },
      {
        dayLabel: 'Day 4',
        focus: 'Legs',
        targetMuscles: ['Quadriceps', 'Hamstrings', 'Calves'],
        exercises: [
          {
            name: 'Front Squat',
            prescription: '4 x 6',
            comment: 'Quad dominance creates aesthetic legs.',
            technique: 'Week 4: Rest-pause.',
          },
          {
            name: 'Hack Squat',
            prescription: '3 x 12',
            comment: 'Machine path allows brutal quad fatigue.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'Stiff-Leg Deadlift',
            prescription: '3 x 10',
            comment: 'Hamstrings grow in controlled stretch.',
          },
          {
            name: 'Seated Leg Curl',
            prescription: '3 x 12',
            comment: 'Hamstring contraction prevents injury.',
            technique: 'Week 4: Superset added.',
            pairing: 'Seated Leg Curl -> Leg Extension',
          },
          {
            name: 'Walking Lunges',
            prescription: '3 x 20 steps',
            comment: 'Functional hypertrophy.',
          },
          {
            name: 'Seated Calf Raise',
            prescription: '5 x 12',
            comment: 'Calves require high frequency stimulus.',
            technique: 'Week 4: Dropset every set.',
          },
        ],
      },
      {
        dayLabel: 'Day 5',
        focus: 'Shoulders + Arms',
        targetMuscles: ['Shoulders', 'Biceps', 'Triceps'],
        exercises: [
          {
            name: 'Machine Shoulder Press',
            prescription: '4 x 10',
            comment: 'Machine control allows higher fatigue tolerance.',
            technique: 'Week 4: Rest-pause.',
          },
          {
            name: 'Cable Lateral Raise',
            prescription: '4 x 15',
            comment: 'Constant tension builds capped delts.',
            technique: 'Week 4: Giant set added.',
            pairing: 'Cable Lateral Raise -> Partials -> Hold -> Burn reps',
          },
          {
            name: 'Reverse Pec Deck',
            prescription: '3 x 15',
            comment: 'Rear delts stabilize the shoulder joint.',
          },
          {
            name: 'Spider Curl',
            prescription: '3 x 12',
            comment: 'Peak builder with full isolation.',
            technique: 'Week 4: Dropset.',
          },
          {
            name: 'Rope Overhead Extension',
            prescription: '3 x 12',
            comment: 'Long head triceps create the arm size illusion.',
            technique: 'Week 4: Superset added.',
            pairing: 'Rope Overhead Extension -> Pushdown',
          },
        ],
      },
      {
        ...vShapeDayTemplate,
      },
    ],
  },
];

export function Tank1PlanScreen({ onBack }: Tank1PlanScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignedPlan, setAssignedPlan] = useState(() => getAssignedBookPlan());
  const copy = useMemo(() => TANK1_PLAN_I18N[language] || TANK1_PLAN_I18N.en, [language]);
  const isArabic = language === 'ar';
  const isCurrentPlanActive = assignedPlan.id === 'tank-1';
  const modalCopy = useMemo(() => {
    if (assignedPlan.id && assignedPlan.id !== 'tank-1') {
      return getPlanSwitchPrompt({
        language,
        currentPlanName: assignedPlan.name || 'your current plan',
        nextPlanName: 'Tank-1',
      });
    }

    return {
      title: copy.modalTitle,
      body: copy.modalBody,
      hint: copy.modalHint,
    };
  }, [assignedPlan.id, assignedPlan.name, copy.modalBody, copy.modalHint, copy.modalTitle, language]);

  useEffect(() => {
    const syncAssignedPlan = () => {
      setAssignedPlan(getAssignedBookPlan());
    };
    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };
    const handleStorage = () => {
      handleLanguageChanged();
      syncAssignedPlan();
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('program-updated', syncAssignedPlan);
    window.addEventListener('storage', handleStorage);
    syncAssignedPlan();
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('program-updated', syncAssignedPlan);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleApplyPlan = async () => {
    setError(null);
    setSuccess(null);

    const userId = getStoredUserId();
    if (!userId) {
      setError(copy.noSession);
      return;
    }

    const payload = buildTank1PlanPayload(language);
    setIsApplying(true);
    try {
      const result = await api.saveCustomProgram(userId, payload);
      if (!result?.success) {
        throw new Error(result?.error || copy.saveFailed);
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('recoveryNeedsUpdate');
        localStorage.setItem('assignedProgramTemplate', JSON.stringify({
          ...(result?.assignedProgram || {}),
          ...payload,
          templateWeekPlans: payload.weekPlans,
          repeatedWeekPlans: payload.weekPlans,
        }));
        setAssignedPlan({ id: 'tank-1', name: payload.planName });
        recordBookApplied('tank-1', userId);
        window.dispatchEvent(new CustomEvent('program-updated'));
      }

      setIsConfirmOpen(false);
      setSuccess(copy.success);
    } catch (saveError) {
      console.error('Failed to save Tank-1 plan:', saveError);
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background pb-24">
      <div className="px-4 pt-2 sm:px-6">
        <Header
          title={copy.title}
          onBack={onBack}
          rightElement={(
            <button
              type="button"
              onClick={() => {
                if (!isCurrentPlanActive) setIsConfirmOpen(true);
              }}
              disabled={isApplying || isCurrentPlanActive}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                isCurrentPlanActive
                  ? 'cursor-not-allowed bg-emerald-500/15 text-emerald-200'
                  : 'bg-accent/15 text-accent hover:bg-accent/20'
              } ${isApplying ? 'cursor-wait opacity-70' : ''}`}
            >
              {isApplying ? copy.usingPlan : (isCurrentPlanActive ? copy.activePlan : copy.usePlan)}
            </button>
          )}
        />
      </div>

      <div className="space-y-5 px-4 sm:px-6">
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <Card className="border border-accent/20 bg-accent/5 p-5">
          <div className="mb-2 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            {copy.badge}
          </div>
          <h2 className="text-2xl font-electrolize text-white">Tank-1</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {copy.summary}
          </p>
        </Card>

        {monthPlans.map((month) => (
          <section key={month.title} className="space-y-4">
            <Card className="border border-white/12 bg-white/5 p-5">
              <div className="mb-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                {localizePlanText(month.block, language)}
              </div>
              <h3 className="text-xl font-semibold text-white">{localizePlanText(month.title, language)}</h3>
              <p className="mt-3 text-sm font-semibold text-text-primary">{localizePlanText('Goal', language)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {month.goal.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary"
                  >
                    {localizePlanText(item, language)}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{localizePlanText('Intensity Techniques', language)}</p>
                  <div className="mt-2 space-y-2">
                    {month.intensity.map((item) => (
                      <p key={item} className="text-xs text-text-secondary">
                        {localizePlanText(item, language)}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{localizePlanText('Split', language)}</p>
                  <p className="mt-2 text-xs text-text-secondary">{localizePlanText(month.split, language)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{localizePlanText('Tempo', language)}</p>
                  <p className="mt-2 text-xs text-text-secondary">{localizePlanText(month.tempo, language)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{localizePlanText('Rest', language)}</p>
                  <div className="mt-2 space-y-2">
                    {month.rest.map((item) => (
                      <p key={item} className="text-xs text-text-secondary">
                        {localizePlanText(item, language)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-text-primary">{localizePlanText(month.progressionTitle, language)}</p>
                <div className="mt-2 space-y-2">
                  {month.progression.map((item) => (
                    <p key={item} className="text-xs text-text-secondary">
                      {localizePlanText(item, language)}
                    </p>
                  ))}
                </div>
              </div>
            </Card>

            {month.days.map((day) => (
              <Card key={`${month.title}-${day.dayLabel}`} className="border border-white/12 bg-white/5 p-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  {localizePlanText(day.dayLabel, language)}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-lg font-semibold text-white">{localizePlanText(day.focus, language)}</h4>
                  {day.targetMuscles && day.targetMuscles.length > 0 && (
                    <div className="grid shrink-0 grid-cols-3 gap-2">
                      {day.targetMuscles.map((muscle) => (
                        <div
                          key={`${day.dayLabel}-${muscle}`}
                          className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                          title={localizePlanText(muscle, language)}
                        >
                          <img
                            src={getBodyPartImage(muscle)}
                            alt={localizePlanText(muscle, language)}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {day.summary && (
                  <p className="mt-2 text-sm text-text-secondary">{localizePlanText(day.summary, language)}</p>
                )}
                {day.details && day.details.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {day.details.map((detail) => (
                      <p key={`${day.dayLabel}-${detail}`} className="text-xs text-text-secondary">
                        {localizePlanText(detail, language)}
                      </p>
                    ))}
                  </div>
                )}

                {day.exercises && day.exercises.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {day.exercises.map((exercise) => (
                      <div key={`${day.dayLabel}-${exercise.name}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{exercise.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-accent">
                              {exercise.prescription}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-text-secondary">
                          <span className="font-semibold text-text-primary">{localizePlanText('RepSet comment:', language)}</span> {localizePlanText(exercise.comment, language)}
                        </p>
                        {exercise.technique && (
                          <p className="mt-2 text-xs text-text-secondary">
                            <span className="font-semibold text-text-primary">{localizePlanText('Technique:', language)}</span> {localizePlanText(exercise.technique, language)}
                          </p>
                        )}
                        {exercise.pairing && (
                          <p className="mt-2 text-xs text-text-secondary">
                            <span className="font-semibold text-text-primary">{localizePlanText('Exact pairing:', language)}</span> {localizePlanText(exercise.pairing, language)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </section>
        ))}
      </div>

      {isConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            if (!isApplying) setIsConfirmOpen(false);
          }}
        >
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`w-full max-w-md rounded-2xl border border-white/10 bg-card p-5 ${isArabic ? 'text-right' : 'text-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                {success ? <Check size={18} /> : <Sparkles size={18} />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{modalCopy.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{modalCopy.body}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
              {modalCopy.hint}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isApplying}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleApplyPlan()}
                disabled={isApplying}
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
              >
                {isApplying ? copy.usingPlan : copy.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
