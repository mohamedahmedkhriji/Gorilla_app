import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { SelectionCheck } from '../ui/SelectionCheck';
import { DEFAULT_ONBOARDING_CONFIG, type SplitOption } from '../../config/onboardingConfig';
import {
  getOnboardingLanguage,
  localizeExperienceLevel,
  localizeWorkoutSplitOptions,
} from './onboardingI18n';

interface WorkoutSplitScreenProps {
  onNext: () => void;
  onDataChange?: (data: any) => void;
  onboardingData?: any;
  options?: SplitOption[];
  recommendedByDays?: Record<string, string>;
}

const COPY = {
  en: {
    title: 'Your AI-selected program',
    customBadge: 'Custom Build',
    recommendedBadge: 'AI Recommended',
    cta: 'Use this program',
    altCta: 'See other options',
    summary: (days: number, level: string, profile: string) =>
      `Built for ${days} day${days > 1 ? 's' : ''} per week, ${level} level, ${profile} profile.`,
  },
  ar: {
    title: '\u0627\u062e\u062a\u0631 \u0646\u0648\u0639 \u062e\u0637\u062a\u0643',
    customBadge: '\u0625\u0646\u0634\u0627\u0621 + \u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
    recommendedBadge: '\u0645\u0648\u0635\u0649 \u0628\u0647 \u0644\u0643',
    cta: '\u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    summary: (days: number, level: string, profile: string) =>
      `\u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 ${days} \u064a\u0648\u0645 \u062a\u062f\u0631\u064a\u0628\u060c \u0648\u0645\u0633\u062a\u0648\u0649 ${level}\u060c \u0648\u0645\u0644\u0641 ${profile}\u060c \u0647\u0630\u0647 \u0623\u0641\u0636\u0644 \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a \u0644\u0643.`,
  },
  it: {
    title: 'Scegli il tipo di piano',
    customBadge: 'Crea + feedback AI',
    recommendedBadge: 'Consigliato per te',
    cta: 'Prossimo passo',
    summary: (days: number, level: string, profile: string) =>
      `In base a ${days} giorn${days > 1 ? 'i' : 'o'} di allenamento, livello ${level} e profilo ${profile}, queste sono le opzioni migliori per te.`,
  },
  de: {
    title: 'Waehle deinen Plantyp',
    customBadge: 'Erstellen + KI-Feedback',
    recommendedBadge: 'Empfohlen fuer dich',
    cta: 'Naechster Schritt',
    summary: (days: number, level: string, profile: string) =>
      `Basierend auf ${days} Trainingstag${days > 1 ? 'en' : ''}, Level ${level} und Profil ${profile} sind das deine besten Optionen.`,
  },
  fr: {
    title: 'Choisis ton type de programme',
    customBadge: 'Creer + retour IA',
    recommendedBadge: 'Recommande pour toi',
    cta: 'Etape suivante',
    summary: (days: number, level: string, profile: string) =>
      `Avec ${days} jour${days > 1 ? 's' : ''} d entrainement, un niveau ${level} et un profil ${profile}, voici les options les plus adaptees.`,
  },
} as const;

const toTrainingDays = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(2, Math.min(6, Math.round(parsed)));
};

const recommendedSplitForDays = (days: number, recommendations?: Record<string, string>) => {
  const recommended = recommendations?.[String(days)];
  if (recommended) return recommended;
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'push_pull_legs';
};

const normalizeGoalTokens = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const includesAnyToken = (source: string[], candidates: string[]) =>
  candidates.some((candidate) => source.includes(candidate));

