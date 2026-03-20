import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';
import type {
  AthleteOption,
  GoalOption,
  MotivationOption,
  PlanOption,
  SelectOption,
  SimpleOption,
  SplitOption,
  OnboardingStepId,
} from '../../config/onboardingConfig';

export const getOnboardingLanguage = (): AppLanguage => {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('onboardingData');
      if (raw) {
        const parsed = JSON.parse(raw) as { language?: unknown };
        const saved = String(parsed?.language || '').trim().toLowerCase();
        if (saved === 'en' || saved === 'ar' || saved === 'it' || saved === 'de') {
          return saved;
        }
      }
    } catch {
      // Ignore malformed onboarding drafts and keep the current app language.
    }
  }

  const active = getActiveLanguage();
  return active || getStoredLanguage();
};

export const isArabicLanguage = (language: AppLanguage) => language === 'ar';

const STEP_TITLES_AR: Partial<Record<OnboardingStepId, string>> = {
  language: 'اللغة',
  first_name: 'الاسم الأول',
  app_motivation: 'الدافع',
  athlete_identity: 'أنا',
  personal_info: 'البيانات الشخصية',
  fitness_background: 'الخلفية التدريبية',
  fitness_goals: 'أهداف اللياقة',
  body_type: 'نوع الجسم',
  goals_availability: 'الوقت المتاح',
  workout_split: 'اختيار الخطة',
  ai_plan_tuning: 'تفضيلات الذكاء الاصطناعي',
  body_image_upload: 'صور الجسم',
  ai_analysis: 'التحليل',
  body_results: 'النتائج',
  custom_plan: 'تخصيص الخطة',
  custom_plan_builder: 'قوالب الخطة',
  custom_plan_advice: 'نصائح الذكاء الاصطناعي',
  custom_plan_templates: 'قوالب الخطة',
  sport_age_gender: 'العمر والجنس',
  sport_experience: 'خبرة الرياضة',
  sport_plan_choice: 'اختيار الخطة',
};

const STEP_TITLES_IT: Partial<Record<OnboardingStepId, string>> = {
  language: 'Lingua',
  first_name: 'Nome',
  app_motivation: 'Motivazione',
  athlete_identity: 'Profilo',
  personal_info: 'Dati personali',
  fitness_background: 'Livello fitness',
  fitness_goals: 'Obiettivi fitness',
  body_type: 'Tipo di corpo',
  goals_availability: 'Disponibilita',
  workout_split: 'Scelta del piano',
  ai_plan_tuning: 'Preferenze AI',
  body_image_upload: 'Foto del corpo',
  ai_analysis: 'Analisi',
  body_results: 'Risultati',
  custom_plan: 'Piano personalizzato',
  custom_plan_builder: 'Struttura piano',
  custom_plan_advice: 'Consigli AI',
  custom_plan_templates: 'Modelli piano',
  sport_age_gender: 'Eta e genere',
  sport_experience: 'Esperienza sportiva',
  sport_plan_choice: 'Scelta del piano',
};

const STEP_TITLES_DE: Partial<Record<OnboardingStepId, string>> = {
  language: 'Sprache',
  first_name: 'Vorname',
  app_motivation: 'Motivation',
  athlete_identity: 'Profil',
  personal_info: 'Persoenliche Daten',
  fitness_background: 'Fitness-Level',
  fitness_goals: 'Fitnessziele',
  body_type: 'Koerpertyp',
  goals_availability: 'Verfuegbarkeit',
  workout_split: 'Planwahl',
  ai_plan_tuning: 'KI-Einstellungen',
  body_image_upload: 'Koerperfotos',
  ai_analysis: 'Analyse',
  body_results: 'Ergebnisse',
  custom_plan: 'Individueller Plan',
  custom_plan_builder: 'Planaufbau',
  custom_plan_advice: 'KI-Tipps',
  custom_plan_templates: 'Planvorlagen',
  sport_age_gender: 'Alter und Geschlecht',
  sport_experience: 'Sporterfahrung',
  sport_plan_choice: 'Planwahl',
};

