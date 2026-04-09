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
        if (saved === 'en' || saved === 'ar' || saved === 'it' || saved === 'de' || saved === 'fr') {
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

const STEP_TITLES_FR: Partial<Record<OnboardingStepId, string>> = {
  language: 'Langue',
  first_name: 'Prenom',
  app_motivation: 'Motivation',
  athlete_identity: 'Profil',
  personal_info: 'Informations personnelles',
  fitness_background: 'Niveau sportif',
  fitness_goals: 'Objectifs fitness',
  body_type: 'Type de corps',
  goals_availability: 'Disponibilite',
  workout_split: 'Choix du programme',
  ai_plan_tuning: 'Preferences IA',
  body_image_upload: 'Photos du corps',
  ai_analysis: 'Analyse',
  body_results: 'Resultats',
  custom_plan: 'Programme personnalise',
  custom_plan_builder: 'Structure du programme',
  custom_plan_advice: 'Conseils IA',
  custom_plan_templates: 'Modeles de programme',
  sport_age_gender: 'Age et genre',
  sport_experience: 'Experience sportive',
  sport_plan_choice: 'Choix du programme',
};

export const resolveOnboardingTitle = (
  stepId: OnboardingStepId,
  fallback: string,
  language: AppLanguage,
) => {
  if (language === 'ar') return STEP_TITLES_AR[stepId] ?? fallback;
  if (language === 'it') return STEP_TITLES_IT[stepId] ?? fallback;
  if (language === 'de') return STEP_TITLES_DE[stepId] ?? fallback;
  if (language === 'fr') return STEP_TITLES_FR[stepId] ?? fallback;
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

const APP_MOTIVATION_FR: Record<string, { title: string; description: string }> = {
  guided_start: {
    title: 'Je veux un cadre clair des le premier jour',
    description: 'Donne-moi un plan simple et clair pour savoir quoi faire a chaque seance.',
  },
  consistency: {
    title: 'J ai besoin d aide pour rester regulier',
    description: 'Construisons une routine realiste que je peux suivre chaque semaine.',
  },
  progress_plateau: {
    title: 'Je stagne et je veux recommencer a progresser',
    description: 'Aide-moi a depasser ce plateau avec une programmation plus intelligente.',
  },
  time_efficiency: {
    title: 'Je veux des seances efficaces pour mon emploi du temps',
    description: 'Rends mes entrainements plus cibles et mieux adaptes a mon planning.',
  },
  accountability: {
    title: 'Je veux plus de suivi et de responsabilite',
    description: 'Suis mes entrainements et aide-moi a rester sur la bonne voie dans la duree.',
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
  if (language === 'fr') {
    return options.map((option) => {
      const fr = APP_MOTIVATION_FR[option.id];
      if (!fr) return option;
      return { ...option, title: fr.title, description: fr.description };
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
  const ATHLETE_IDENTITY_IT: Record<string, {
    label: string;
    description: string;
    subGroups?: Record<string, { title: string; items: Record<string, string> }>;
  }> = {
    bodybuilding: {
      label: 'Bodybuilding',
      description: 'Costruisci massa muscolare, simmetria e forza orientata al fisico.',
      subGroups: {
        bodybuilding_category: {
          title: 'Per categoria',
          items: {
            hypertrophy: 'Ipertrofia',
            powerlifting: 'Powerlifting',
            cutting: 'Definizione',
            bulking: 'Massa',
            beginner_gym: 'Principiante in palestra',
            natural_athlete: 'Atleta natural',
            classic_physique: 'Classic physique',
          },
        },
      },
    },
    cardio: {
      label: 'Cardio',
      description: 'Migliora resistenza, consumo calorico e condizionamento generale.',
      subGroups: {
        cardio_goal: {
          title: 'Per focus',
          items: {
            fat_loss: 'Perdita di grasso',
            endurance: 'Resistenza',
            conditioning: 'Condizionamento',
            heart_health: 'Salute del cuore',
          },
        },
      },
    },
    football: {
      label: 'Calcio',
      description: 'Migliora velocita, agilita, potenza e resistenza partita.',
      subGroups: {
        football_position: {
          title: 'Per ruolo',
          items: {
            striker: 'Attaccante',
            winger: 'Ala',
            midfielder: 'Centrocampista',
            defender: 'Difensore',
            goalkeeper: 'Portiere',
          },
        },
        football_goal: {
          title: 'Per obiettivo',
          items: {
            speed_acceleration: 'Velocita e accelerazione',
            match_endurance: 'Resistenza partita',
            shooting_power: 'Potenza di tiro',
            injury_prevention: 'Prevenzione infortuni',
            strength_duels: 'Forza nei duelli',
          },
        },
        football_phase: {
          title: 'Per fase stagione',
          items: {
            pre_season: 'Pre-stagione',
            in_season: 'Durante la stagione',
            off_season: 'Fuori stagione',
          },
        },
      },
    },
    basketball: {
      label: 'Basket',
      description: 'Allena esplosivita, salto verticale e condizionamento da campo.',
      subGroups: {
        basketball_role: {
          title: 'Per ruolo',
          items: {
            guard: 'Guardia',
            forward: 'Ala',
            center: 'Centro',
          },
        },
        basketball_goal: {
          title: 'Per obiettivo',
          items: {
            vertical_jump: 'Salto verticale',
            explosive_speed: 'Velocita esplosiva',
            lateral_agility: 'Agilita laterale',
            knee_injury_prevention: 'Prevenzione infortuni al ginocchio',
            core_stability: 'Stabilita del core',
          },
        },
        basketball_phase: {
          title: 'Per fase',
          items: {
            pre_season: 'Pre-stagione',
            in_season: 'Durante la stagione',
            off_season: 'Fuori stagione',
          },
        },
      },
    },
    handball: {
      label: 'Pallamano',
      description: 'Aumenta potenza rotazionale, accelerazione e resistenza ripetuta.',
      subGroups: {
        handball_position: {
          title: 'Per ruolo',
          items: {
            wing: 'Ala',
            backcourt: 'Terzino',
            pivot: 'Pivot',
            goalkeeper: 'Portiere',
          },
        },
        handball_goal: {
          title: 'Per obiettivo',
          items: {
            throwing_power: 'Potenza di tiro',
            jump_explosiveness: 'Esplosivita nel salto',
            shoulder_strength: 'Forza delle spalle',
            sprint_endurance: 'Resistenza agli sprint',
          },
        },
        handball_phase: {
          title: 'Per fase',
          items: {
            pre_season: 'Pre-stagione',
            in_season: 'Durante la stagione',
            off_season: 'Fuori stagione',
          },
        },
      },
    },
    swimming: {
      label: 'Nuoto',
      description: 'Sviluppa resistenza total body, capacita polmonare e controllo.',
      subGroups: {
        swimming_stroke: {
          title: 'Per stile',
          items: {
            freestyle: 'Stile libero',
            breaststroke: 'Rana',
            butterfly: 'Farfalla',
            backstroke: 'Dorso',
          },
        },
        swimming_goal: {
          title: 'Per obiettivo',
          items: {
            shoulder_mobility: 'Mobilita delle spalle',
            core_endurance: 'Resistenza del core',
            breathing_capacity: 'Capacita respiratoria',
            technique_strength: 'Forza tecnica',
          },
        },
        swimming_phase: {
          title: 'Per fase',
          items: {
            conditioning_phase: 'Fase di condizionamento',
            competition_phase: 'Fase competitiva',
            recovery_phase: 'Fase di recupero',
          },
        },
      },
    },
    combat_sports: {
      label: 'Sport da combattimento',
      description: 'Costruisci condizionamento, velocita di reazione e potenza funzionale.',
      subGroups: {
        combat_sport_type: {
          title: 'Per sport',
          items: {
            boxing: 'Boxe',
            mma: 'MMA',
            muay_thai: 'Muay Thai',
            wrestling: 'Lotta',
            judo: 'Judo',
          },
        },
        combat_goal: {
          title: 'Per obiettivo',
          items: {
            power_endurance: 'Resistenza alla potenza',
            speed_reaction: 'Velocita e reazione',
            weight_cut_conditioning: 'Condizionamento per taglio peso',
            neck_core_strength: 'Forza di collo e core',
          },
        },
        combat_phase: {
          title: 'Per fase',
          items: {
            fight_camp: 'Fight camp',
            off_camp: 'Fuori camp',
            recovery: 'Recupero',
          },
        },
      },
    },
  };

  const ATHLETE_IDENTITY_DE: Record<string, {
    label: string;
    description: string;
    subGroups?: Record<string, { title: string; items: Record<string, string> }>;
  }> = {
    bodybuilding: {
      label: 'Bodybuilding',
      description: 'Baue Muskelmasse, Symmetrie und physikorientierte Kraft auf.',
      subGroups: {
        bodybuilding_category: {
          title: 'Nach Kategorie',
          items: {
            hypertrophy: 'Hypertrophie',
            powerlifting: 'Powerlifting',
            cutting: 'Definition',
            bulking: 'Aufbau',
            beginner_gym: 'Gym-Anfaenger',
            natural_athlete: 'Naturaler Athlet',
            classic_physique: 'Classic Physique',
          },
        },
      },
    },
    cardio: {
      label: 'Cardio',
      description: 'Verbessere Ausdauer, Kalorienverbrauch und allgemeine Kondition.',
      subGroups: {
        cardio_goal: {
          title: 'Nach Fokus',
          items: {
            fat_loss: 'Fettverlust',
            endurance: 'Ausdauer',
            conditioning: 'Kondition',
            heart_health: 'Herzgesundheit',
          },
        },
      },
    },
    football: {
      label: 'Fussball',
      description: 'Verbessere Schnelligkeit, Agilitaet, Kraft und Spielausdauer.',
      subGroups: {
        football_position: {
          title: 'Nach Position',
          items: {
            striker: 'Stuermer',
            winger: 'Fluegel',
            midfielder: 'Mittelfeld',
            defender: 'Verteidiger',
            goalkeeper: 'Torwart',
          },
        },
        football_goal: {
          title: 'Nach Ziel',
          items: {
            speed_acceleration: 'Schnelligkeit und Antritt',
            match_endurance: 'Spielausdauer',
            shooting_power: 'Schusskraft',
            injury_prevention: 'Verletzungspraevention',
            strength_duels: 'Zweikampfstaerke',
          },
        },
        football_phase: {
          title: 'Nach Saisonphase',
          items: {
            pre_season: 'Vorbereitung',
            in_season: 'Saison',
            off_season: 'Off-Season',
          },
        },
      },
    },
    basketball: {
      label: 'Basketball',
      description: 'Trainiere Explosivitaet, vertikale Sprungkraft und Spielfeld-Kondition.',
      subGroups: {
        basketball_role: {
          title: 'Nach Rolle',
          items: {
            guard: 'Guard',
            forward: 'Forward',
            center: 'Center',
          },
        },
        basketball_goal: {
          title: 'Nach Ziel',
          items: {
            vertical_jump: 'Vertikalsprung',
            explosive_speed: 'Explosive Geschwindigkeit',
            lateral_agility: 'Seitliche Agilitaet',
            knee_injury_prevention: 'Praevention Knieverletzungen',
            core_stability: 'Core-Stabilitaet',
          },
        },
        basketball_phase: {
          title: 'Nach Phase',
          items: {
            pre_season: 'Vorbereitung',
            in_season: 'Saison',
            off_season: 'Off-Season',
          },
        },
      },
    },
    handball: {
      label: 'Handball',
      description: 'Steigere Rotationskraft, Beschleunigung und wiederholbare Ausdauer.',
      subGroups: {
        handball_position: {
          title: 'Nach Position',
          items: {
            wing: 'Aussen',
            backcourt: 'Rueckraum',
            pivot: 'Kreislaeufer',
            goalkeeper: 'Torwart',
          },
        },
        handball_goal: {
          title: 'Nach Ziel',
          items: {
            throwing_power: 'Wurfkraft',
            jump_explosiveness: 'Sprungexplosivitaet',
            shoulder_strength: 'Schulterkraft',
            sprint_endurance: 'Sprintausdauer',
          },
        },
        handball_phase: {
          title: 'Nach Phase',
          items: {
            pre_season: 'Vorbereitung',
            in_season: 'Saison',
            off_season: 'Off-Season',
          },
        },
      },
    },
    swimming: {
      label: 'Schwimmen',
      description: 'Entwickle Ganzkoerper-Ausdauer, Lungenkapazitaet und Kontrolle.',
      subGroups: {
        swimming_stroke: {
          title: 'Nach Stil',
          items: {
            freestyle: 'Freistil',
            breaststroke: 'Brust',
            butterfly: 'Schmetterling',
            backstroke: 'Ruecken',
          },
        },
        swimming_goal: {
          title: 'Nach Ziel',
          items: {
            shoulder_mobility: 'Schulterbeweglichkeit',
            core_endurance: 'Core-Ausdauer',
            breathing_capacity: 'Atemkapazitaet',
            technique_strength: 'Technikkraft',
          },
        },
        swimming_phase: {
          title: 'Nach Phase',
          items: {
            conditioning_phase: 'Aufbauphase',
            competition_phase: 'Wettkampfphase',
            recovery_phase: 'Erholungsphase',
          },
        },
      },
    },
    combat_sports: {
      label: 'Kampfsport',
      description: 'Baue Kondition, Reaktionsschnelligkeit und funktionelle Kraft auf.',
      subGroups: {
        combat_sport_type: {
          title: 'Nach Sportart',
          items: {
            boxing: 'Boxen',
            mma: 'MMA',
            muay_thai: 'Muay Thai',
            wrestling: 'Ringen',
            judo: 'Judo',
          },
        },
        combat_goal: {
          title: 'Nach Ziel',
          items: {
            power_endurance: 'Kraftausdauer',
            speed_reaction: 'Geschwindigkeit und Reaktion',
            weight_cut_conditioning: 'Conditioning fuer Weight Cut',
            neck_core_strength: 'Nacken- und Core-Kraft',
          },
        },
        combat_phase: {
          title: 'Nach Phase',
          items: {
            fight_camp: 'Fight Camp',
            off_camp: 'Ausserhalb des Camps',
            recovery: 'Erholung',
          },
        },
      },
    },
  };

  const ATHLETE_IDENTITY_FR: Record<string, {
    label: string;
    description: string;
    subGroups?: Record<string, { title: string; items: Record<string, string> }>;
  }> = {
    bodybuilding: {
      label: 'Bodybuilding',
      description: 'Developpe la masse musculaire, la symetrie et une force orientee physique.',
      subGroups: {
        bodybuilding_category: {
          title: 'Par categorie',
          items: {
            hypertrophy: 'Hypertrophie',
            powerlifting: 'Powerlifting',
            cutting: 'Seche',
            bulking: 'Prise de masse',
            beginner_gym: 'Debutant en salle',
            natural_athlete: 'Athlete naturel',
            classic_physique: 'Classic physique',
          },
        },
      },
    },
    cardio: {
      label: 'Cardio',
      description: 'Ameliore l endurance, la depense calorique et la condition generale.',
      subGroups: {
        cardio_goal: {
          title: 'Par objectif',
          items: {
            fat_loss: 'Perte de graisse',
            endurance: 'Endurance',
            conditioning: 'Condition physique',
            heart_health: 'Sante du coeur',
          },
        },
      },
    },
    football: {
      label: 'Football',
      description: 'Ameliore vitesse, agilite, puissance et endurance de match.',
      subGroups: {
        football_position: {
          title: 'Par poste',
          items: {
            striker: 'Attaquant',
            winger: 'Ailier',
            midfielder: 'Milieu',
            defender: 'Defenseur',
            goalkeeper: 'Gardien',
          },
        },
        football_goal: {
          title: 'Par objectif',
          items: {
            speed_acceleration: 'Vitesse et acceleration',
            match_endurance: 'Endurance de match',
            shooting_power: 'Puissance de frappe',
            injury_prevention: 'Prevention des blessures',
            strength_duels: 'Puissance dans les duels',
          },
        },
        football_phase: {
          title: 'Par phase de saison',
          items: {
            pre_season: 'Pre-saison',
            in_season: 'En saison',
            off_season: 'Hors saison',
          },
        },
      },
    },
    basketball: {
      label: 'Basketball',
      description: 'Travaille l explosivite, la detente verticale et la condition sur le terrain.',
      subGroups: {
        basketball_role: {
          title: 'Par role',
          items: {
            guard: 'Arriere',
            forward: 'Ailier',
            center: 'Pivot',
          },
        },
        basketball_goal: {
          title: 'Par objectif',
          items: {
            vertical_jump: 'Detente verticale',
            explosive_speed: 'Vitesse explosive',
            lateral_agility: 'Agilite laterale',
            knee_injury_prevention: 'Prevention des blessures au genou',
            core_stability: 'Stabilite du centre',
          },
        },
        basketball_phase: {
          title: 'Par phase',
          items: {
            pre_season: 'Pre-saison',
            in_season: 'En saison',
            off_season: 'Hors saison',
          },
        },
      },
    },
    handball: {
      label: 'Handball',
      description: 'Developpe la puissance rotative, l acceleration et l endurance repetitive.',
      subGroups: {
        handball_position: {
          title: 'Par poste',
          items: {
            wing: 'Ailier',
            backcourt: 'Arriere',
            pivot: 'Pivot',
            goalkeeper: 'Gardien',
          },
        },
        handball_goal: {
          title: 'Par objectif',
          items: {
            throwing_power: 'Puissance de tir',
            jump_explosiveness: 'Explosivite du saut',
            shoulder_strength: 'Force des epaules',
            sprint_endurance: 'Endurance sprint',
          },
        },
        handball_phase: {
          title: 'Par phase',
          items: {
            pre_season: 'Pre-saison',
            in_season: 'En saison',
            off_season: 'Hors saison',
          },
        },
      },
    },
    swimming: {
      label: 'Natation',
      description: 'Developpe l endurance globale, la capacite pulmonaire et le controle.',
      subGroups: {
        swimming_stroke: {
          title: 'Par nage',
          items: {
            freestyle: 'Nage libre',
            breaststroke: 'Brasse',
            butterfly: 'Papillon',
            backstroke: 'Dos',
          },
        },
        swimming_goal: {
          title: 'Par objectif',
          items: {
            shoulder_mobility: 'Mobilite des epaules',
            core_endurance: 'Endurance du centre',
            breathing_capacity: 'Capacite respiratoire',
            technique_strength: 'Force technique',
          },
        },
        swimming_phase: {
          title: 'Par phase',
          items: {
            conditioning_phase: 'Phase de conditionnement',
            competition_phase: 'Phase de competition',
            recovery_phase: 'Phase de recuperation',
          },
        },
      },
    },
    combat_sports: {
      label: 'Sports de combat',
      description: 'Developpe la condition physique, la vitesse de reaction et la puissance fonctionnelle.',
      subGroups: {
        combat_sport_type: {
          title: 'Par sport',
          items: {
            boxing: 'Boxe',
            mma: 'MMA',
            muay_thai: 'Muay Thai',
            wrestling: 'Lutte',
            judo: 'Judo',
          },
        },
        combat_goal: {
          title: 'Par objectif',
          items: {
            power_endurance: 'Endurance de puissance',
            speed_reaction: 'Vitesse et reaction',
            weight_cut_conditioning: 'Conditionnement pour coupe de poids',
            neck_core_strength: 'Force du cou et du centre',
          },
        },
        combat_phase: {
          title: 'Par phase',
          items: {
            fight_camp: 'Camp de combat',
            off_camp: 'Hors camp',
            recovery: 'Recuperation',
          },
        },
      },
    },
  };

  if (language === 'it') {
    return options.map((option) => {
      const it = ATHLETE_IDENTITY_IT[option.id];
      if (!it) return option;
      return {
        ...option,
        label: it.label || option.label,
        description: it.description || option.description,
        subGroups: option.subGroups.map((group) => {
          const groupIt = it.subGroups?.[group.id];
          return {
            ...group,
            title: groupIt?.title || group.title,
            items: group.items.map((item) => ({
              ...item,
              label: groupIt?.items?.[item.id] || item.label,
            })),
          };
        }),
      };
    });
  }

  if (language === 'de') {
    return options.map((option) => {
      const de = ATHLETE_IDENTITY_DE[option.id];
      if (!de) return option;
      return {
        ...option,
        label: de.label || option.label,
        description: de.description || option.description,
        subGroups: option.subGroups.map((group) => {
          const groupDe = de.subGroups?.[group.id];
          return {
            ...group,
            title: groupDe?.title || group.title,
            items: group.items.map((item) => ({
              ...item,
              label: groupDe?.items?.[item.id] || item.label,
            })),
          };
        }),
      };
    });
  }

  if (language === 'fr') {
    return options.map((option) => {
      const fr = ATHLETE_IDENTITY_FR[option.id];
      if (!fr) return option;
      return {
        ...option,
        label: fr.label || option.label,
        description: fr.description || option.description,
        subGroups: option.subGroups.map((group) => {
          const groupFr = fr.subGroups?.[group.id];
          return {
            ...group,
            title: groupFr?.title || group.title,
            items: group.items.map((item) => ({
              ...item,
              label: groupFr?.items?.[item.id] || item.label,
            })),
          };
        }),
      };
    });
  }

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

const FITNESS_GOALS_FR: Record<string, { title: string; description: string; tag?: string }> = {
  build_muscle_toned: {
    title: 'Construire du muscle et se dessiner',
    description: 'Concentre-toi sur la prise de muscle et la definition avec une progression claire.',
    tag: 'Populaire',
  },
  general_fitness: {
    title: 'Ameliorer la forme generale',
    description: 'Ameliore ta condition physique generale avec des seances equilibrees et variees.',
  },
  conditioning: {
    title: 'Developper l endurance',
    description: 'Mise sur plus de volume, de rythme et des recuperations plus courtes.',
  },
  get_stronger: {
    title: 'Devenir plus fort',
    description: 'Priorise les mouvements polyarticulaires et des charges plus lourdes avec moins de repetitions.',
    tag: 'Force',
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
  if (language === 'fr') {
    return options.map((option) => {
      const fr = FITNESS_GOALS_FR[option.id];
      if (!fr) return option;
      return {
        ...option,
        title: fr.title || option.title,
        description: fr.description || option.description,
        tag: fr.tag ?? option.tag,
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

const WORKOUT_SPLIT_FR: Record<string, { title: string; summary: string; detail: string }> = {
  auto: {
    title: 'Programme du coach avec IA',
    summary: 'Cree un programme personnel complet avec Claude AI',
    detail: 'Utilise ton profil et tes preferences pour construire un programme structure sur 8 semaines.',
  },
  full_body: {
    title: 'Corps complet',
    summary: 'Travaille tous les grands groupes musculaires a chaque seance',
    detail: 'Ideal si tu t entraines peu de jours et veux progresser regulierement.',
  },
  upper_lower: {
    title: 'Haut / Bas du corps',
    summary: 'Alterne les jours haut du corps et bas du corps',
    detail: 'Structure equilibree avec une bonne recuperation entre les seances.',
  },
  push_pull_legs: {
    title: 'Push / Pull / Jambes',
    summary: 'Une repartition par mouvements avec des jours plus cibles',
    detail: 'Ideal pour une frequence d entrainement intermediaire ou elevee.',
  },
  hybrid: {
    title: 'PPL + Haut / Bas',
    summary: 'Combine PPL et haut/bas pour plus de volume',
    detail: 'Parfait si tu veux plus de variete et une charge hebdomadaire equilibree.',
  },
  custom: {
    title: 'Programme personnalise',
    summary: 'Construis une repartition selon tes priorites',
    detail: 'Pense pour ceux qui veulent un controle total sur la structure et le volume.',
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
  if (language === 'fr') {
    return options.map((option) => {
      const fr = WORKOUT_SPLIT_FR[option.id];
      if (!fr) return option;
      return { ...option, title: fr.title, summary: fr.summary, detail: fr.detail };
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

const SPORT_PLAN_FR: Record<string, { title: string; description: string }> = {
  auto: {
    title: 'Creer un programme avec IA',
    description: 'L IA construit ton programme selon ton profil et tes objectifs sportifs.',
  },
  custom: {
    title: 'Programme manuel personnalise',
    description: 'Definis toi-meme la structure du programme puis fais-le evoluer.',
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
  if (language === 'fr') {
    return options.map((option) => {
      const fr = SPORT_PLAN_FR[option.id];
      if (!fr) return option;
      return { ...option, title: fr.title, description: fr.description };
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

const TRAINING_FOCUS_FR: Record<string, string> = {
  balanced: 'Equilibre',
  hypertrophy: 'Focus hypertrophie',
  strength: 'Focus force',
  fat_loss: 'Soutien perte de graisse',
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

const RECOVERY_PRIORITY_FR: Record<string, string> = {
  balanced: 'Equilibre',
  performance: 'Pousser les progres',
  recovery: 'Priorite a la recuperation',
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
  if (language === 'fr') {
    return options.map((option) => ({
      ...option,
      label: TRAINING_FOCUS_FR[option.value] || option.label,
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
  if (language === 'fr') {
    return options.map((option) => ({
      ...option,
      label: RECOVERY_PRIORITY_FR[option.value] || option.label,
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

const GENDER_LABEL_FR: Record<string, string> = {
  male: 'Homme',
  female: 'Femme',
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

const SESSION_DURATION_FR: Record<string, string> = {
  '30': '30 minutes',
  '45': '45 minutes',
  '60': '60 minutes',
  '90': '90 minutes',
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

const PREFERRED_TIME_FR: Record<string, string> = {
  morning: 'Matin',
  afternoon: 'Apres-midi',
  evening: 'Soir',
};

export const localizeGenderButtonLabel = (value: string, language: AppLanguage) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (language === 'it') {
    return GENDER_LABEL_IT[normalized] || (normalized ? 'Non specificato' : value);
  }
  if (language === 'de') {
    return GENDER_LABEL_DE[normalized] || (normalized ? 'Nicht angegeben' : value);
  }
  if (language === 'fr') {
    return GENDER_LABEL_FR[normalized] || (normalized ? 'Non precise' : value);
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
  if (language === 'fr') {
    const localizedMap = map === SESSION_DURATION_AR
      ? SESSION_DURATION_FR
      : map === PREFERRED_TIME_AR
        ? PREFERRED_TIME_FR
        : map === GENDER_LABEL_AR
          ? GENDER_LABEL_FR
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
  if (language === 'fr') {
    if (value.toLowerCase() === 'beginner') return 'Debutant';
    if (value.toLowerCase() === 'intermediate') return 'Intermediaire';
    if (value.toLowerCase() === 'advanced') return 'Avance';
    return value;
  }
  if (language !== 'ar') return value;
  if (value.toLowerCase() === 'beginner') return 'مبتدئ';
  if (value.toLowerCase() === 'intermediate') return 'متوسط';
  if (value.toLowerCase() === 'advanced') return 'متقدم';
  return value;
};