const resolveFemaleRecommendationKey = (onboardingData: any) => {
  const ids = Array.isArray(onboardingData?.athleteSubCategoryIds)
    ? onboardingData.athleteSubCategoryIds.flatMap((value: unknown) => normalizeGoalTokens(value))
    : [];
  const labels = [
    onboardingData?.athleteSubCategoryId,
    onboardingData?.athleteSubCategoryLabel,
    onboardingData?.athleteGoal,
    onboardingData?.athleteIdentityLabel,
  ].flatMap((value) => normalizeGoalTokens(value));
  const combined = [...ids, ...labels];

  if (
    includesAnyToken(combined, ['glutes', 'glute', 'booty'])
    || String(onboardingData?.athleteSubCategoryId || '').trim().toLowerCase() === 'glutes_focus'
  ) {
    return 'glutes';
  }
  if (
    includesAnyToken(combined, ['fat', 'loss', 'cardio', 'hiit', 'burn'])
    || ['fat_loss', 'hiit_fast_burn', 'wellness'].includes(String(onboardingData?.athleteSubCategoryId || '').trim().toLowerCase())
  ) {
    return 'fat_loss';
  }
  if (
    includesAnyToken(combined, ['tone', 'toning', 'silhouette', 'posture', 'beginner'])
    || ['toning', 'silhouette_posture', 'beginner_fitness'].includes(String(onboardingData?.athleteSubCategoryId || '').trim().toLowerCase())
  ) {
    return 'tone';
  }
  if (
    includesAnyToken(combined, ['muscle', 'strengthening', 'strength'])
    || String(onboardingData?.athleteSubCategoryId || '').trim().toLowerCase() === 'muscle_strengthening'
  ) {
    return 'muscle';
  }
  return null;
};

const resolveRecommendedSplit = (
  days: number,
  recommendations: Record<string, string> | undefined,
  onboardingData: any,
  availableOptionIds: string[],
) => {
  const gender = String(onboardingData?.gender || '').trim().toLowerCase();
  const isFemale = gender === 'female' || gender === 'woman' || gender === 'f';
  const isFitnessTrack = String(onboardingData?.athleteIdentityCategory || '').trim().toLowerCase() === 'fitness';
  const level = String(onboardingData?.experienceLevel || '').trim().toLowerCase();
  const isIntermediatePlus = level === 'intermediate' || level === 'advanced';

  let priority: string[] = [];

  if (isFemale && isFitnessTrack) {
    const femaleGoal = resolveFemaleRecommendationKey(onboardingData);
    if (days === 4 && isIntermediatePlus && (femaleGoal === 'glutes' || femaleGoal === 'tone' || femaleGoal === 'fat_loss')) {
      priority = ['hybrid', 'upper_lower', 'push_pull_legs', 'full_body', 'custom'];
    } else if (days === 5 && isIntermediatePlus && (femaleGoal === 'glutes' || femaleGoal === 'tone' || femaleGoal === 'fat_loss' || femaleGoal === 'muscle')) {
      priority = ['hybrid', 'upper_lower', 'push_pull_legs', 'full_body', 'custom'];
    } else if (days === 4) {
      priority = ['upper_lower', 'hybrid', 'full_body', 'push_pull_legs', 'custom'];
    } else if (days >= 6 && (femaleGoal === 'glutes' || femaleGoal === 'fat_loss' || femaleGoal === 'tone' || femaleGoal === 'muscle')) {
      priority = ['push_pull_legs', 'hybrid', 'upper_lower', 'full_body', 'custom'];
    } else if (femaleGoal === 'glutes') {
      priority = ['upper_lower', 'hybrid', 'push_pull_legs', 'full_body', 'custom'];
    } else if (femaleGoal === 'fat_loss') {
      priority = ['upper_lower', 'full_body', 'hybrid', 'push_pull_legs', 'custom'];
    } else if (femaleGoal === 'tone') {
      priority = ['upper_lower', 'full_body', 'hybrid', 'push_pull_legs', 'custom'];
    } else if (femaleGoal === 'muscle') {
      priority = ['upper_lower', 'push_pull_legs', 'hybrid', 'full_body', 'custom'];
    }
  }

  if (!priority.length) {
    priority = [recommendedSplitForDays(days, recommendations), 'upper_lower', 'push_pull_legs', 'hybrid', 'full_body', 'custom'];
  }

  return priority.find((optionId) => availableOptionIds.includes(optionId)) || availableOptionIds[0] || 'auto';
};

const PROFILE_COPY = {
  en: { male: 'male', female: 'female', unspecified: 'general' },
  ar: { male: '\u0630\u0643\u0631', female: '\u0623\u0646\u062b\u0649', unspecified: '\u0639\u0627\u0645' },
  it: { male: 'uomo', female: 'donna', unspecified: 'generale' },
  de: { male: 'Mann', female: 'Frau', unspecified: 'allgemein' },
  fr: { male: 'homme', female: 'femme', unspecified: 'general' },
} as const;