export const resolveOnboardingTitle = (
  stepId: OnboardingStepId,
  fallback: string,
  language: AppLanguage,
) => {
  if (language === 'ar') return STEP_TITLES_AR[stepId] ?? fallback;
  if (language === 'it') return STEP_TITLES_IT[stepId] ?? fallback;
  if (language === 'de') return STEP_TITLES_DE[stepId] ?? fallback;
  return fallback;
};

const APP_MOTIVATION_AR: Record<string, { title: string; description: string }> = {
  guided_start: {
    title: 'أريد إرشادًا واضحًا من اليوم الأول',
    description: 'أعطني خطة واضحة لأعرف ماذا أفعل في كل جلسة.',
  },
  consistency: {
    title: 'أحتاج مساعدة للاستمرار بانتظام',
    description: 'ابنِ لي روتينًا واقعيًا يمكنني الالتزام به كل أسبوع.',
  },
  progress_plateau: {
    title: 'أنا عالق وأريد تقدمًا أفضل',
    description: 'ساعدني على كسر الثبات ببرمجة أذكى.',
  },
  time_efficiency: {
    title: 'أريد تمارين فعّالة تناسب جدولي',
    description: 'اجعل الجلسات مركزة ومناسبة للوقت المتاح.',
  },
  accountability: {
    title: 'أريد المساءلة والمتابعة',
    description: 'تتبّع تدريبي وابقِني على المسار على المدى الطويل.',
  },
};

const APP_MOTIVATION_IT: Record<string, { title: string; description: string }> = {
  guided_start: {
    title: 'Voglio una guida chiara fin dal primo giorno',
    description: 'Dammi un piano semplice e chiaro per sapere cosa fare in ogni sessione.',
  },
  consistency: {
    title: 'Ho bisogno di aiuto per essere costante',
    description: 'Costruiamo una routine realistica che riesca a seguire ogni settimana.',
  },
  progress_plateau: {
    title: 'Mi sento bloccato e voglio progredire',
    description: 'Aiutami a superare lo stallo con una programmazione piu intelligente.',
  },
  time_efficiency: {
    title: 'Voglio allenamenti efficaci per il mio tempo',
    description: 'Rendi le mie sessioni piu mirate e adatte ai miei orari.',
  },
  accountability: {
    title: 'Voglio piu responsabilita e continuita',
    description: 'Tieni traccia dei miei allenamenti e aiutami a restare sulla strada giusta.',
  },
};

const APP_MOTIVATION_DE: Record<string, { title: string; description: string }> = {
  guided_start: {
    title: 'Ich moechte von Anfang an klare Anleitung',
    description: 'Gib mir einen klaren Plan, damit ich in jeder Einheit weiss, was ich tun soll.',
  },
  consistency: {
    title: 'Ich brauche Hilfe, um konstant zu bleiben',
    description: 'Erstelle eine realistische Routine, die ich jede Woche einhalten kann.',
  },
  progress_plateau: {
    title: 'Ich stecke fest und will wieder Fortschritt',
    description: 'Hilf mir, mein Plateau mit kluegerer Planung zu durchbrechen.',
  },
  time_efficiency: {
    title: 'Ich will effiziente Workouts fuer meinen Alltag',
    description: 'Mach meine Einheiten fokussierter und passend zu meinem Zeitplan.',
  },
  accountability: {
    title: 'Ich will mehr Verbindlichkeit und Begleitung',
    description: 'Verfolge mein Training und hilf mir, langfristig dranzubleiben.',
  },
};

export const localizeMotivationOptions = (
  options: MotivationOption[],
  language: AppLanguage,
) => {
  if (language === 'it') {
    return options.map((option) => {
      const it = APP_MOTIVATION_IT[option.id];
      if (!it) return option;
      return { ...option, title: it.title, description: it.description };
    });
  }
  if (language === 'de') {
    return options.map((option) => {
      const de = APP_MOTIVATION_DE[option.id];
      if (!de) return option;
      return { ...option, title: de.title, description: de.description };
    });
  }
  if (language !== 'ar') return options;
  return options.map((option) => {
    const ar = APP_MOTIVATION_AR[option.id];
    if (!ar) return option;
    return { ...option, title: ar.title, description: ar.description };
  });
};

