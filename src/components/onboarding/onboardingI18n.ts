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
  custom_plan_advice: 'نصائح الذكاء الاصطناعي',
  sport_age_gender: 'العمر والجنس',
  sport_experience: 'خبرة الرياضة',
  sport_plan_choice: 'اختيار الخطة',
};

export const resolveOnboardingTitle = (
  stepId: OnboardingStepId,
  fallback: string,
  language: AppLanguage,
) => {
  if (language !== 'ar') return fallback;
  return STEP_TITLES_AR[stepId] ?? fallback;
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

export const localizeMotivationOptions = (
  options: MotivationOption[],
  language: AppLanguage,
) => {
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

export const localizeFitnessGoals = (options: GoalOption[], language: AppLanguage) => {
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

export const localizeWorkoutSplitOptions = (options: SplitOption[], language: AppLanguage) => {
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

export const localizeSportPlanOptions = (options: PlanOption[], language: AppLanguage) => {
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

const RECOVERY_PRIORITY_AR: Record<string, string> = {
  balanced: 'متوازن',
  performance: 'دفع التقدم',
  recovery: 'تعافٍ محافظ',
};

export const localizeTrainingFocusOptions = (options: SimpleOption[], language: AppLanguage) => {
  if (language !== 'ar') return options;
  return options.map((option) => ({
    ...option,
    label: TRAINING_FOCUS_AR[option.value] || option.label,
  }));
};

export const localizeRecoveryOptions = (options: SimpleOption[], language: AppLanguage) => {
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

const SESSION_DURATION_AR: Record<string, string> = {
  '30': '30 دقيقة',
  '45': '45 دقيقة',
  '60': '60 دقيقة',
  '90': '90 دقيقة',
};

const PREFERRED_TIME_AR: Record<string, string> = {
  morning: 'صباحًا',
  afternoon: 'ظهرًا',
  evening: 'مساءً',
};

export const localizeGenderButtonLabel = (value: string, language: AppLanguage) => {
  const normalized = String(value || '').trim().toLowerCase();
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
  if (language !== 'ar') return value;
  if (value.toLowerCase() === 'beginner') return 'مبتدئ';
  if (value.toLowerCase() === 'intermediate') return 'متوسط';
  if (value.toLowerCase() === 'advanced') return 'متقدم';
  return value;
};