const FEMALE_SPLIT_COPY = {
  en: {
    auto: {
      summary: 'AI chooses the best women plan for your goal, level, and recovery.',
      detail: 'It can switch between glute-priority Upper / Lower, premium Hybrid, or glute-first Push / Pull / Legs when frequency is higher.',
    },
    upperLower: {
      summary: 'Default women split with glute-priority lower days and balanced upper shaping.',
      detail: 'Best for beginner to intermediate women training 4 days for glutes, body shaping, or fat loss with strong recovery.',
    },
    hybrid: {
      summary: 'Balanced women split with more variety and weekly volume.',
      detail: 'Good when you want a premium structure between classic Upper / Lower and high-frequency Push / Pull / Legs.',
    },
    hybrid4: {
      summary: 'Wow women plan: glutes strength, upper light, glutes pump, and lower-body mix.',
      detail: 'Best for intermediate to advanced women training 4 days for glutes growth, body shaping, or fat loss.',
    },
    hybrid5: {
      summary: 'Premium women hybrid: Push, Pull, Glutes, Upper, and Lower with better recovery.',
      detail: 'Best for intermediate to advanced women training 5 days for glutes growth, shaping, and performance-focused aesthetics.',
    },
    pushPullLegs: {
      summary: 'High-frequency women split with glute-first lower-body emphasis.',
      detail: 'Best for advanced women training 6 days and wanting more weekly volume without losing structure.',
    },
  },
  ar: {
    auto: {
      summary: 'الذكاء الاصطناعي يختار افضل خطة نسائية حسب الهدف والمستوى والتعافي.',
      detail: 'يمكنه الاختيار بين علوي / سفلي مع اولوية للغلوتس او Hybrid المميز او Push / Pull / Legs عند زيادة عدد الايام.',
    },
    upperLower: {
      summary: 'الخطة النسائية الاساسية مع اولوية للجزء السفلي وتوازن للجزء العلوي.',
      detail: 'مناسبة للمبتدئات الى المتوسطات مع 4 ايام تدريب لهدف الغلوتس او تشكيل الجسم او خسارة الدهون.',
    },
    hybrid: {
      summary: 'خطة نسائية متوازنة مع تنوع وحجم تدريبي اسبوعي افضل.',
      detail: 'مناسبة اذا كنت تريدين خيارا مميزا بين Upper / Lower و Push / Pull / Legs عالي التكرار.',
    },
    hybrid4: {
      summary: 'خطة WOW نسائية: غلوتس قوة، علوي خفيف، غلوتس ضخ، ثم Lower متكامل.',
      detail: 'مناسبة للنساء المتوسطات والمتقدمات مع 4 ايام تدريب لهدف تضخيم الغلوتس او تشكيل الجسم او خسارة الدهون.',
    },
    hybrid5: {
      summary: 'Hybrid نسائي مميز: Push ثم Pull ثم Glutes ثم Upper ثم Lower مع تعاف افضل.',
      detail: 'مناسب للنساء المتوسطات والمتقدمات مع 5 ايام تدريب لهدف الغلوتس وتشكيل الجسم والاداء الجمالي.',
    },
    pushPullLegs: {
      summary: 'خطة نسائية عالية التكرار مع اولوية للغلوتس والجزء السفلي.',
      detail: 'مناسبة للمتقدمات مع 6 ايام تدريب والرغبة في حجم تدريبي اكبر مع هيكل واضح.',
    },
  },
  it: {
    auto: {
      summary: 'L AI sceglie il miglior piano donna in base a obiettivo, livello e recupero.',
      detail: 'Puo passare tra Upper / Lower con priorita glutei, Hybrid premium o Push / Pull / Legs glute-first con piu giorni.',
    },
    upperLower: {
      summary: 'Split donna base con priorita lower body e upper bilanciato per tono e forma.',
      detail: 'Ideale per donne beginner o intermedie che si allenano 4 giorni per glutei, body shaping o fat loss.',
    },
    hybrid: {
      summary: 'Split donna bilanciato con piu varieta e piu volume settimanale.',
      detail: 'Ottimo se vuoi una struttura premium tra il classico Upper / Lower e Push / Pull / Legs ad alta frequenza.',
    },
    hybrid4: {
      summary: 'Wow plan donna: glutei forza, upper leggero, glutei pump e lower mix.',
      detail: 'Ideale per donne intermedie o avanzate che si allenano 4 giorni per glutei, body shaping o fat loss.',
    },
    hybrid5: {
      summary: 'Hybrid premium donna: Push, Pull, Glutes, Upper e Lower con recupero migliore.',
      detail: 'Ideale per donne intermedie o avanzate che si allenano 5 giorni per crescita glutei, shaping e performance estetica.',
    },
    pushPullLegs: {
      summary: 'Split donna ad alta frequenza con enfasi glute-first nella parte bassa.',
      detail: 'Ideale per donne avanzate che si allenano 6 giorni e vogliono piu volume senza perdere struttura.',
    },
  },
  de: {
    auto: {
      summary: 'Die KI waehlt den besten Frauenplan passend zu Ziel, Level und Erholung.',
      detail: 'Sie wechselt zwischen glute-fokussiertem Ober / Unter, Premium-Hybrid oder glute-first Push / Pull / Beine bei hoeherer Frequenz.',
    },
    upperLower: {
      summary: 'Standard-Frauenplan mit Unterkoerper-Prioritaet und ausgewogenem Oberkoerper fuer Form.',
      detail: 'Ideal fuer Beginner bis Intermediate Frauen mit 4 Trainingstagen und Zielen wie Glutes, Body Shaping oder Fettverlust.',
    },
    hybrid: {
      summary: 'Ausgewogener Frauen-Split mit mehr Abwechslung und Wochenvolumen.',
      detail: 'Gut, wenn du eine Premium-Struktur zwischen klassischem Ober / Unter und Push / Pull / Beine mit hoher Frequenz willst.',
    },
    hybrid4: {
      summary: 'Wow-Frauenplan: Glutes Strength, Upper Light, Glutes Pump und Lower Mix.',
      detail: 'Ideal fuer Intermediate bis Advanced Frauen mit 4 Trainingstagen fuer Glute-Wachstum, Body Shaping oder Fettverlust.',
    },
    hybrid5: {
      summary: 'Premium-Hybrid fuer Frauen: Push, Pull, Glutes, Upper und Lower mit besserer Erholung.',
      detail: 'Ideal fuer Intermediate bis Advanced Frauen mit 5 Trainingstagen fuer Glutes, Shaping und Performance plus Aesthetik.',
    },
    pushPullLegs: {
      summary: 'Frauen-Split mit hoher Frequenz und glute-first Fokus im Unterkoerper.',
      detail: 'Ideal fuer Advanced Frauen mit 6 Trainingstagen, die mehr Wochenvolumen und klare Struktur wollen.',
    },
  },
  fr: {
    auto: {
      summary: 'L IA choisit le meilleur programme femme selon ton objectif, ton niveau et ta recuperation.',
      detail: 'Elle peut choisir entre un Haut / Bas avec priorite glutes, un Hybrid premium, ou un Push / Pull / Jambes glute-first si tu t entraines plus souvent.',
    },
    upperLower: {
      summary: 'Programme femme par defaut avec priorite au bas du corps et haut du corps equilibre.',
      detail: 'Ideal pour les femmes debutantes a intermediaires qui s entrainent 4 jours pour les glutes, la silhouette ou la perte de graisse.',
    },
    hybrid: {
      summary: 'Programme femme equilibre avec plus de variete et de volume hebdomadaire.',
      detail: 'Parfait si tu veux une structure premium entre un Haut / Bas classique et un Push / Pull / Jambes plus frequent.',
    },
    hybrid4: {
      summary: 'Plan wow femme : force glutes, upper leger, glutes pump, puis lower complet.',
      detail: 'Ideal pour les femmes intermediaires a avancees qui s entrainent 4 jours pour les glutes, la silhouette ou la perte de graisse.',
    },
    hybrid5: {
      summary: 'Hybrid premium femme : Push, Pull, Glutes, Upper et Lower avec une meilleure recuperation.',
      detail: 'Ideal pour les femmes intermediaires a avancees qui s entrainent 5 jours pour les glutes, la silhouette et la performance esthetique.',
    },
    pushPullLegs: {
      summary: 'Programme femme haute frequence avec accent glute-first sur le bas du corps.',
      detail: 'Ideal pour les femmes avancees qui s entrainent 6 jours et veulent plus de volume sans perdre la structure.',
    },
  },
} as const;