const ATHLETE_IDENTITY_AR: Record<string, {
  label: string;
  description: string;
  subGroups?: Record<string, { title: string; items: Record<string, string> }>;
}> = {
  bodybuilding: {
    label: 'كمال الأجسام',
    description: 'بناء حجم العضلات والتناسق والقوة التي تبرز الشكل.',
    subGroups: {
      bodybuilding_category: {
        title: 'حسب الفئة',
        items: {
          hypertrophy: 'التضخيم العضلي',
          powerlifting: 'باورلفتينغ',
          cutting: 'تنشيف',
          bulking: 'تضخيم',
          beginner_gym: 'مبتدئ في النادي',
          natural_athlete: 'رياضي طبيعي',
          classic_physique: 'كلاسيك فيزيك',
        },
      },
    },
  },
  cardio: {
    label: 'كارديو',
    description: 'تحسين اللياقة العامة والتحمل وحرق السعرات بشكل متوازن.',
    subGroups: {
      cardio_goal: {
        title: 'حسب التركيز',
        items: {
          fat_loss: 'حرق الدهون',
          endurance: 'التحمل',
          conditioning: 'التهيئة البدنية',
          heart_health: 'صحة القلب',
        },
      },
    },
  },
  football: {
    label: 'كرة القدم',
    description: 'حسّن السرعة والرشاقة والقوة وتحمل المباريات.',
    subGroups: {
      football_position: {
        title: 'حسب المركز',
        items: {
          striker: 'مهاجم',
          winger: 'جناح',
          midfielder: 'لاعب وسط',
          defender: 'مدافع',
          goalkeeper: 'حارس مرمى',
        },
      },
      football_goal: {
        title: 'حسب هدف التدريب',
        items: {
          speed_acceleration: 'السرعة والتسارع',
          match_endurance: 'تحمل المباريات',
          shooting_power: 'قوة التسديد',
          injury_prevention: 'الوقاية من الإصابات',
          strength_duels: 'القوة والالتحامات',
        },
      },
      football_phase: {
        title: 'حسب مرحلة الموسم (ميزة احترافية جدًا)',
        items: {
          pre_season: 'ما قبل الموسم',
          in_season: 'أثناء الموسم',
          off_season: 'خارج الموسم',
        },
      },
    },
  },
  basketball: {
    label: 'كرة السلة',
    description: 'درّب الانفجار والقفزة العمودية ولياقة الملعب.',
    subGroups: {
      basketball_role: {
        title: 'حسب الدور',
        items: {
          guard: 'لاعب خلفي',
          forward: 'جناح',
          center: 'لاعب ارتكاز',
        },
      },
      basketball_goal: {
        title: 'حسب الهدف',
        items: {
          vertical_jump: 'القفز العمودي',
          explosive_speed: 'السرعة الانفجارية',
          lateral_agility: 'الرشاقة الجانبية',
          knee_injury_prevention: 'الوقاية من إصابات الركبة',
          core_stability: 'ثبات الجذع',
        },
      },
      basketball_phase: {
        title: 'حسب المرحلة',
        items: {
          pre_season: 'ما قبل الموسم',
          in_season: 'أثناء الموسم',
          off_season: 'خارج الموسم',
        },
      },
    },
  },
  handball: {
    label: 'كرة اليد',
    description: 'عزّز القوة الدورانية والتسارع والقدرة على التكرار.',
    subGroups: {
      handball_position: {
        title: 'حسب المركز',
        items: {
          wing: 'جناح',
          backcourt: 'لاعب خلفي',
          pivot: 'محور',
          goalkeeper: 'حارس مرمى',
        },
      },
      handball_goal: {
        title: 'حسب الهدف',
        items: {
          throwing_power: 'قوة الرمي',
          jump_explosiveness: 'انفجار القفز',
          shoulder_strength: 'قوة الكتف',
          sprint_endurance: 'تحمل السرعات',
        },
      },
      handball_phase: {
        title: 'حسب المرحلة',
        items: {
          pre_season: 'ما قبل الموسم',
          in_season: 'أثناء الموسم',
          off_season: 'خارج الموسم',
        },
      },
    },
  },
  swimming: {
    label: 'السباحة',
    description: 'طوّر تحمل الجسم بالكامل وسعة الرئة والتحكم.',
    subGroups: {
      swimming_stroke: {
        title: 'حسب النوع',
        items: {
          freestyle: 'حرة',
          breaststroke: 'صدر',
          butterfly: 'فراشة',
          backstroke: 'ظهر',
        },
      },
      swimming_goal: {
        title: 'حسب الهدف',
        items: {
          shoulder_mobility: 'مرونة الكتف',
          core_endurance: 'تحمل الجذع',
          breathing_capacity: 'سعة التنفس',
          technique_strength: 'قوة التقنية',
        },
      },
      swimming_phase: {
        title: 'حسب المرحلة',
        items: {
          conditioning_phase: 'مرحلة الإعداد',
          competition_phase: 'مرحلة المنافسة',
          recovery_phase: 'مرحلة التعافي',
        },
      },
    },
  },
  combat_sports: {
    label: 'رياضات قتالية',
    description: 'ابنِ التحمل وسرعة رد الفعل والقوة الوظيفية.',
    subGroups: {
      combat_sport_type: {
        title: 'حسب نوع الرياضة',
        items: {
          boxing: 'ملاكمة',
          mma: 'فنون قتالية مختلطة',
          muay_thai: 'مواي تاي',
          wrestling: 'مصارعة',
          judo: 'جودو',
        },
      },
      combat_goal: {
        title: 'حسب الهدف',
        items: {
          power_endurance: 'تحمل القوة',
          speed_reaction: 'السرعة وردة الفعل',
          weight_cut_conditioning: 'تهيئة خفض الوزن',
          neck_core_strength: 'قوة الرقبة والجذع',
        },
      },
      combat_phase: {
        title: 'حسب المرحلة',
        items: {
          fight_camp: 'معسكر القتال',
          off_camp: 'خارج المعسكر',
          recovery: 'التعافي',
        },
      },
    },
  },
};

export const localizeAthleteOptions = (options: AthleteOption[], language: AppLanguage) => {
  if (language !== 'ar') return options;
  return options.map((option) => {
    const ar = ATHLETE_IDENTITY_AR[option.id];
    if (!ar) return option;
    return {
      ...option,
      label: ar.label || option.label,
      description: ar.description || option.description,
      subGroups: option.subGroups.map((group) => {
        const groupAr = ar.subGroups?.[group.id];
        return {
          ...group,
          title: groupAr?.title || group.title,
          items: group.items.map((item) => ({
            ...item,
            label: groupAr?.items?.[item.id] || item.label,
          })),
        };
      }),
    };
  });
};

const FITNESS_GOALS_AR: Record<string, { title: string; description: string; tag?: string }> = {
  build_muscle_toned: {
    title: 'بناء العضلات وشد الجسم',
    description:
      'ركز على نمو العضلات وشد الجسم. نفّذ مجموعات هرمية لرفع الأوزان في كل تمرين.',
    tag: 'شائع',
  },
  general_fitness: {
    title: 'تحسين اللياقة العامة',
    description:
      'حسّن لياقتك العامة عبر رفع أوزان ثابتة وتعلّم تمارين جديدة.',
  },
  conditioning: {
    title: 'رفع مستوى التحمل',
    description:
      'ركز على تكرارات أعلى وأوزان أقل عبر سوبرسِت سريعة لرفع التحمل.',
  },
  get_stronger: {
    title: 'زيادة القوة',
    description:
      'ركز على التمارين المركبة وارفَع أوزانًا أثقل بتكرارات أقل.',
    tag: 'باورلفتينغ',
  },
};

const FITNESS_GOALS_IT: Record<string, { title: string; description: string; tag?: string }> = {
  build_muscle_toned: {
    title: 'Costruire muscoli e definizione',
    description: 'Concentrati su crescita muscolare e tono con progressioni chiare e costanti.',
    tag: 'Popolare',
  },
  general_fitness: {
    title: 'Migliorare la forma generale',
    description: 'Aumenta la forma fisica generale con allenamenti equilibrati e nuove abilita.',
  },
  conditioning: {
    title: 'Migliorare la resistenza',
    description: 'Punta su piu volume, ritmo e recuperi piu brevi per aumentare la resistenza.',
  },
  get_stronger: {
    title: 'Diventare piu forte',
    description: 'Dai priorita ai multiarticolari e a carichi piu alti con meno ripetizioni.',
    tag: 'Forza',
  },
};