const MALE_SPLIT_COPY = {
  en: {
    auto: {
      summary: 'AI chooses the best men plan for your goal, level, and recovery.',
      detail: 'It balances frequency, volume, and muscle-group focus to match your training profile.',
    },
    upperLower: {
      summary: 'Balanced men split for steady strength and size progress.',
      detail: 'Best for 4 training days when you want solid recovery with enough weekly volume.',
    },
    hybrid: {
      summary: 'Premium men split with more volume and more exercise variety.',
      detail: 'Great when you want a stronger structure between Upper / Lower and Push / Pull / Legs.',
    },
    pushPullLegs: {
      summary: 'Classic men split for higher frequency muscle growth and strength work.',
      detail: 'Best when you train 5 to 6 days and want focused sessions with strong weekly volume.',
    },
  },
  ar: {
    auto: {
      summary: 'الذكاء الاصطناعي يختار افضل خطة رجالية حسب الهدف والمستوى والتعافي.',
      detail: 'يوازن بين التكرار والحجم وتركيز العضلات ليتوافق مع ملفك التدريبي.',
    },
    upperLower: {
      summary: 'خطة رجالية متوازنة لتطور ثابت في القوة والكتلة.',
      detail: 'مناسبة لاربعة ايام تدريب عندما تريد تعافيا جيدا مع حجم اسبوعي كاف.',
    },
    hybrid: {
      summary: 'خطة رجالية مميزة مع حجم تدريبي اكبر وتنوع اكثر في التمارين.',
      detail: 'رائعة اذا كنت تريد هيكلا اقوى بين Upper / Lower و Push / Pull / Legs.',
    },
    pushPullLegs: {
      summary: 'الخطة الرجالية الكلاسيكية لتكرار اعلى وبناء عضل وقوة.',
      detail: 'مناسبة عندما تتدرب 5 الى 6 ايام وتريد جلسات مركزة مع حجم اسبوعي قوي.',
    },
  },
  it: {
    auto: {
      summary: 'L AI sceglie il miglior piano uomo in base a obiettivo, livello e recupero.',
      detail: 'Bilancia frequenza, volume e focus muscolare in base al tuo profilo di allenamento.',
    },
    upperLower: {
      summary: 'Split uomo bilanciato per progressi costanti in forza e massa.',
      detail: 'Ideale per 4 giorni di allenamento con buon recupero e volume settimanale solido.',
    },
    hybrid: {
      summary: 'Split uomo premium con piu volume e piu varieta di esercizi.',
      detail: 'Ottimo se vuoi una struttura piu forte tra Upper / Lower e Push / Pull / Legs.',
    },
    pushPullLegs: {
      summary: 'Split uomo classico per piu frequenza, crescita muscolare e forza.',
      detail: 'Ideale se ti alleni 5 o 6 giorni e vuoi sessioni mirate con forte volume settimanale.',
    },
  },
  de: {
    auto: {
      summary: 'Die KI waehlt den besten Maennerplan passend zu Ziel, Level und Erholung.',
      detail: 'Sie balanciert Frequenz, Volumen und Muskel-Fokus passend zu deinem Trainingsprofil.',
    },
    upperLower: {
      summary: 'Ausgewogener Maenner-Split fuer konstante Kraft- und Muskelzuwachse.',
      detail: 'Ideal fuer 4 Trainingstage mit guter Erholung und ausreichendem Wochenvolumen.',
    },
    hybrid: {
      summary: 'Premium-Maenner-Split mit mehr Volumen und mehr Trainingsvielfalt.',
      detail: 'Stark, wenn du eine festere Struktur zwischen Ober / Unter und Push / Pull / Beine willst.',
    },
    pushPullLegs: {
      summary: 'Klassischer Maenner-Split fuer hoehere Frequenz, Muskelaufbau und Kraft.',
      detail: 'Ideal bei 5 bis 6 Trainingstagen mit fokussierten Einheiten und starkem Wochenvolumen.',
    },
  },
  fr: {
    auto: {
      summary: 'L IA choisit le meilleur programme homme selon ton objectif, ton niveau et ta recuperation.',
      detail: 'Elle equilibre la frequence, le volume et le focus musculaire selon ton profil d entrainement.',
    },
    upperLower: {
      summary: 'Programme homme equilibre pour progresser regulierement en force et en masse.',
      detail: 'Ideal pour 4 jours d entrainement avec une bonne recuperation et assez de volume hebdomadaire.',
    },
    hybrid: {
      summary: 'Programme homme premium avec plus de volume et plus de variete.',
      detail: 'Parfait si tu veux une structure plus solide entre un Haut / Bas et un Push / Pull / Jambes.',
    },
    pushPullLegs: {
      summary: 'Le split homme classique pour plus de frequence, de muscle et de force.',
      detail: 'Ideal si tu t entraines 5 a 6 jours avec des seances ciblees et un gros volume hebdomadaire.',
    },
  },
} as const;