const FITNESS_GOALS_DE: Record<string, { title: string; description: string; tag?: string }> = {
  build_muscle_toned: {
    title: 'Muskeln aufbauen und definieren',
    description: 'Konzentriere dich auf Muskelaufbau und Definition mit klarer Progression.',
    tag: 'Beliebt',
  },
  general_fitness: {
    title: 'Allgemeine Fitness verbessern',
    description: 'Verbessere deine Gesamtfitness mit ausgewogenem Training und neuen Uebungen.',
  },
  conditioning: {
    title: 'Ausdauer steigern',
    description: 'Mehr Volumen, Tempo und kuerzere Pausen fuer bessere Kondition.',
  },
  get_stronger: {
    title: 'Staerker werden',
    description: 'Fokussiere dich auf Grunduebungen und hoehere Lasten mit weniger Wiederholungen.',
    tag: 'Kraft',
  },
};

export const localizeFitnessGoals = (options: GoalOption[], language: AppLanguage) => {
  if (language === 'it') {
    return options.map((option) => {
      const it = FITNESS_GOALS_IT[option.id];
      if (!it) return option;
      return {
        ...option,
        title: it.title || option.title,
        description: it.description || option.description,
        tag: it.tag ?? option.tag,
      };
    });
  }
  if (language === 'de') {
    return options.map((option) => {
      const de = FITNESS_GOALS_DE[option.id];
      if (!de) return option;
      return {
        ...option,
        title: de.title || option.title,
        description: de.description || option.description,
        tag: de.tag ?? option.tag,
      };
    });
  }
  if (language !== 'ar') return options;
  return options.map((option) => {
    const ar = FITNESS_GOALS_AR[option.id];
    if (!ar) return option;
    return {
      ...option,
      title: ar.title || option.title,
      description: ar.description || option.description,
      tag: ar.tag ?? option.tag,
    };
  });
};

const WORKOUT_SPLIT_AR: Record<string, { title: string; summary: string; detail: string }> = {
  auto: {
    title: 'خطة المدرب بالذكاء الاصطناعي',
    summary: 'إنشاء خطة شخصية بالكامل باستخدام Claude AI',
    detail: 'تستخدم ملفك وتفضيلاتك لبناء خطة منظمة لمدة 8 أسابيع.',
  },
  full_body: {
    title: 'تركيز كامل للجسم',
    summary: 'درّب كل المجموعات العضلية الرئيسية في كل جلسة',
    detail: 'مناسب للأيام القليلة وتقدم ثابت أسبوعيًا.',
  },
  upper_lower: {
    title: 'علوي / سفلي',
    summary: 'بدّل بين أيام الجزء العلوي والسفلي',
    detail: 'هيكل متوازن مع تعافٍ جيد بين الجلسات.',
  },
  push_pull_legs: {
    title: 'دفع / سحب / أرجل',
    summary: 'تقسيم قائم على الحركة مع أيام مركزة',
    detail: 'الأفضل لأسابيع التدريب المتوسطة إلى العالية.',
  },
  hybrid: {
    title: 'دفع/سحب/أرجل + علوي/سفلي',
    summary: 'مزيج PPL وعلوي/سفلي لمزيد من الحجم',
    detail: 'مثالي لمن يريد تنوعًا أكبر وحملًا أسبوعيًا متوازنًا.',
  },
  custom: {
    title: 'خطة مخصصة',
    summary: 'ابنِ تقسيمة حسب أولوياتك',
    detail: 'مصممة للمتقدمين الذين يريدون تحكمًا كاملًا بالبنية والحجم.',
  },
};

const WORKOUT_SPLIT_IT: Record<string, { title: string; summary: string; detail: string }> = {
  auto: {
    title: 'Piano del coach con AI',
    summary: 'Crea un piano personale completo con Claude AI',
    detail: 'Usa il tuo profilo e le tue preferenze per costruire un piano strutturato di 8 settimane.',
  },
  full_body: {
    title: 'Total body',
    summary: 'Allena tutti i principali gruppi muscolari in ogni sessione',
    detail: 'Ottimo se ti alleni pochi giorni e vuoi progressi costanti.',
  },
  upper_lower: {
    title: 'Parte alta / parte bassa',
    summary: 'Alterna giorni upper e lower per un buon equilibrio',
    detail: 'Struttura bilanciata con recupero solido tra le sessioni.',
  },
  push_pull_legs: {
    title: 'Spinta / Trazione / Gambe',
    summary: 'Divisione per movimenti con giorni piu mirati',
    detail: 'Ideale per settimane di allenamento intermedie o avanzate.',
  },
  hybrid: {
    title: 'PPL + Upper / Lower',
    summary: 'Combina PPL e upper/lower per piu volume',
    detail: 'Ideale se vuoi piu varieta e un carico settimanale equilibrato.',
  },
  custom: {
    title: 'Piano personalizzato',
    summary: 'Costruisci una divisione in base alle tue priorita',
    detail: 'Pensato per chi vuole controllo completo su struttura e volume.',
  },
};

const WORKOUT_SPLIT_DE: Record<string, { title: string; summary: string; detail: string }> = {
  auto: {
    title: 'KI-Coach-Plan',
    summary: 'Erstelle mit Claude AI einen voll personalisierten Plan',
    detail: 'Nutzt dein Profil und deine Vorlieben fuer einen strukturierten 8-Wochen-Plan.',
  },
  full_body: {
    title: 'Ganzkoerper',
    summary: 'Trainiere in jeder Einheit alle wichtigen Muskelgruppen',
    detail: 'Ideal bei wenigen Trainingstagen und fuer stetigen Fortschritt.',
  },
  upper_lower: {
    title: 'Oberkoerper / Unterkoerper',
    summary: 'Wechsle zwischen Ober- und Unterkoerper-Tagen',
    detail: 'Ausgewogene Struktur mit guter Erholung zwischen den Einheiten.',
  },
  push_pull_legs: {
    title: 'Push / Pull / Beine',
    summary: 'Bewegungsbasierter Split mit fokussierten Tagen',
    detail: 'Am besten fuer mittlere bis hohe Trainingsfrequenz.',
  },
  hybrid: {
    title: 'Push/Pull/Beine + Ober/Unter',
    summary: 'Kombiniert PPL und Ober/Unter fuer mehr Volumen',
    detail: 'Ideal fuer mehr Abwechslung und ausgewogene Wochenbelastung.',
  },
  custom: {
    title: 'Individueller Plan',
    summary: 'Baue einen Split nach deinen Prioritaeten',
    detail: 'Fuer Fortgeschrittene, die volle Kontrolle ueber Struktur und Volumen wollen.',
  },
};

export const localizeWorkoutSplitOptions = (options: SplitOption[], language: AppLanguage) => {
  if (language === 'it') {
    return options.map((option) => {
      const it = WORKOUT_SPLIT_IT[option.id];
      if (!it) return option;
      return { ...option, title: it.title, summary: it.summary, detail: it.detail };
    });
  }
  if (language === 'de') {
    return options.map((option) => {
      const de = WORKOUT_SPLIT_DE[option.id];
      if (!de) return option;
      return { ...option, title: de.title, summary: de.summary, detail: de.detail };
    });
  }
  if (language !== 'ar') return options;
  return options.map((option) => {
    const ar = WORKOUT_SPLIT_AR[option.id];
    if (!ar) return option;
    return {
      ...option,
      title: ar.title || option.title,
      summary: ar.summary || option.summary,
      detail: ar.detail || option.detail,
    };
  });
};

const SPORT_PLAN_AR: Record<string, { title: string; description: string }> = {
  auto: {
    title: 'إنشاء خطة تدريب بالذكاء الاصطناعي',
    description: 'يبني الذكاء الاصطناعي خطتك وفقًا لملفك وأهدافك الرياضية.',
  },
  custom: {
    title: 'خطة شخصية مخصصة',
    description: 'عرّف هيكل خطتك بنفسك ثم طوّرها وحدثها.',
  },
};

const SPORT_PLAN_IT: Record<string, { title: string; description: string }> = {
  auto: {
    title: 'Crea piano con AI',
    description: 'L AI costruisce il tuo piano in base al profilo e agli obiettivi sportivi.',
  },
  custom: {
    title: 'Piano manuale personalizzato',
    description: 'Definisci tu la struttura del piano e poi migliorala nel tempo.',
  },
};