const personalizeSplitOptions = (
  options: SplitOption[],
  language: string,
  onboardingData: any,
  trainingDays: number,
) => {
  const gender = String(onboardingData?.gender || '').trim().toLowerCase();
  const isFemale = gender === 'female' || gender === 'woman' || gender === 'f';
  const isMale = gender === 'male' || gender === 'man' || gender === 'm';
  const isFitnessTrack = String(onboardingData?.athleteIdentityCategory || '').trim().toLowerCase() === 'fitness';

  if (!isFitnessTrack || (!isFemale && !isMale)) return options;

  if (isMale) {
    const copy = MALE_SPLIT_COPY[language as keyof typeof MALE_SPLIT_COPY] ?? MALE_SPLIT_COPY.en;

    return options.map((option) => {
      if (option.id === 'auto') {
        return { ...option, summary: copy.auto.summary, detail: copy.auto.detail };
      }

      if (option.id === 'upper_lower') {
        return { ...option, summary: copy.upperLower.summary, detail: copy.upperLower.detail };
      }

      if (option.id === 'hybrid') {
        return { ...option, summary: copy.hybrid.summary, detail: copy.hybrid.detail };
      }

      if (option.id === 'push_pull_legs') {
        return { ...option, summary: copy.pushPullLegs.summary, detail: copy.pushPullLegs.detail };
      }

      return option;
    });
  }

  const femaleGoal = resolveFemaleRecommendationKey(onboardingData);
  const level = String(onboardingData?.experienceLevel || '').trim().toLowerCase();
  const isIntermediatePlus = level === 'intermediate' || level === 'advanced';
  const copy = FEMALE_SPLIT_COPY[language as keyof typeof FEMALE_SPLIT_COPY] ?? FEMALE_SPLIT_COPY.en;

  return options.map((option) => {
    if (option.id === 'auto') {
      return { ...option, summary: copy.auto.summary, detail: copy.auto.detail };
    }

    if (option.id === 'upper_lower') {
      return { ...option, summary: copy.upperLower.summary, detail: copy.upperLower.detail };
    }

    if (option.id === 'hybrid') {
      const hybridCopy =
        trainingDays === 5 && isIntermediatePlus && ['glutes', 'tone', 'fat_loss', 'muscle'].includes(String(femaleGoal || ''))
          ? copy.hybrid5
          : trainingDays === 4 && isIntermediatePlus && ['glutes', 'tone', 'fat_loss'].includes(String(femaleGoal || ''))
            ? copy.hybrid4
            : copy.hybrid;
      return { ...option, summary: hybridCopy.summary, detail: hybridCopy.detail };
    }

    if (option.id === 'push_pull_legs') {
      return { ...option, summary: copy.pushPullLegs.summary, detail: copy.pushPullLegs.detail };
    }

    return option;
  });
};