const SPORT_PLAN_DE: Record<string, { title: string; description: string }> = {
  auto: {
    title: 'Plan mit KI erstellen',
    description: 'Die KI erstellt deinen Plan nach Profil und sportlichen Zielen.',
  },
  custom: {
    title: 'Manueller individueller Plan',
    description: 'Lege deine Struktur selbst fest und verfeinere sie spaeter weiter.',
  },
};

export const localizeSportPlanOptions = (options: PlanOption[], language: AppLanguage) => {
  if (language === 'it') {
    return options.map((option) => {
      const it = SPORT_PLAN_IT[option.id];
      if (!it) return option;
      return { ...option, title: it.title, description: it.description };
    });
  }
  if (language === 'de') {
    return options.map((option) => {
      const de = SPORT_PLAN_DE[option.id];
      if (!de) return option;
      return { ...option, title: de.title, description: de.description };
    });
  }
  if (language !== 'ar') return options;
  return options.map((option) => {
    const ar = SPORT_PLAN_AR[option.id];
    if (!ar) return option;
    return { ...option, title: ar.title, description: ar.description };
  });
};

const TRAINING_FOCUS_AR: Record<string, string> = {
  balanced: 'متوازن',
  hypertrophy: 'تركيز نمو العضلات',
  strength: 'تركيز القوة',
  fat_loss: 'دعم خسارة الدهون',
};

const TRAINING_FOCUS_IT: Record<string, string> = {
  balanced: 'Bilanciato',
  hypertrophy: 'Focus ipertrofia',
  strength: 'Focus forza',
  fat_loss: 'Supporto perdita di grasso',
};

const TRAINING_FOCUS_DE: Record<string, string> = {
  balanced: 'Ausgewogen',
  hypertrophy: 'Muskelaufbau-Fokus',
  strength: 'Kraft-Fokus',
  fat_loss: 'Fettverlust-Unterstuetzung',
};

const RECOVERY_PRIORITY_AR: Record<string, string> = {
  balanced: 'متوازن',
  performance: 'دفع التقدم',
  recovery: 'تعافٍ محافظ',
};

const RECOVERY_PRIORITY_IT: Record<string, string> = {
  balanced: 'Bilanciato',
  performance: 'Spingi i progressi',
  recovery: 'Recupero prudente',
};

const RECOVERY_PRIORITY_DE: Record<string, string> = {
  balanced: 'Ausgewogen',
  performance: 'Fortschritt pushen',
  recovery: 'Erholung priorisieren',
};

export const localizeTrainingFocusOptions = (options: SimpleOption[], language: AppLanguage) => {
  if (language === 'it') {
    return options.map((option) => ({
      ...option,
      label: TRAINING_FOCUS_IT[option.value] || option.label,
    }));
  }
  if (language === 'de') {
    return options.map((option) => ({
      ...option,
      label: TRAINING_FOCUS_DE[option.value] || option.label,
    }));
  }
  if (language !== 'ar') return options;
  return options.map((option) => ({
    ...option,
    label: TRAINING_FOCUS_AR[option.value] || option.label,
  }));
};

export const localizeRecoveryOptions = (options: SimpleOption[], language: AppLanguage) => {
  if (language === 'it') {
    return options.map((option) => ({
      ...option,
      label: RECOVERY_PRIORITY_IT[option.value] || option.label,
    }));
  }
  if (language === 'de') {
    return options.map((option) => ({
      ...option,
      label: RECOVERY_PRIORITY_DE[option.value] || option.label,
    }));
  }
  if (language !== 'ar') return options;
  return options.map((option) => ({
    ...option,
    label: RECOVERY_PRIORITY_AR[option.value] || option.label,
  }));
};

const GENDER_LABEL_AR: Record<string, string> = {
  male: 'ذكر',
  female: 'أنثى',
};

const GENDER_LABEL_IT: Record<string, string> = {
  male: 'Uomo',
  female: 'Donna',
};

const GENDER_LABEL_DE: Record<string, string> = {
  male: 'Mann',
  female: 'Frau',
};

const SESSION_DURATION_AR: Record<string, string> = {
  '30': '30 دقيقة',
  '45': '45 دقيقة',
  '60': '60 دقيقة',
  '90': '90 دقيقة',
};

const SESSION_DURATION_IT: Record<string, string> = {
  '30': '30 minuti',
  '45': '45 minuti',
  '60': '60 minuti',
  '90': '90 minuti',
};

const SESSION_DURATION_DE: Record<string, string> = {
  '30': '30 Minuten',
  '45': '45 Minuten',
  '60': '60 Minuten',
  '90': '90 Minuten',
};

const PREFERRED_TIME_AR: Record<string, string> = {
  morning: 'صباحًا',
  afternoon: 'ظهرًا',
  evening: 'مساءً',
};

const PREFERRED_TIME_IT: Record<string, string> = {
  morning: 'Mattina',
  afternoon: 'Pomeriggio',
  evening: 'Sera',
};

const PREFERRED_TIME_DE: Record<string, string> = {
  morning: 'Morgens',
  afternoon: 'Nachmittags',
  evening: 'Abends',
};

export const localizeGenderButtonLabel = (value: string, language: AppLanguage) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (language === 'it') {
    return GENDER_LABEL_IT[normalized] || (normalized ? 'Non specificato' : value);
  }
  if (language === 'de') {
    return GENDER_LABEL_DE[normalized] || (normalized ? 'Nicht angegeben' : value);
  }
  if (language !== 'ar') {
    if (normalized === 'male') return 'Man';
    if (normalized === 'female') return 'Woman';
    return normalized || value;
  }
  return GENDER_LABEL_AR[normalized] || (normalized ? 'غير محدد' : value);
};

export const localizeSelectOptions = (
  options: SelectOption[],
  language: AppLanguage,
  map: Record<string, string>,
) => {
  if (language === 'it') {
    const localizedMap = map === SESSION_DURATION_AR
      ? SESSION_DURATION_IT
      : map === PREFERRED_TIME_AR
        ? PREFERRED_TIME_IT
        : map === GENDER_LABEL_AR
          ? GENDER_LABEL_IT
          : null;
    if (localizedMap) {
      return options.map((option) => ({
        ...option,
        label: localizedMap[String(option.value || '').trim().toLowerCase()] || option.label,
      }));
    }
  }
  if (language === 'de') {
    const localizedMap = map === SESSION_DURATION_AR
      ? SESSION_DURATION_DE
      : map === PREFERRED_TIME_AR
        ? PREFERRED_TIME_DE
        : map === GENDER_LABEL_AR
          ? GENDER_LABEL_DE
          : null;
    if (localizedMap) {
      return options.map((option) => ({
        ...option,
        label: localizedMap[String(option.value || '').trim().toLowerCase()] || option.label,
      }));
    }
  }
  if (language !== 'ar') return options;
  return options.map((option) => ({
    ...option,
    label: map[String(option.value || '').trim().toLowerCase()] || option.label,
  }));
};

export const localizeSessionDurationOptions = (
  options: SelectOption[],
  language: AppLanguage,
) => localizeSelectOptions(options, language, SESSION_DURATION_AR);

export const localizePreferredTimeOptions = (
  options: SelectOption[],
  language: AppLanguage,
) => localizeSelectOptions(options, language, PREFERRED_TIME_AR);

export const localizeGenderOptions = (
  options: SelectOption[],
  language: AppLanguage,
) => localizeSelectOptions(options, language, GENDER_LABEL_AR);

export const localizeExperienceLevel = (value: string, language: AppLanguage) => {
  if (language === 'it') {
    if (value.toLowerCase() === 'beginner') return 'Principiante';
    if (value.toLowerCase() === 'intermediate') return 'Intermedio';
    if (value.toLowerCase() === 'advanced') return 'Avanzato';
    return value;
  }
  if (language === 'de') {
    if (value.toLowerCase() === 'beginner') return 'Anfaenger';
    if (value.toLowerCase() === 'intermediate') return 'Fortgeschritten';
    if (value.toLowerCase() === 'advanced') return 'Profi';
    return value;
  }
  if (language !== 'ar') return value;
  if (value.toLowerCase() === 'beginner') return 'مبتدئ';
  if (value.toLowerCase() === 'intermediate') return 'متوسط';
  if (value.toLowerCase() === 'advanced') return 'متقدم';
  return value;
};