export function WorkoutSplitScreen({
  onNext,
  onDataChange,
  onboardingData,
  options,
  recommendedByDays,
}: WorkoutSplitScreenProps) {
  const language = getOnboardingLanguage();
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en;
  const profileCopy = PROFILE_COPY[language as keyof typeof PROFILE_COPY] ?? PROFILE_COPY.en;
  const splitOptions = options?.length
    ? options
    : DEFAULT_ONBOARDING_CONFIG.options.workoutSplit;
  const trainingDays = toTrainingDays(onboardingData?.workoutDays);
  const localizedOptions = useMemo(
    () => personalizeSplitOptions(
      localizeWorkoutSplitOptions(splitOptions, language),
      language,
      onboardingData,
      trainingDays,
    ),
    [language, onboardingData, splitOptions, trainingDays],
  );
  const splitRecommendations = recommendedByDays || DEFAULT_ONBOARDING_CONFIG.splitRecommendations;
  const levelLabel = localizeExperienceLevel(
    String(onboardingData?.experienceLevel || 'intermediate').trim(),
    language,
  ).toLowerCase();
  const genderLabel = String(onboardingData?.gender || 'unspecified').trim().toLowerCase();
  const profileLabel = genderLabel === 'male'
    ? profileCopy.male
    : genderLabel === 'female'
      ? profileCopy.female
      : profileCopy.unspecified;

  const availableOptions = useMemo(
    () => localizedOptions.filter((option) => option.days.includes(trainingDays)),
    [localizedOptions, trainingDays],
  );
  const recommendedId = useMemo(
    () =>
      resolveRecommendedSplit(
        trainingDays,
        splitRecommendations,
        onboardingData,
        availableOptions.map((option) => option.id),
      ),
    [availableOptions, onboardingData, splitRecommendations, trainingDays],
  );

  const initialSelection = useMemo(() => {
    const saved = String(onboardingData?.workoutSplitPreference || '').trim().toLowerCase();
    if (availableOptions.some((option) => option.id === saved)) return saved;
    if (availableOptions.some((option) => option.id === recommendedId)) return recommendedId;
    if (availableOptions.some((option) => option.id === 'auto')) return 'auto';
    return availableOptions[0]?.id || 'auto';
  }, [availableOptions, onboardingData?.workoutSplitPreference, recommendedId]);

  const [selectedId, setSelectedId] = useState(initialSelection);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const persistSelection = (optionId: string) => {
    const selectedOption = availableOptions.find((option) => option.id === optionId);
    if (!selectedOption) return;
    onDataChange?.({
      workoutSplitPreference: selectedOption.id,
      workoutSplitLabel: selectedOption.title,
      ...(optionId !== 'auto'
        ? {
            aiTrainingFocus: '',
            aiLimitations: '',
            aiRecoveryPriority: '',
            aiEquipmentNotes: '',
          }
        : {}),
    });
    return selectedOption;
  };

  const advanceToNextStep = () => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => onNext(), 0);
      return;
    }
    onNext();
  };

  const recommendedOption = availableOptions.find((option) => option.id === recommendedId);
  const alternativeOptions = availableOptions.filter((option) => option.id !== recommendedId);

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-light text-white">{copy.title}</h2>
        <p className="text-text-secondary">{copy.summary(trainingDays, levelLabel, profileLabel)}</p>
      </div>

      <div className="space-y-3">
        {recommendedOption && (
          <button
            type="button"
            onClick={() => {
              setSelectedId(recommendedOption.id);
              persistSelection(recommendedOption.id);
            }}
            className="w-full rounded-xl border border-accent/40 bg-accent/12 p-4 text-left transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                  {copy.recommendedBadge}
                </span>
                <p className="text-sm font-semibold text-white">{recommendedOption.title}</p>
                <p className="text-xs text-text-secondary">{recommendedOption.summary}</p>
                <p className="text-[11px] text-text-tertiary">{recommendedOption.detail}</p>
              </div>
              <SelectionCheck selected={selectedId === recommendedOption.id} className="mt-0.5 shrink-0" />
            </div>
          </button>
        )}

        {showAlternatives && alternativeOptions.length > 0 && (
          <div className="space-y-3">
            {alternativeOptions.map((option) => {
              const isSelected = selectedId === option.id;
              const isRecommended = option.id === recommendedId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(option.id);
                    const selectedOption = persistSelection(option.id);
                    if (option.id === 'custom' && selectedOption) {
                      advanceToNextStep();
                    }
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'bg-accent/12 border-accent text-white'
                      : 'bg-card border-white/10 text-text-secondary hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      {option.id === 'custom' && (
                        <span className="inline-flex items-center rounded-full bg-accent/20 text-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {copy.customBadge}
                        </span>
                      )}
                      {isRecommended && (
                        <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                          {copy.recommendedBadge}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-white">{option.title}</p>
                      <p className="text-xs text-text-secondary">{option.summary}</p>
                      <p className="text-[11px] text-text-tertiary">{option.detail}</p>
                    </div>
                    <SelectionCheck selected={isSelected} className="mt-0.5 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="space-y-3">
        {!showAlternatives && alternativeOptions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAlternatives(true)}
            className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary transition-colors hover:border-accent/30 hover:bg-white/10"
          >
            {copy.altCta}
          </button>
        )}
        <Button
          onClick={() => {
            const selectedOption = persistSelection(selectedId);
            if (!selectedOption) return;
            if (selectedOption.id === 'custom') {
              advanceToNextStep();
              return;
            }
            onNext();
          }}
          disabled={!selectedId}
        >
          {copy.cta}
        </Button>
      </div>

      <div className="flex-1" />
    </div>
  );
}
