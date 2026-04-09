import React, { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { api } from '../services/api';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../services/language';
import { getStoredUserId } from '../shared/authStorage';
import { recordBookApplied } from '../services/bookUsage';
import { getAssignedBookPlan, getPlanSwitchPrompt } from '../services/bookPlanSelection';

interface T2BulkingPlanScreenProps {
  onBack: () => void;
}

type Exercise = {
  name: string;
  prescription: string;
  comment?: string;
  technique?: string;
};

type DayPlan = {
  dayLabel: string;
  focus: string;
  summary: string;
  targetMuscles: string[];
  exercises: Exercise[];
};

type WeekPlan = {
  key: 'A' | 'B';
  title: string;
  subtitle: string;
  goal: string;
  note: string;
  days: DayPlan[];
};

type TableDefinition = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
};

type T2BulkingPremiumConfig = {
  planKind: 't2-bulk';
  surplusMode: 'clean' | 'balanced' | 'aggressive';
  weakPointFocus: 'upper_chest' | 'v_taper' | 'legs';
  recoveryMode: 'protect' | 'balanced' | 'performance';
};

const COPY: LocalizedLanguageRecord<{
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
  payloadName: string;
  payloadDescription: string;
}> = {
  en: {
    title: 'T-2 Bulking Plan',
    badge: 'RepSet Bulking Template',
    summary: 'A 2-week rotating bulking structure built to drive chest thickness, lat width, leg mass, and overall density while keeping the waist tight.',
    usePlan: 'Use As My Plan',
    usingPlan: 'Saving...',
    activePlan: 'Active In My Plan',
    modalTitle: 'Choose T-2 Bulking as your personal plan?',
    modalBody: 'This will save T-2 Bulking as your active plan on the My Plan page.',
    modalHint: 'You can still customize exercises and target loads later.',
    confirm: 'Yes, Use T-2 Bulking',
    cancel: 'Cancel',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save T-2 Bulking as your plan.',
    success: 'T-2 Bulking is now saved as your active plan in My Plan.',
    payloadName: 'T-2 Bulking Personal Plan',
    payloadDescription: 'T-2 bulking template applied as an active personal plan.',
  },
  ar: {
    title: 'خطة T-2 للتضخيم',
    badge: 'قالب تضخيم من RepSet',
    summary: 'خطة تضخيم بدوران أسبوعين لزيادة سماكة الصدر وعرض الظهر وكتلة الأرجل والكثافة العامة مع الحفاظ على خصر مشدود.',
    usePlan: 'اجعلها خطتي',
    usingPlan: 'جارٍ الحفظ...',
    activePlan: 'مفعلة في خطتي',
    modalTitle: 'هل تريد اختيار T-2 للتضخيم كخطتك الشخصية؟',
    modalBody: 'سيتم حفظ T-2 للتضخيم كخطتك النشطة داخل صفحة خطتي.',
    modalHint: 'يمكنك تعديل التمارين والأوزان المستهدفة لاحقًا.',
    confirm: 'نعم، اختر T-2 للتضخيم',
    cancel: 'إلغاء',
    noSession: 'لا توجد جلسة مستخدم نشطة.',
    saveFailed: 'تعذر حفظ T-2 للتضخيم كخطتك.',
    success: 'تم حفظ T-2 للتضخيم كخطتك النشطة داخل صفحة خطتي.',
    payloadName: 'خطة T-2 الشخصية للتضخيم',
    payloadDescription: 'تم تطبيق قالب T-2 للتضخيم كخطة شخصية نشطة.',
    'Increase chest thickness + upper chest': 'زد سماكة الصدر وأعلى الصدر',
    'Increase lat width (V shape)': 'زد عرض اللاتس وشكل V',
    'Add leg mass (quads + hamstrings)': 'أضف كتلة للأرجل (الرباعية + الخلفية)',
    'Maintain waist tight': 'حافظ على خصر مشدود',
    'Improve overall density': 'حسن الكثافة العامة',
    'A -> B -> A -> B for the 8-week cycle.': 'A -> B -> A -> B طوال دورة 8 أسابيع.',
    'Strength + base mass with chest thickness, lat width, and lower-body overload.': 'قوة + كتلة أساسية مع سماكة الصدر وعرض الظهر وتحميل إضافي للجزء السفلي.',
    'Push heavier loads, perfect tempo, and build the base for later hypertrophy expansion.': 'ادفع أحمالًا أعلى، واضبط التمبو، وابنِ قاعدة قوية للتضخيم اللاحق.',
    'Change the stimulus, chase stretch-mediated growth, and accumulate cleaner hypertrophy volume.': 'غيّر التحفيز، واطلب نموًا قائمًا على التمدد، وراكِم حجم تضخيم أنظف.',
    'Week B chases more reps, deeper stretch, and expansion work instead of just heavier loading.': 'الأسبوع B يطارد تكرارات أكثر وتمددًا أعمق وعمل توسعة بدلًا من مجرد أحمال أثقل.',
    'Upper chest density plus V-shape back work with direct arm support volume.': 'كثافة أعلى الصدر مع عمل ظهر لشكل V وحجم دعم مباشر للذراعين.',
    'Heavy lower-body day built to drive quad and hamstring mass with stable progression.': 'يوم سفلي ثقيل مصمم لزيادة كتلة الرباعية والخلفية مع تدرج ثابت.',
    'Chest and shoulder volume day to build shape, fullness, and pressing density.': 'يوم حجم للصدر والأكتاف لبناء الشكل والامتلاء وكثافة الدفع.',
    'Posterior-chain density with back thickness, rear-delt detail, and glute overload.': 'كثافة للسلسلة الخلفية مع سماكة الظهر وتفصيل الخلفي وتحميل إضافي للألوية.',
    'Upper chest and lats get a longer-range, fuller hypertrophy stimulus.': 'يحصل أعلى الصدر واللاتس على تحفيز تضخيم أوسع مدى وأكثر امتلاءً.',
    'Quad-dominant lower-body work with unilateral control and longer tension exposure.': 'عمل سفلي يهيمن عليه الرباعي مع تحكم أحادي وتعرض أطول للتوتر.',
    'Frame-building shoulder work followed by chest pump expansion.': 'عمل كتف لبناء الإطار يتبعه توسيع ضخ الصدر.',
    'Width-biased pulling with density support and glute reinforcement.': 'سحب منحاز للعرض مع دعم الكثافة وتعزيز الألوية.',
    'Increase weight.': 'زد الوزن.',
    'Increase reps.': 'زد التكرارات.',
    'Example: Week A incline press = 60kg, Week B = 12 reps, next cycle Week A = 62.5kg, Week B = 13 reps.': 'مثال: أسبوع A ضغط مائل = 60 كغ، أسبوع B = 12 تكرارًا، الدورة التالية أسبوع A = 62.5 كغ، أسبوع B = 13 تكرارًا.',
    'Load progression': 'تدرج الحمل',
    'Rep progression': 'تدرج التكرارات',
    'Density progression': 'تدرج الكثافة',
    'Neural adaptation': 'التكيف العصبي',
    'Volume cycling': 'تدوير الحجم',
    '1. Neural Base': '1. قاعدة عصبية',
    '2. Volume Expansion': '2. توسيع الحجم',
    '3. Density Overload': '3. تحميل الكثافة',
    '4. Growth Peak': '4. ذروة النمو',
    'Each week also layer in a higher-stimulus technique on isolation work.': 'كل أسبوع أضف تقنية أعلى تحفيزًا على تمارين العزل.',
    'Week 1 -> Normal execution': 'الأسبوع 1 -> تنفيذ عادي',
    'Week 2 -> Slow eccentric': 'الأسبوع 2 -> نزول بطيء',
    'Week 3 -> Stretch hold': 'الأسبوع 3 -> ثبات في التمدد',
    'Week 4 -> Dropset': 'الأسبوع 4 -> دروب سيت',
    'Week 5 -> Partial reps': 'الأسبوع 5 -> أنصاف تكرارات',
    'Week 6 -> Supersets': 'الأسبوع 6 -> سوبر سيت',
    'Week 7 -> Giant sets': 'الأسبوع 7 -> جاينت سيت',
    'Week 8 -> Deload pump': 'الأسبوع 8 -> ديلود بامب',
    'Start weight = weight you can lift x 0.65': 'وزن البداية = الوزن الذي تستطيع رفعه × 0.65',
    'Example: Incline DB press max = 30kg, so week 1 starts at 20kg.': 'مثال: الحد الأقصى لضغط الدمبل المائل = 30 كغ، لذا يبدأ الأسبوع 1 عند 20 كغ.',
    'Eat in a surplus': 'كل في فائض',
    'Sleep 8 hours': 'نم 8 ساعات',
    'Never skip leg day': 'لا تتخطى يوم الأرجل أبدًا',
    'Track strength weekly': 'تتبع القوة أسبوعيًا',
    'No ego lifting': 'لا ترفع بالأنا',
    'Perfect tempo': 'تمبو مثالي',
    'Month 1 -> Strength jump': 'الشهر 1 -> قفزة قوة',
    'Month 2 -> Visual size': 'الشهر 2 -> حجم مرئي',
    'Month 3 -> Physique change': 'الشهر 3 -> تغير في الفورمة',
    'Month 6 -> Elite aesthetic': 'الشهر 6 -> شكل جمالي نخبة',
    'Incline Bench (Weak Point Priority)': 'البنش المائل (أولوية نقطة الضعف)',
    'Chest thickness and upper chest progression anchor.': 'مرتكز تطور سماكة الصدر وأعلى الصدر.',
    'Squat (Leg Mass Priority)': 'السكوات (أولوية كتلة الأرجل)',
    'Quad recruitment and lower-body mass build.': 'تجنيد الرباعية وبناء كتلة الجزء السفلي.',
    'Deadlift (Posterior Chain)': 'الديدليفت (السلسلة الخلفية)',
    'Posterior-chain loading and density progression.': 'تحميل السلسلة الخلفية وتدرج الكثافة.',
    'Pull-ups (Back Width)': 'العقلة (عرض الظهر)',
    'Width progression through load and density.': 'تدرج العرض عبر الحمل والكثافة.',
    'Shoulder Press (Frame Builder)': 'ضغط الكتف (بناء الإطار)',
    'Frame-building progression across the cycle.': 'تدرج بناء الإطار عبر الدورة.',
    Week: 'الأسبوع',
    Sets: 'المجموعات',
    Reps: 'التكرارات',
    'Load %': 'نسبة الحمل',
    Strategy: 'الاستراتيجية',
    'Technique build': 'بناء التقنية',
    'Rep overload': 'تحميل التكرارات',
    'Volume growth': 'نمو الحجم',
    'Neural load': 'تحميل عصبي',
    'Strength hypertrophy': 'تضخيم القوة',
    'Chest expansion': 'توسيع الصدر',
    'Growth pump reset': 'إعادة ضبط بامب النمو',
    'Neural base': 'قاعدة عصبية',
    Adaptation: 'تكيف',
    'Strength stimulus': 'تحفيز القوة',
    'Quad recruitment': 'تجنيد الرباعية',
    'Mass overload': 'تحميل الكتلة',
    'CNS peak': 'ذروة الجهاز العصبي',
    Density: 'الكثافة',
    'Recovery hypertrophy': 'تضخيم الاستشفاء',
    Technique: 'تقنية',
    Neural: 'عصبي',
    'Posterior growth': 'نمو السلسلة الخلفية',
    Strength: 'القوة',
    'Glute load': 'تحميل الألوية',
    'CNS overload': 'تحميل عصبي زائد',
    Recovery: 'استشفاء',
    'Bodyweight max': 'أقصى تكرارات بوزن الجسم',
    Neuromuscular: 'عصبي عضلي',
    Overload: 'تحميل إضافي',
    'Lat growth': 'نمو اللاتس',
    'Width expansion': 'توسيع العرض',
    Peak: 'الذروة',
    'Elite overload': 'تحميل نخبة',
    'BW pump': 'بامب وزن الجسم',
    'Working sets': 'مجموعات العمل',
    'Week focus:': 'تركيز الأسبوع:',
    'Premium bulk mode: keep the surplus clean and prioritize quality reps.': 'وضع التضخيم المميز: حافظ على فائض نظيف وركز على جودة التكرارات.',
    'Premium bulk mode: push size with higher demand and denser execution.': 'وضع التضخيم المميز: ادفع الحجم مع طلب أعلى وتنفيذ أكثف.',
    'Premium bulk mode: balance growth, recovery, and clean progression.': 'وضع التضخيم المميز: وازن بين النمو والاستشفاء والتدرج النظيف.',
    'Recovery bias: protect performance quality and leave one clean rep in reserve when needed.': 'اتجاه الاستشفاء: احمِ جودة الأداء واترك تكرارًا نظيفًا في الاحتياط عند الحاجة.',
    'Recovery bias: push output harder before backing off volume.': 'اتجاه الاستشفاء: ادفع الأداء بقوة أكبر قبل خفض الحجم.',
    'Recovery bias: balanced fatigue and progression management.': 'اتجاه الاستشفاء: إدارة متوازنة للإجهاد والتدرج.',
    'Weak-point focus: give extra attention to lat width and shoulder-frame work.': 'تركيز نقطة الضعف: امنح اهتمامًا إضافيًا لعرض اللاتس وعمل إطار الأكتاف.',
    'Weak-point focus: leg mass is prioritized through cleaner lower-body execution.': 'تركيز نقطة الضعف: كتلة الأرجل لها الأولوية عبر تنفيذ أنظف للجزء السفلي.',
    'Weak-point focus: upper-chest density is the primary premium priority.': 'تركيز نقطة الضعف: كثافة أعلى الصدر هي أولوية Premium الأساسية.',
    'Premium priority: slow the eccentric and own the upper-chest contraction.': 'أولوية Premium: أبطئ النزول وسيطر على انقباض أعلى الصدر.',
    'Premium priority: chase width, stretch, and clean scapular control.': 'أولوية Premium: طارد العرض والتمدد وتحكمًا نظيفًا في لوح الكتف.',
    'Premium priority: drive leg mass with clean depth and stable tempo.': 'أولوية Premium: ادفع كتلة الأرجل بعمق نظيف وتمبو ثابت.',
    'Push each set into a controlled dropset.': 'ادفع كل مجموعة إلى دروب سيت مضبوط.',
  },
  it: {
    title: 'Piano T-2 Bulking',
    badge: 'Template Bulk RepSet',
    summary: 'Una struttura bulk a rotazione di 2 settimane per aumentare spessore del petto, larghezza dorsale, massa gambe e densita generale.',
    usePlan: 'Usalo Come Mio Piano',
    usingPlan: 'Salvataggio...',
    activePlan: 'Attivo In My Plan',
    modalTitle: 'Vuoi scegliere T-2 Bulking come piano personale?',
    modalBody: 'Questo salvera T-2 Bulking come piano attivo nella pagina My Plan.',
    modalHint: 'Potrai personalizzare esercizi e carichi target piu avanti.',
    confirm: 'Si, usa T-2 Bulking',
    cancel: 'Annulla',
    noSession: 'Nessuna sessione utente attiva trovata.',
    saveFailed: 'Impossibile salvare T-2 Bulking come tuo piano.',
    success: 'T-2 Bulking ora e salvato come piano attivo in My Plan.',
    payloadName: 'Piano Personale T-2 Bulking',
    payloadDescription: 'Template T-2 bulking applicato come piano personale attivo.',
  },
  de: {
    title: 'T-2 Bulking-Plan',
    badge: 'RepSet-Bulking-Vorlage',
    summary: 'Eine 2-Wochen-Rotation fuer mehr Brustdichte, Rueckenbreite, Beinmasse und Gesamtdichte bei straffer Taille.',
    usePlan: 'Als Meinen Plan Nutzen',
    usingPlan: 'Speichern...',
    activePlan: 'In My Plan Aktiv',
    modalTitle: 'Moechtest du T-2 Bulking als deinen persoenlichen Plan waehlen?',
    modalBody: 'Dadurch wird T-2 Bulking als aktiver Plan auf der Seite My Plan gespeichert.',
    modalHint: 'Du kannst Uebungen und Zielgewichte spaeter noch anpassen.',
    confirm: 'Ja, T-2 Bulking nutzen',
    cancel: 'Abbrechen',
    noSession: 'Keine aktive Benutzersitzung gefunden.',
    saveFailed: 'T-2 Bulking konnte nicht als dein Plan gespeichert werden.',
    success: 'T-2 Bulking ist jetzt als aktiver Plan in My Plan gespeichert.',
    payloadName: 'T-2 Bulking Persoenlicher Plan',
    payloadDescription: 'T-2-Bulking-Vorlage als aktiver persoenlicher Plan angewendet.',
  },
};

const PREMIUM_UI_COPY: LocalizedLanguageRecord<{
  setupTitle: string;
  setupBody: string;
  surplusMode: string;
  weakPointFocus: string;
  recoveryMode: string;
  clean: string;
  balanced: string;
  aggressive: string;
  upperChest: string;
  vTaper: string;
  legs: string;
  protect: string;
  performance: string;
}> = {
  en: {
    setupTitle: 'Premium setup',
    setupBody: 'Choose how RepSet should bias growth, recovery, and weak-point attention inside T-2 Bulking.',
    surplusMode: 'Surplus mode',
    weakPointFocus: 'Weak point focus',
    recoveryMode: 'Recovery bias',
    clean: 'Clean bulk',
    balanced: 'Balanced',
    aggressive: 'Push size',
    upperChest: 'Upper chest',
    vTaper: 'V taper',
    legs: 'Leg mass',
    protect: 'Protect recovery',
    performance: 'Push output',
  },
  ar: {
    setupTitle: 'إعداد Premium',
    setupBody: 'اختر كيف يوجه RepSet النمو والاستشفاء وتركيز نقطة الضعف داخل T-2 للتضخيم.',
    surplusMode: 'نمط الفائض',
    weakPointFocus: 'تركيز نقطة الضعف',
    recoveryMode: 'اتجاه الاستشفاء',
    clean: 'تضخيم نظيف',
    balanced: 'متوازن',
    aggressive: 'دفع الحجم',
    upperChest: 'أعلى الصدر',
    vTaper: 'شكل V',
    legs: 'كتلة الأرجل',
    protect: 'حماية الاستشفاء',
    performance: 'دفع الأداء',
  },
  it: {
    setupTitle: 'Setup premium',
    setupBody: 'Scegli come RepSet deve guidare crescita, recupero e focus punto debole in T-2 Bulking.',
    surplusMode: 'Modalita surplus',
    weakPointFocus: 'Focus punto debole',
    recoveryMode: 'Bias recupero',
    clean: 'Bulk pulito',
    balanced: 'Bilanciato',
    aggressive: 'Spingi massa',
    upperChest: 'Petto alto',
    vTaper: 'V taper',
    legs: 'Massa gambe',
    protect: 'Proteggi recupero',
    performance: 'Spingi output',
  },
  de: {
    setupTitle: 'Premium-Setup',
    setupBody: 'Waehle, wie RepSet Wachstum, Erholung und Schwachstellenfokus in T-2 Bulking steuern soll.',
    surplusMode: 'Surplus-Modus',
    weakPointFocus: 'Schwachstellenfokus',
    recoveryMode: 'Erholungs-Bias',
    clean: 'Sauberer Bulk',
    balanced: 'Ausgewogen',
    aggressive: 'Groesse pushen',
    upperChest: 'Obere Brust',
    vTaper: 'V-Taper',
    legs: 'Beinmasse',
    protect: 'Erholung schuetzen',
    performance: 'Leistung pushen',
  },
};

const T2_BULKING_CONTENT_COPY: LocalizedLanguageRecord<Record<string, string>> = {
  en: {},
  ar: {
    '8 Weeks': '8 أسابيع',
    '4 Days': '4 أيام',
    'A/B Rotation': 'تناوب A/B',
    'Aesthetic Bulk': 'تضخيم جمالي',
    'Goal Priorities': 'أولويات الهدف',
    Structure: 'الهيكل',
    Repeat: 'التكرار',
    'Week A': 'الأسبوع A',
    'Week B': 'الأسبوع B',
    'Mechanical Strength Bias': 'تركيز ميكانيكي على القوة',
    'Hypertrophy Stretch Bias': 'تركيز تضخيم مع التمدد',
    'T-2 Smart Progression Rule': 'قاعدة التدرج الذكية لـ T-2',
    'Smart Overload System Structure': 'هيكل نظام الزيادة الذكية',
    'Micro Overload Rule': 'قاعدة الزيادة الميكروية',
    'How to Calculate Your Starting Weight': 'كيفية حساب وزن البداية',
    Formula: 'المعادلة',
    'Critical T-2 Rules': 'قواعد T-2 الأساسية',
    'Expected Results': 'النتائج المتوقعة',
    'RepSet comment:': 'ملاحظة RepSet:',
    'Technique:': 'التقنية:',
    'Upper Chest + Back Width': 'أعلى الصدر + عرض الظهر',
    'Legs Mass Builder': 'بناء كتلة الأرجل',
    'Push Volume': 'حجم الدفع',
    'Pull Density + Glutes': 'كثافة السحب + الألوية',
    'Chest Stretch + Lats': 'تمدد الصدر + اللاتس',
    'Quad Focus': 'تركيز الرباعية',
    'Shoulder Aesthetic + Chest Pump': 'جمالية الأكتاف + ضخ الصدر',
    'Back Width Elite': 'عرض ظهر متقدم',
  },
  it: {
    '8 Weeks': '8 Settimane',
    '4 Days': '4 Giorni',
    'A/B Rotation': 'Rotazione A/B',
    'Aesthetic Bulk': 'Bulk Estetico',
    'Goal Priorities': 'Priorita Obiettivo',
    Structure: 'Struttura',
    Repeat: 'Ripeti',
    'Week A': 'Settimana A',
    'Week B': 'Settimana B',
    'Mechanical Strength Bias': 'Bias Forza Meccanica',
    'Hypertrophy Stretch Bias': 'Bias Stretch Ipertrofia',
    'T-2 Smart Progression Rule': 'Regola Smart di Progressione T-2',
    'Smart Overload System Structure': 'Struttura del Sistema Smart Overload',
    'Micro Overload Rule': 'Regola Micro Overload',
    'How to Calculate Your Starting Weight': 'Come Calcolare il Peso Iniziale',
    Formula: 'Formula',
    'Critical T-2 Rules': 'Regole Critiche T-2',
    'Expected Results': 'Risultati Attesi',
    'RepSet comment:': 'Nota RepSet:',
    'Technique:': 'Tecnica:',
    'Increase chest thickness + upper chest': 'Aumenta spessore del petto e petto alto',
    'Increase lat width (V shape)': 'Aumenta la larghezza dei dorsali (V shape)',
    'Add leg mass (quads + hamstrings)': 'Aggiungi massa alle gambe (quadricipiti + femorali)',
    'Maintain waist tight': 'Mantieni la vita stretta',
    'Improve overall density': 'Migliora la densita generale',
    'A -> B -> A -> B for the 8-week cycle.': 'A -> B -> A -> B per tutto il ciclo di 8 settimane.',
    'Strength + base mass with chest thickness, lat width, and lower-body overload.': 'Forza + massa base con spessore del petto, larghezza dorsale e overload lower body.',
    'Push heavier loads, perfect tempo, and build the base for later hypertrophy expansion.': 'Spingi carichi piu alti, tempo perfetto e costruisci la base per l espansione ipertrofica successiva.',
    'Change the stimulus, chase stretch-mediated growth, and accumulate cleaner hypertrophy volume.': 'Cambia lo stimolo, cerca crescita mediata dallo stretch e accumula volume ipertrofico piu pulito.',
    'Week B chases more reps, deeper stretch, and expansion work instead of just heavier loading.': 'La settimana B cerca piu reps, stretch piu profondo e lavoro di espansione invece del solo carico pesante.',
    'Upper chest density plus V-shape back work with direct arm support volume.': 'Densita del petto alto piu lavoro schiena V-shape con volume di supporto per le braccia.',
    'Heavy lower-body day built to drive quad and hamstring mass with stable progression.': 'Giornata lower body pesante per aumentare massa di quadricipiti e femorali con progressione stabile.',
    'Chest and shoulder volume day to build shape, fullness, and pressing density.': 'Giornata volume per petto e spalle per costruire forma, pienezza e densita di spinta.',
    'Posterior-chain density with back thickness, rear-delt detail, and glute overload.': 'Densita catena posteriore con spessore dorsale, dettaglio deltoidi posteriori e overload dei glutei.',
    'Upper chest and lats get a longer-range, fuller hypertrophy stimulus.': 'Petto alto e dorsali ricevono uno stimolo ipertrofico piu ampio e pieno.',
    'Quad-dominant lower-body work with unilateral control and longer tension exposure.': 'Lavoro lower body dominante sui quadricipiti con controllo unilaterale e tensione piu lunga.',
    'Frame-building shoulder work followed by chest pump expansion.': 'Lavoro spalle per costruire il frame seguito da espansione del pump del petto.',
    'Width-biased pulling with density support and glute reinforcement.': 'Trazioni orientate alla larghezza con supporto di densita e rinforzo dei glutei.',
    'Increase weight.': 'Aumenta il carico.',
    'Increase reps.': 'Aumenta le reps.',
    'Example: Week A incline press = 60kg, Week B = 12 reps, next cycle Week A = 62.5kg, Week B = 13 reps.': 'Esempio: Week A incline press = 60kg, Week B = 12 reps, ciclo successivo Week A = 62.5kg, Week B = 13 reps.',
    'Load progression': 'Progressione del carico',
    'Rep progression': 'Progressione delle reps',
    'Density progression': 'Progressione della densita',
    'Neural adaptation': 'Adattamento neurale',
    'Volume cycling': 'Ciclizzazione del volume',
    '1. Neural Base': '1. Base neurale',
    '2. Volume Expansion': '2. Espansione del volume',
    '3. Density Overload': '3. Overload di densita',
    '4. Growth Peak': '4. Picco di crescita',
    'Each week also layer in a higher-stimulus technique on isolation work.': 'Ogni settimana aggiungi anche una tecnica a stimolo piu alto sul lavoro di isolamento.',
    'Week 1 -> Normal execution': 'Settimana 1 -> esecuzione normale',
    'Week 2 -> Slow eccentric': 'Settimana 2 -> eccentrica lenta',
    'Week 3 -> Stretch hold': 'Settimana 3 -> tenuta in stretch',
    'Week 4 -> Dropset': 'Settimana 4 -> dropset',
    'Week 5 -> Partial reps': 'Settimana 5 -> reps parziali',
    'Week 6 -> Supersets': 'Settimana 6 -> superset',
    'Week 7 -> Giant sets': 'Settimana 7 -> giant set',
    'Week 8 -> Deload pump': 'Settimana 8 -> deload pump',
    'Start weight = weight you can lift x 0.65': 'Peso iniziale = peso che puoi sollevare x 0.65',
    'Example: Incline DB press max = 30kg, so week 1 starts at 20kg.': 'Esempio: max incline DB press = 30kg, quindi la settimana 1 parte da 20kg.',
    'Eat in a surplus': 'Mangia in surplus',
    'Sleep 8 hours': 'Dormi 8 ore',
    'Never skip leg day': 'Non saltare mai il leg day',
    'Track strength weekly': 'Monitora la forza ogni settimana',
    'No ego lifting': 'Niente ego lifting',
    'Perfect tempo': 'Tempo perfetto',
    'Month 1 -> Strength jump': 'Mese 1 -> salto di forza',
    'Month 2 -> Visual size': 'Mese 2 -> taglia visiva',
    'Month 3 -> Physique change': 'Mese 3 -> cambiamento del fisico',
    'Month 6 -> Elite aesthetic': 'Mese 6 -> estetica elite',
    'Incline Bench (Weak Point Priority)': 'Panca inclinata (priorita punto debole)',
    'Chest thickness and upper chest progression anchor.': 'Punto di ancoraggio per spessore del petto e progressione del petto alto.',
    'Squat (Leg Mass Priority)': 'Squat (priorita massa gambe)',
    'Quad recruitment and lower-body mass build.': 'Reclutamento dei quadricipiti e costruzione di massa lower body.',
    'Deadlift (Posterior Chain)': 'Deadlift (catena posteriore)',
    'Posterior-chain loading and density progression.': 'Carico della catena posteriore e progressione della densita.',
    'Pull-ups (Back Width)': 'Pull-up (larghezza schiena)',
    'Width progression through load and density.': 'Progressione della larghezza tramite carico e densita.',
    'Shoulder Press (Frame Builder)': 'Shoulder press (costruzione del frame)',
    'Frame-building progression across the cycle.': 'Progressione di costruzione del frame lungo il ciclo.',
    Week: 'Settimana',
    Sets: 'Set',
    Reps: 'Reps',
    'Load %': 'Carico %',
    Strategy: 'Strategia',
    'Technique build': 'Costruzione tecnica',
    'Rep overload': 'Overload di reps',
    'Volume growth': 'Crescita del volume',
    'Neural load': 'Carico neurale',
    'Strength hypertrophy': 'Ipertrofia di forza',
    'Chest expansion': 'Espansione del petto',
    'Growth pump reset': 'Reset pump di crescita',
    'Neural base': 'Base neurale',
    Adaptation: 'Adattamento',
    'Strength stimulus': 'Stimolo di forza',
    'Quad recruitment': 'Reclutamento quadricipiti',
    'Mass overload': 'Overload di massa',
    'CNS peak': 'Picco SNC',
    Density: 'Densita',
    'Recovery hypertrophy': 'Ipertrofia di recupero',
    Technique: 'Tecnica',
    Neural: 'Neurale',
    'Posterior growth': 'Crescita posteriore',
    Strength: 'Forza',
    'Glute load': 'Carico glutei',
    'CNS overload': 'Overload SNC',
    Recovery: 'Recupero',
    'Bodyweight max': 'Massimo a corpo libero',
    Neuromuscular: 'Neuromuscolare',
    Overload: 'Overload',
    'Lat growth': 'Crescita dei dorsali',
    'Width expansion': 'Espansione della larghezza',
    Peak: 'Picco',
    'Elite overload': 'Overload elite',
    'BW pump': 'Pump a corpo libero',
    'Working sets': 'Set di lavoro',
    'Week focus:': 'Focus settimana:',
    'Premium bulk mode: keep the surplus clean and prioritize quality reps.': 'Modalita bulk premium: mantieni il surplus pulito e dai priorita alla qualita delle reps.',
    'Premium bulk mode: push size with higher demand and denser execution.': 'Modalita bulk premium: spingi la massa con richiesta piu alta ed esecuzione piu densa.',
    'Premium bulk mode: balance growth, recovery, and clean progression.': 'Modalita bulk premium: bilancia crescita, recupero e progressione pulita.',
    'Recovery bias: protect performance quality and leave one clean rep in reserve when needed.': 'Bias recupero: proteggi la qualita della performance e lascia una rep pulita in riserva quando serve.',
    'Recovery bias: push output harder before backing off volume.': 'Bias recupero: spingi di piu l output prima di ridurre il volume.',
    'Recovery bias: balanced fatigue and progression management.': 'Bias recupero: gestione bilanciata di fatica e progressione.',
    'Weak-point focus: give extra attention to lat width and shoulder-frame work.': 'Focus punto debole: dai piu attenzione alla larghezza dei dorsali e al lavoro sul frame delle spalle.',
    'Weak-point focus: leg mass is prioritized through cleaner lower-body execution.': 'Focus punto debole: la massa gambe ha priorita tramite un esecuzione lower body piu pulita.',
    'Weak-point focus: upper-chest density is the primary premium priority.': 'Focus punto debole: la densita del petto alto e la priorita premium principale.',
    'Premium priority: slow the eccentric and own the upper-chest contraction.': 'Priorita premium: rallenta l eccentrica e controlla la contrazione del petto alto.',
    'Premium priority: chase width, stretch, and clean scapular control.': 'Priorita premium: cerca larghezza, stretch e controllo scapolare pulito.',
    'Premium priority: drive leg mass with clean depth and stable tempo.': 'Priorita premium: guida la massa delle gambe con profondita pulita e tempo stabile.',
    'Push each set into a controlled dropset.': 'Porta ogni set in un dropset controllato.',
  },
  de: {
    '8 Weeks': '8 Wochen',
    '4 Days': '4 Tage',
    'A/B Rotation': 'A/B-Rotation',
    'Aesthetic Bulk': 'Aesthetischer Bulk',
    'Goal Priorities': 'Zielprioritaeten',
    Structure: 'Struktur',
    Repeat: 'Wiederholung',
    'Week A': 'Woche A',
    'Week B': 'Woche B',
    'Mechanical Strength Bias': 'Mechanischer Kraftfokus',
    'Hypertrophy Stretch Bias': 'Hypertrophie-Stretch-Fokus',
    'T-2 Smart Progression Rule': 'T-2 Smart-Progressionsregel',
    'Smart Overload System Structure': 'Struktur des Smart-Overload-Systems',
    'Micro Overload Rule': 'Micro-Overload-Regel',
    'How to Calculate Your Starting Weight': 'So berechnest du dein Startgewicht',
    Formula: 'Formel',
    'Critical T-2 Rules': 'Kritische T-2-Regeln',
    'Expected Results': 'Erwartete Ergebnisse',
    'RepSet comment:': 'RepSet-Hinweis:',
    'Technique:': 'Technik:',
    'Increase chest thickness + upper chest': 'Mehr Brustdichte und obere Brust aufbauen',
    'Increase lat width (V shape)': 'Mehr Lat-Breite (V-Form) aufbauen',
    'Add leg mass (quads + hamstrings)': 'Beinmasse aufbauen (Quadrizeps + Hamstrings)',
    'Maintain waist tight': 'Taille straff halten',
    'Improve overall density': 'Gesamtdichte verbessern',
    'A -> B -> A -> B for the 8-week cycle.': 'A -> B -> A -> B fuer den gesamten 8-Wochen-Zyklus.',
    'Strength + base mass with chest thickness, lat width, and lower-body overload.': 'Kraft + Grundmasse mit Brustdichte, Rueckenbreite und Lower-Body-Overload.',
    'Push heavier loads, perfect tempo, and build the base for later hypertrophy expansion.': 'Schwerere Lasten bewegen, perfektes Tempo halten und die Basis fuer spaetere Hypertrophie aufbauen.',
    'Change the stimulus, chase stretch-mediated growth, and accumulate cleaner hypertrophy volume.': 'Den Reiz veraendern, stretch-vermitteltes Wachstum suchen und saubereres Hypertrophie-Volumen aufbauen.',
    'Week B chases more reps, deeper stretch, and expansion work instead of just heavier loading.': 'Woche B jagt mehr Wiederholungen, tieferen Stretch und Expansionsarbeit statt nur schwerere Lasten.',
    'Upper chest density plus V-shape back work with direct arm support volume.': 'Dichte obere Brust plus Rueckenarbeit fuer die V-Form mit direktem Arm-Support-Volumen.',
    'Heavy lower-body day built to drive quad and hamstring mass with stable progression.': 'Schwerer Unterkoerpertag fuer mehr Quadrizeps- und Hamstring-Masse mit stabiler Progression.',
    'Chest and shoulder volume day to build shape, fullness, and pressing density.': 'Volumentag fuer Brust und Schultern, um Form, Fuelle und Druckdichte aufzubauen.',
    'Posterior-chain density with back thickness, rear-delt detail, and glute overload.': 'Dichte der hinteren Kette mit Rueckendicke, Rear-Delt-Details und Glute-Overload.',
    'Upper chest and lats get a longer-range, fuller hypertrophy stimulus.': 'Obere Brust und Lats erhalten einen groesseren Bewegungsradius und volleren Hypertrophie-Reiz.',
    'Quad-dominant lower-body work with unilateral control and longer tension exposure.': 'Quadrizeps-dominante Unterkoerperarbeit mit unilateralem Fokus und laengerer Spannungszeit.',
    'Frame-building shoulder work followed by chest pump expansion.': 'Schulterarbeit zum Frame-Aufbau gefolgt von Brust-Pump-Expansion.',
    'Width-biased pulling with density support and glute reinforcement.': 'Auf Breite fokussiertes Ziehen mit Dichte-Support und Glute-Verstaerkung.',
    'Increase weight.': 'Gewicht steigern.',
    'Increase reps.': 'Wiederholungen steigern.',
    'Example: Week A incline press = 60kg, Week B = 12 reps, next cycle Week A = 62.5kg, Week B = 13 reps.': 'Beispiel: Woche A Schraegdruecken = 60kg, Woche B = 12 Wiederholungen, naechster Zyklus Woche A = 62.5kg, Woche B = 13 Wiederholungen.',
    'Load progression': 'Lastprogression',
    'Rep progression': 'Wiederholungsprogression',
    'Density progression': 'Dichteprogression',
    'Neural adaptation': 'Neuronale Anpassung',
    'Volume cycling': 'Volumen-Zyklisierung',
    '1. Neural Base': '1. Neuronale Basis',
    '2. Volume Expansion': '2. Volumen-Expansion',
    '3. Density Overload': '3. Dichte-Overload',
    '4. Growth Peak': '4. Wachstumsspitze',
    'Each week also layer in a higher-stimulus technique on isolation work.': 'Fuege jede Woche auch eine staerkere Reiztechnik fuer Isolationsarbeit hinzu.',
    'Week 1 -> Normal execution': 'Woche 1 -> normale Ausfuehrung',
    'Week 2 -> Slow eccentric': 'Woche 2 -> langsame Exzentrik',
    'Week 3 -> Stretch hold': 'Woche 3 -> Stretch-Hold',
    'Week 4 -> Dropset': 'Woche 4 -> Dropset',
    'Week 5 -> Partial reps': 'Woche 5 -> Teilwiederholungen',
    'Week 6 -> Supersets': 'Woche 6 -> Supersaetze',
    'Week 7 -> Giant sets': 'Woche 7 -> Giant Sets',
    'Week 8 -> Deload pump': 'Woche 8 -> Pump-Deload',
    'Start weight = weight you can lift x 0.65': 'Startgewicht = Gewicht, das du heben kannst x 0.65',
    'Example: Incline DB press max = 30kg, so week 1 starts at 20kg.': 'Beispiel: Max Schraegdruecken mit DB = 30kg, also startet Woche 1 bei 20kg.',
    'Eat in a surplus': 'Im Ueberschuss essen',
    'Sleep 8 hours': '8 Stunden schlafen',
    'Never skip leg day': 'Beintag nie auslassen',
    'Track strength weekly': 'Kraft woechentlich tracken',
    'No ego lifting': 'Kein Ego-Lifting',
    'Perfect tempo': 'Perfektes Tempo',
    'Month 1 -> Strength jump': 'Monat 1 -> Kraftsprung',
    'Month 2 -> Visual size': 'Monat 2 -> sichtbare Groesse',
    'Month 3 -> Physique change': 'Monat 3 -> Physique-Veraenderung',
    'Month 6 -> Elite aesthetic': 'Monat 6 -> Elite-Aesthetik',
    'Incline Bench (Weak Point Priority)': 'Schraegbank (Schwachstellen-Prioritaet)',
    'Chest thickness and upper chest progression anchor.': 'Anker fuer Brustdichte und Progression der oberen Brust.',
    'Squat (Leg Mass Priority)': 'Squat (Beinmassen-Prioritaet)',
    'Quad recruitment and lower-body mass build.': 'Quadrizeps-Rekrutierung und Aufbau von Unterkoerpermasse.',
    'Deadlift (Posterior Chain)': 'Deadlift (hintere Kette)',
    'Posterior-chain loading and density progression.': 'Belastung der hinteren Kette und Dichteprogression.',
    'Pull-ups (Back Width)': 'Klimmzuege (Rueckenbreite)',
    'Width progression through load and density.': 'Breitenprogression ueber Last und Dichte.',
    'Shoulder Press (Frame Builder)': 'Schulterdruecken (Frame Builder)',
    'Frame-building progression across the cycle.': 'Frame-Building-Progression ueber den Zyklus.',
    Week: 'Woche',
    Sets: 'Saetze',
    Reps: 'Wiederholungen',
    'Load %': 'Last %',
    Strategy: 'Strategie',
    'Technique build': 'Technikaufbau',
    'Rep overload': 'Wiederholungs-Overload',
    'Volume growth': 'Volumenwachstum',
    'Neural load': 'Neuronale Last',
    'Strength hypertrophy': 'Kraft-Hypertrophie',
    'Chest expansion': 'Brust-Expansion',
    'Growth pump reset': 'Growth-Pump-Reset',
    'Neural base': 'Neuronale Basis',
    Adaptation: 'Anpassung',
    'Strength stimulus': 'Kraftreiz',
    'Quad recruitment': 'Quadrizeps-Rekrutierung',
    'Mass overload': 'Massen-Overload',
    'CNS peak': 'ZNS-Spitze',
    Density: 'Dichte',
    'Recovery hypertrophy': 'Recovery-Hypertrophie',
    Technique: 'Technik',
    Neural: 'Neural',
    'Posterior growth': 'Wachstum der hinteren Kette',
    Strength: 'Kraft',
    'Glute load': 'Glute-Last',
    'CNS overload': 'ZNS-Overload',
    Recovery: 'Erholung',
    'Bodyweight max': 'Koerpergewicht-Max',
    Neuromuscular: 'Neuromuskulaer',
    Overload: 'Overload',
    'Lat growth': 'Lat-Wachstum',
    'Width expansion': 'Breiten-Expansion',
    Peak: 'Peak',
    'Elite overload': 'Elite-Overload',
    'BW pump': 'BW-Pump',
    'Working sets': 'Arbeitssaetze',
    'Week focus:': 'Wochenfokus:',
    'Premium bulk mode: keep the surplus clean and prioritize quality reps.': 'Premium-Bulk-Modus: halte den Ueberschuss sauber und priorisiere qualitative Wiederholungen.',
    'Premium bulk mode: push size with higher demand and denser execution.': 'Premium-Bulk-Modus: pushe Masse mit hoeherer Anforderung und dichterer Ausfuehrung.',
    'Premium bulk mode: balance growth, recovery, and clean progression.': 'Premium-Bulk-Modus: balanciere Wachstum, Erholung und saubere Progression.',
    'Recovery bias: protect performance quality and leave one clean rep in reserve when needed.': 'Erholungs-Bias: schuetze die Leistungsqualitaet und lasse bei Bedarf eine saubere Wiederholung im Tank.',
    'Recovery bias: push output harder before backing off volume.': 'Erholungs-Bias: pushe den Output haerter, bevor du das Volumen reduzierst.',
    'Recovery bias: balanced fatigue and progression management.': 'Erholungs-Bias: ausgewogene Steuerung von Ermuedung und Progression.',
    'Weak-point focus: give extra attention to lat width and shoulder-frame work.': 'Schwachstellenfokus: gib Lat-Breite und Schulter-Frame-Arbeit extra Aufmerksamkeit.',
    'Weak-point focus: leg mass is prioritized through cleaner lower-body execution.': 'Schwachstellenfokus: Beinmasse wird durch sauberere Lower-Body-Ausfuehrung priorisiert.',
    'Weak-point focus: upper-chest density is the primary premium priority.': 'Schwachstellenfokus: Dichte der oberen Brust ist die zentrale Premium-Prioritaet.',
    'Premium priority: slow the eccentric and own the upper-chest contraction.': 'Premium-Prioritaet: verlangsame die Exzentrik und kontrolliere die Kontraktion der oberen Brust.',
    'Premium priority: chase width, stretch, and clean scapular control.': 'Premium-Prioritaet: jage Breite, Stretch und saubere Schulterblattkontrolle.',
    'Premium priority: drive leg mass with clean depth and stable tempo.': 'Premium-Prioritaet: treibe Beinmasse mit sauberer Tiefe und stabilem Tempo voran.',
    'Push each set into a controlled dropset.': 'Fuehre jeden Satz in ein kontrolliertes Dropset.',
  },
};

const translateT2BulkingText = (language: AppLanguage, value: string) =>
  T2_BULKING_CONTENT_COPY[language]?.[value] || value;

const localizeT2BulkingDayLabel = (language: AppLanguage, dayLabel: string) => {
  const dayNumber = String(dayLabel || '').match(/\d+/)?.[0];
  if (!dayNumber) return translateT2BulkingText(language, dayLabel);
  if (language === 'ar') return `اليوم ${dayNumber}`;
  if (language === 'it') return `Giorno ${dayNumber}`;
  if (language === 'de') return `Tag ${dayNumber}`;
  return dayLabel;
};

const PREMIUM_STORAGE_KEY = 'assignedProgramTemplate';

const DEFAULT_T2_BULKING_PREMIUM_CONFIG: T2BulkingPremiumConfig = {
  planKind: 't2-bulk',
  surplusMode: 'balanced',
  weakPointFocus: 'upper_chest',
  recoveryMode: 'balanced',
};

const safeParseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizePremiumConfig = (raw?: Partial<T2BulkingPremiumConfig> | null): T2BulkingPremiumConfig => ({
  planKind: 't2-bulk',
  surplusMode: raw?.surplusMode === 'clean' || raw?.surplusMode === 'aggressive' ? raw.surplusMode : 'balanced',
  weakPointFocus: raw?.weakPointFocus === 'v_taper' || raw?.weakPointFocus === 'legs' ? raw.weakPointFocus : 'upper_chest',
  recoveryMode: raw?.recoveryMode === 'protect' || raw?.recoveryMode === 'performance' ? raw.recoveryMode : 'balanced',
});

const getStoredPremiumConfig = (): T2BulkingPremiumConfig => {
  if (typeof window === 'undefined') return DEFAULT_T2_BULKING_PREMIUM_CONFIG;
  const stored = safeParseJson<Record<string, unknown> | null>(window.localStorage.getItem(PREMIUM_STORAGE_KEY), null);
  return normalizePremiumConfig((stored?.premiumBulkingConfig as Partial<T2BulkingPremiumConfig> | undefined) || null);
};

const DAY_NAME: Record<string, string> = {
  'Day 1': 'monday',
  'Day 2': 'tuesday',
  'Day 3': 'thursday',
  'Day 4': 'friday',
};

const weeks: WeekPlan[] = [
  {
    key: 'A',
    title: 'Week A',
    subtitle: 'Mechanical Strength Bias',
    goal: 'Strength + base mass with chest thickness, lat width, and lower-body overload.',
    note: 'Push heavier loads, perfect tempo, and build the base for later hypertrophy expansion.',
    days: [
      {
        dayLabel: 'Day 1',
        focus: 'Upper Chest + Back Width',
        summary: 'Upper chest density plus V-shape back work with direct arm support volume.',
        targetMuscles: ['Chest', 'Back', 'Shoulders'],
        exercises: [
          { name: 'Incline Barbell Press', prescription: '4 x 6-8', comment: 'Upper chest density priority.' },
          { name: 'Weighted Dips', prescription: '4 x 8', comment: 'Chest thickness and pressing power.' },
          { name: 'Wide Grip Lat Pulldown', prescription: '4 x 10', comment: 'Lat width builder.' },
          { name: 'Chest Supported Row', prescription: '3 x 10', comment: 'Add upper-back density without cheating.' },
          { name: 'Lateral Raise', prescription: '4 x 15', comment: 'Keep the frame wide.' },
          { name: 'EZ Bar Curl', prescription: '3 x 12' },
          { name: 'Rope Pushdown', prescription: '3 x 12' },
        ],
      },
      {
        dayLabel: 'Day 2',
        focus: 'Legs Mass Builder',
        summary: 'Heavy lower-body day built to drive quad and hamstring mass with stable progression.',
        targetMuscles: ['Quadriceps', 'Hamstrings', 'Calves'],
        exercises: [
          { name: 'Back Squat', prescription: '4 x 6', comment: 'Main leg mass priority.' },
          { name: 'Romanian Deadlift', prescription: '4 x 8', comment: 'Posterior chain load with stretch.' },
          { name: 'Leg Press', prescription: '3 x 12', comment: 'Controlled volume after heavy squats.' },
          { name: 'Seated Leg Curl', prescription: '3 x 12' },
          { name: 'Standing Calf Raise', prescription: '5 x 12' },
        ],
      },
      {
        dayLabel: 'Day 3',
        focus: 'Push Volume',
        summary: 'Chest and shoulder volume day to build shape, fullness, and pressing density.',
        targetMuscles: ['Chest', 'Shoulders', 'Triceps'],
        exercises: [
          { name: 'Incline DB Press', prescription: '4 x 10', comment: 'Drive upper chest fiber volume.' },
          { name: 'Machine Chest Press', prescription: '3 x 12', comment: 'Stable hypertrophy work.' },
          { name: 'Cable Fly', prescription: '3 x 15', comment: 'Stretch and control.' },
          { name: 'Seated Shoulder Press', prescription: '4 x 8', comment: 'Frame builder.' },
          { name: 'Lateral Raise Dropset', prescription: '3 sets', technique: 'Push each set into a controlled dropset.' },
          { name: 'Skullcrusher', prescription: '3 x 12' },
        ],
      },
      {
        dayLabel: 'Day 4',
        focus: 'Pull Density + Glutes',
        summary: 'Posterior-chain density with back thickness, rear-delt detail, and glute overload.',
        targetMuscles: ['Back', 'Glutes', 'Biceps'],
        exercises: [
          { name: 'Deadlift', prescription: '4 x 5', comment: 'Heavy posterior-chain anchor.' },
          { name: 'Pull-ups', prescription: '4 x max', comment: 'Back width and control.' },
          { name: 'Barbell Row', prescription: '3 x 8', comment: 'Mid-back density.' },
          { name: 'Face Pull', prescription: '4 x 15' },
          { name: 'Rear Delt Fly', prescription: '3 x 15' },
          { name: 'Barbell Curl', prescription: '3 x 10' },
          { name: 'Hip Thrust', prescription: '4 x 10', comment: 'Glute load and hip drive.' },
        ],
      },
    ],
  },
  {
    key: 'B',
    title: 'Week B',
    subtitle: 'Hypertrophy Stretch Bias',
    goal: 'Change the stimulus, chase stretch-mediated growth, and accumulate cleaner hypertrophy volume.',
    note: 'Week B chases more reps, deeper stretch, and expansion work instead of just heavier loading.',
    days: [
      {
        dayLabel: 'Day 1',
        focus: 'Chest Stretch + Lats',
        summary: 'Upper chest and lats get a longer-range, fuller hypertrophy stimulus.',
        targetMuscles: ['Chest', 'Back', 'Shoulders'],
        exercises: [
          { name: 'Incline DB Press', prescription: '4 x 12', comment: 'Stretch-focused upper chest work.' },
          { name: 'Low Cable Fly', prescription: '3 x 15', comment: 'Deep stretch and squeeze.' },
          { name: 'Hammer Strength Press', prescription: '3 x 10', comment: 'Heavy hypertrophy without instability.' },
          { name: 'Single Arm Lat Pulldown', prescription: '4 x 12', comment: 'Lat width and asymmetry control.' },
          { name: 'Seated Cable Row', prescription: '3 x 12' },
          { name: 'Lateral Raise', prescription: '4 x 15' },
        ],
      },
      {
        dayLabel: 'Day 2',
        focus: 'Quad Focus',
        summary: 'Quad-dominant lower-body work with unilateral control and longer tension exposure.',
        targetMuscles: ['Quadriceps', 'Hamstrings', 'Calves'],
        exercises: [
          { name: 'Front Squat', prescription: '4 x 8', comment: 'Quad recruitment priority.' },
          { name: 'Bulgarian Split Squat', prescription: '3 x 12', comment: 'Single-leg mass and balance.' },
          { name: 'Hack Squat', prescription: '3 x 12', comment: 'Controlled quad overload.' },
          { name: 'Lying Leg Curl', prescription: '3 x 15' },
          { name: 'Seated Calf Raise', prescription: '5 x 15' },
        ],
      },
      {
        dayLabel: 'Day 3',
        focus: 'Shoulder Aesthetic + Chest Pump',
        summary: 'Frame-building shoulder work followed by chest pump expansion.',
        targetMuscles: ['Shoulders', 'Chest', 'Triceps'],
        exercises: [
          { name: 'Machine Shoulder Press', prescription: '4 x 10', comment: 'Stable aesthetic pressing.' },
          { name: 'Cable Lateral Raise', prescription: '4 x 15', comment: 'Constant tension caps the delts.' },
          { name: 'Rear Delt Machine', prescription: '4 x 15' },
          { name: 'Incline Machine Press', prescription: '3 x 12', comment: 'Upper chest pump.' },
          { name: 'Chest Fly Machine', prescription: '3 x 15' },
          { name: 'Triceps Rope', prescription: '3 x 12' },
        ],
      },
      {
        dayLabel: 'Day 4',
        focus: 'Back Width Elite',
        summary: 'Width-biased pulling with density support and glute reinforcement.',
        targetMuscles: ['Back', 'Glutes', 'Biceps'],
        exercises: [
          { name: 'Rack Pull', prescription: '4 x 6', comment: 'Top-range overload and density.' },
          { name: 'Weighted Pull-ups', prescription: '4 x 8', comment: 'Elite width builder.' },
          { name: 'T-Bar Row', prescription: '3 x 10', comment: 'Back thickness support.' },
          { name: 'Straight Arm Pulldown', prescription: '3 x 15', comment: 'Lat isolation and stretch.' },
          { name: 'Incline DB Curl', prescription: '3 x 12' },
          { name: 'Hammer Curl', prescription: '3 x 12' },
          { name: 'Hip Thrust', prescription: '4 x 12' },
        ],
      },
    ],
  },
];

const overloadPhases = [
  '1. Neural Base',
  '2. Volume Expansion',
  '3. Density Overload',
  '4. Growth Peak',
];

const microOverloadSteps = [
  'Week 1 -> Normal execution',
  'Week 2 -> Slow eccentric',
  'Week 3 -> Stretch hold',
  'Week 4 -> Dropset',
  'Week 5 -> Partial reps',
  'Week 6 -> Supersets',
  'Week 7 -> Giant sets',
  'Week 8 -> Deload pump',
];

const criticalRules = [
  'Eat in a surplus',
  'Sleep 8 hours',
  'Never skip leg day',
  'Track strength weekly',
  'No ego lifting',
  'Perfect tempo',
];

const expectedResults = [
  'Month 1 -> Strength jump',
  'Month 2 -> Visual size',
  'Month 3 -> Physique change',
  'Month 6 -> Elite aesthetic',
];

const progressionTables: TableDefinition[] = [
  {
    title: 'Incline Bench (Weak Point Priority)',
    subtitle: 'Chest thickness and upper chest progression anchor.',
    headers: ['Week', 'Sets', 'Reps', 'Load %', 'Strategy'],
    rows: [
      ['1', '4', '8', '65%', 'Technique build'],
      ['2', '4', '9', '67%', 'Rep overload'],
      ['3', '4', '10', '70%', 'Volume growth'],
      ['4', '5', '8', '72%', 'Neural load'],
      ['5', '5', '9', '75%', 'Strength hypertrophy'],
      ['6', '5', '10', '77%', 'Chest expansion'],
      ['7', '6', '8', '80%', 'Density overload'],
      ['8', '4', '12', '65%', 'Growth pump reset'],
    ],
  },
  {
    title: 'Squat (Leg Mass Priority)',
    subtitle: 'Quad recruitment and lower-body mass build.',
    headers: ['Week', 'Sets', 'Reps', 'Load %', 'Strategy'],
    rows: [
      ['1', '4', '6', '70%', 'Neural base'],
      ['2', '4', '7', '72%', 'Adaptation'],
      ['3', '5', '6', '75%', 'Strength stimulus'],
      ['4', '5', '7', '77%', 'Quad recruitment'],
      ['5', '5', '8', '80%', 'Mass overload'],
      ['6', '6', '6', '82%', 'CNS peak'],
      ['7', '6', '7', '85%', 'Density'],
      ['8', '4', '10', '65%', 'Recovery hypertrophy'],
    ],
  },
  {
    title: 'Deadlift (Posterior Chain)',
    subtitle: 'Posterior-chain loading and density progression.',
    headers: ['Week', 'Sets', 'Reps', 'Load %', 'Strategy'],
    rows: [
      ['1', '3', '5', '70%', 'Technique'],
      ['2', '4', '5', '75%', 'Neural'],
      ['3', '4', '6', '78%', 'Posterior growth'],
      ['4', '5', '5', '80%', 'Strength'],
      ['5', '5', '6', '82%', 'Glute load'],
      ['6', '6', '4', '85%', 'CNS overload'],
      ['7', '6', '5', '87%', 'Density'],
      ['8', '3', '8', '65%', 'Recovery'],
    ],
  },
  {
    title: 'Pull-ups (Back Width)',
    subtitle: 'Width progression through load and density.',
    headers: ['Week', 'Sets', 'Reps', 'Strategy'],
    rows: [
      ['1', '4', 'Bodyweight max', 'Neuromuscular'],
      ['2', '4', '+2kg', 'Overload'],
      ['3', '5', '+4kg', 'Lat growth'],
      ['4', '5', '+6kg', 'Density'],
      ['5', '6', '+8kg', 'Width expansion'],
      ['6', '6', '+10kg', 'Peak'],
      ['7', '7', '+12kg', 'Elite overload'],
      ['8', '4', 'BW pump', 'Recovery'],
    ],
  },
  {
    title: 'Shoulder Press (Frame Builder)',
    subtitle: 'Frame-building progression across the cycle.',
    headers: ['Week', 'Sets', 'Reps', 'Load %'],
    rows: [
      ['1', '4', '8', '65'],
      ['2', '4', '9', '68'],
      ['3', '4', '10', '70'],
      ['4', '5', '8', '72'],
      ['5', '5', '9', '75'],
      ['6', '5', '10', '77'],
      ['7', '6', '8', '80'],
      ['8', '4', '12', '65'],
    ],
  },
];

const parsePrescription = (exercise: Exercise) => {
  const text = String(exercise.prescription || '').trim().toLowerCase();
  const setsMatch = text.match(/^(\d+)\s*x\s*(.+)$/i);
  if (setsMatch) return { sets: Number(setsMatch[1] || 1), reps: setsMatch[2].trim() };

  const setsOnlyMatch = text.match(/^(\d+)\s*sets?$/i);
  if (setsOnlyMatch) return { sets: Number(setsOnlyMatch[1] || 1), reps: 'Working sets' };

  return { sets: 3, reps: exercise.prescription || '8-12' };
};

const getSurplusStrategyNote = (config: T2BulkingPremiumConfig) => {
  if (config.surplusMode === 'clean') return 'Premium bulk mode: keep the surplus clean and prioritize quality reps.';
  if (config.surplusMode === 'aggressive') return 'Premium bulk mode: push size with higher demand and denser execution.';
  return 'Premium bulk mode: balance growth, recovery, and clean progression.';
};

const getRecoveryStrategyNote = (config: T2BulkingPremiumConfig) => {
  if (config.recoveryMode === 'protect') return 'Recovery bias: protect performance quality and leave one clean rep in reserve when needed.';
  if (config.recoveryMode === 'performance') return 'Recovery bias: push output harder before backing off volume.';
  return 'Recovery bias: balanced fatigue and progression management.';
};

const getWeakPointStrategyNote = (config: T2BulkingPremiumConfig) => {
  if (config.weakPointFocus === 'v_taper') return 'Weak-point focus: give extra attention to lat width and shoulder-frame work.';
  if (config.weakPointFocus === 'legs') return 'Weak-point focus: leg mass is prioritized through cleaner lower-body execution.';
  return 'Weak-point focus: upper-chest density is the primary premium priority.';
};

const getExercisePremiumNote = (exerciseName: string, targetMuscles: string[], config: T2BulkingPremiumConfig) => {
  const name = exerciseName.toLowerCase();
  const muscles = targetMuscles.map((muscle) => muscle.toLowerCase());

  if (config.weakPointFocus === 'upper_chest' && (/incline|chest press|fly|dips/.test(name) || muscles.includes('chest'))) {
    return 'Premium priority: slow the eccentric and own the upper-chest contraction.';
  }
  if (config.weakPointFocus === 'v_taper' && (/pull|lat|row|lateral/.test(name) || muscles.includes('back') || muscles.includes('shoulders'))) {
    return 'Premium priority: chase width, stretch, and clean scapular control.';
  }
  if (config.weakPointFocus === 'legs' && (/squat|leg|deadlift|hip thrust|calf/.test(name) || muscles.includes('quadriceps') || muscles.includes('hamstrings'))) {
    return 'Premium priority: drive leg mass with clean depth and stable tempo.';
  }
  return '';
};

const buildPayload = (language: AppLanguage, premiumConfig: T2BulkingPremiumConfig) => {
  const copy = COPY[language] || COPY.en;
  const weekPlans = weeks.map((week) => ({
    weeklyWorkouts: week.days.map((day) => ({
      dayName: DAY_NAME[day.dayLabel] || 'monday',
      workoutName: `${translateT2BulkingText(language, week.title)} - ${translateT2BulkingText(language, day.focus)}`,
      workoutType: 'Custom',
      targetMuscles: day.targetMuscles,
      notes: [
        translateT2BulkingText(language, week.subtitle),
        translateT2BulkingText(language, day.summary),
        translateT2BulkingText(language, week.goal),
        translateT2BulkingText(language, getSurplusStrategyNote(premiumConfig)),
        translateT2BulkingText(language, getRecoveryStrategyNote(premiumConfig)),
        translateT2BulkingText(language, getWeakPointStrategyNote(premiumConfig)),
      ].filter(Boolean).join(' '),
      exercises: day.exercises.map((exercise) => {
        const parsed = parsePrescription(exercise);
        return {
          exerciseName: exercise.name,
          sets: parsed.sets,
          reps: translateT2BulkingText(language, parsed.reps),
          restSeconds: 90,
          targetWeight: 20,
          targetMuscles: day.targetMuscles,
          notes: [
            exercise.comment ? translateT2BulkingText(language, exercise.comment) : '',
            exercise.technique ? `${translateT2BulkingText(language, 'Technique:')} ${translateT2BulkingText(language, exercise.technique)}` : '',
            translateT2BulkingText(language, getExercisePremiumNote(exercise.name, day.targetMuscles, premiumConfig)),
            `${translateT2BulkingText(language, 'Week focus:')} ${translateT2BulkingText(language, week.subtitle)}`,
          ].filter(Boolean).join(' '),
        };
      }),
    })),
  }));

  return {
    planName: copy.payloadName,
    description: copy.payloadDescription,
    premiumBulkingConfig: premiumConfig,
    cycleWeeks: 8,
    templateWeekCount: 2,
    selectedDays: Object.values(DAY_NAME),
    weeklyWorkouts: weekPlans[0]?.weeklyWorkouts || [],
    weekPlans,
  };
};

function DataTable({ table, language }: { table: TableDefinition; language: AppLanguage }) {
  return (
    <Card className="border border-white/12 bg-white/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, table.title)}</h3>
      <p className="mt-2 text-sm text-text-secondary">{translateT2BulkingText(language, table.subtitle)}</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/10">
        <div
          className="grid min-w-[36rem] border-b border-white/10 bg-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary"
          style={{ gridTemplateColumns: `repeat(${table.headers.length}, minmax(0, 1fr))` }}
        >
          {table.headers.map((header) => (
            <span key={`${table.title}-${header}`}>{translateT2BulkingText(language, header)}</span>
          ))}
        </div>
        {table.rows.map((row, index) => (
          <div
            key={`${table.title}-${index}`}
            className="grid min-w-[36rem] gap-4 border-b border-white/10 px-4 py-3 text-sm last:border-b-0"
            style={{ gridTemplateColumns: `repeat(${table.headers.length}, minmax(0, 1fr))` }}
          >
            {row.map((cell, cellIndex) => (
              <span key={`${table.title}-${index}-${cellIndex}`} className={cellIndex === table.headers.length - 1 ? 'text-text-secondary' : 'text-text-primary'}>
                {translateT2BulkingText(language, cell)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function T2BulkingPlanScreen({ onBack }: T2BulkingPlanScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignedPlan, setAssignedPlan] = useState(() => getAssignedBookPlan());
  const [premiumConfig, setPremiumConfig] = useState<T2BulkingPremiumConfig>(() => getStoredPremiumConfig());
  const copy = useMemo(() => COPY[language] || COPY.en, [language]);
  const premiumCopy = useMemo(() => PREMIUM_UI_COPY[language] || PREMIUM_UI_COPY.en, [language]);
  const isArabic = language === 'ar';
  const isCurrentPlanActive = assignedPlan.id === 't-2-bulk';
  const modalCopy = useMemo(() => {
    if (assignedPlan.id && assignedPlan.id !== 't-2-bulk') {
      return getPlanSwitchPrompt({
        language,
        currentPlanName: assignedPlan.name || 'your current plan',
        nextPlanName: copy.title,
      });
    }

    return {
      title: copy.modalTitle,
      body: copy.modalBody,
      hint: copy.modalHint,
    };
  }, [assignedPlan.id, assignedPlan.name, copy.modalBody, copy.modalHint, copy.modalTitle, copy.title, language]);

  useEffect(() => {
    const syncAssignedPlan = () => setAssignedPlan(getAssignedBookPlan());
    const handleLanguageChanged = () => setLanguage(getStoredLanguage());
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

    const userId = Number(getStoredUserId() || 0);
    if (!userId) {
      setError(copy.noSession);
      return;
    }

    const payload = buildPayload(language, premiumConfig);
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
        setAssignedPlan({ id: 't-2-bulk', name: payload.planName });
        recordBookApplied('t-2-bulk', userId);
        window.dispatchEvent(new CustomEvent('program-updated'));
      }

      setIsConfirmOpen(false);
      setSuccess(copy.success);
    } catch (saveError) {
      console.error('Failed to save T-2 Bulking plan:', saveError);
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

        <Card className="overflow-hidden border border-orange-300/20 bg-[radial-gradient(circle_at_top_left,rgba(255,178,89,0.2),transparent_36%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
          <div className="mb-2 inline-flex rounded-full bg-orange-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200">
            {copy.badge}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-electrolize text-white">T-2 Bulking</h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">{copy.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{translateT2BulkingText(language, '8 Weeks')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{translateT2BulkingText(language, '4 Days')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{translateT2BulkingText(language, 'A/B Rotation')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{translateT2BulkingText(language, 'Aesthetic Bulk')}</span>
            </div>
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'Goal Priorities')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              'Increase chest thickness + upper chest',
              'Increase lat width (V shape)',
              'Add leg mass (quads + hamstrings)',
              'Maintain waist tight',
              'Improve overall density',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
                {translateT2BulkingText(language, item)}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'Structure')}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2BulkingText(language, 'Week A')}</p>
              <p className="mt-2 text-lg font-semibold text-white">{translateT2BulkingText(language, 'Mechanical Strength Bias')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2BulkingText(language, 'Week B')}</p>
              <p className="mt-2 text-lg font-semibold text-white">{translateT2BulkingText(language, 'Hypertrophy Stretch Bias')}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2BulkingText(language, 'Repeat')}</p>
            <p className="mt-2 text-sm text-text-secondary">{translateT2BulkingText(language, 'A -> B -> A -> B for the 8-week cycle.')}</p>
          </div>
        </Card>

        {weeks.map((week) => (
          <section key={week.key} className="space-y-4">
            <Card className="border border-white/12 bg-white/5 p-5">
              <div className="mb-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                {translateT2BulkingText(language, week.title)}
              </div>
              <h3 className="text-xl font-semibold text-white">{translateT2BulkingText(language, week.subtitle)}</h3>
              <p className="mt-2 text-sm text-text-secondary">{translateT2BulkingText(language, week.goal)}</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-text-secondary">
                {translateT2BulkingText(language, week.note)}
              </div>
            </Card>

            {week.days.map((day) => (
              <Card key={`${week.key}-${day.dayLabel}`} className="border border-white/12 bg-white/5 p-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{localizeT2BulkingDayLabel(language, day.dayLabel)}</div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{translateT2BulkingText(language, day.focus)}</h4>
                    <p className="mt-2 text-sm text-text-secondary">{translateT2BulkingText(language, day.summary)}</p>
                  </div>
                  <div className="grid shrink-0 grid-cols-3 gap-2">
                    {day.targetMuscles.slice(0, 3).map((muscle) => (
                      <div key={`${day.dayLabel}-${muscle}`} className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5" title={muscle}>
                        <img src={getBodyPartImage(muscle)} alt={muscle} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {day.exercises.map((exercise) => (
                    <div key={`${day.dayLabel}-${exercise.name}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">{exercise.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-accent">{exercise.prescription}</p>
                        </div>
                      </div>
                      {exercise.comment && (
                        <p className="mt-3 text-xs text-text-secondary">
                          <span className="font-semibold text-text-primary">{translateT2BulkingText(language, 'RepSet comment:')}</span> {translateT2BulkingText(language, exercise.comment)}
                        </p>
                      )}
                      {exercise.technique && (
                        <p className="mt-2 text-xs text-text-secondary">
                          <span className="font-semibold text-text-primary">{translateT2BulkingText(language, 'Technique:')}</span> {translateT2BulkingText(language, exercise.technique)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </section>
        ))}

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'T-2 Smart Progression Rule')}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2BulkingText(language, 'Week A')}</p>
              <p className="mt-2 text-sm text-text-secondary">{translateT2BulkingText(language, 'Increase weight.')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2BulkingText(language, 'Week B')}</p>
              <p className="mt-2 text-sm text-text-secondary">{translateT2BulkingText(language, 'Increase reps.')}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-300/5 p-4 text-sm text-text-primary">
            {translateT2BulkingText(language, 'Example: Week A incline press = 60kg, Week B = 12 reps, next cycle Week A = 62.5kg, Week B = 13 reps.')}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              'Load progression',
              'Rep progression',
              'Density progression',
              'Neural adaptation',
              'Volume cycling',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
                {translateT2BulkingText(language, item)}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'Smart Overload System Structure')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {overloadPhases.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
                {translateT2BulkingText(language, item)}
              </div>
            ))}
          </div>
        </Card>

        {progressionTables.map((table) => (
          <DataTable key={table.title} table={table} language={language} />
        ))}

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'Micro Overload Rule')}</h3>
          <p className="mt-2 text-sm text-text-secondary">{translateT2BulkingText(language, 'Each week also layer in a higher-stimulus technique on isolation work.')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {microOverloadSteps.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
                {translateT2BulkingText(language, item)}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'How to Calculate Your Starting Weight')}</h3>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2BulkingText(language, 'Formula')}</p>
            <p className="mt-2 text-lg font-semibold text-white">{translateT2BulkingText(language, 'Start weight = weight you can lift x 0.65')}</p>
            <p className="mt-3 text-sm text-text-secondary">{translateT2BulkingText(language, 'Example: Incline DB press max = 30kg, so week 1 starts at 20kg.')}</p>
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'Critical T-2 Rules')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {criticalRules.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
                {translateT2BulkingText(language, item)}
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2BulkingText(language, 'Expected Results')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {expectedResults.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">
                {translateT2BulkingText(language, item)}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {isConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/70 px-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:items-center sm:p-4"
          onClick={() => {
            if (!isApplying) setIsConfirmOpen(false);
          }}
        >
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`flex max-h-[min(calc(100dvh-8.5rem),36rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-card p-3.5 shadow-2xl sm:max-h-[min(88dvh,40rem)] sm:max-w-md sm:p-5 ${isArabic ? 'text-right' : 'text-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
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

              <div className="mt-2 rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-sm font-semibold text-white">{premiumCopy.setupTitle}</div>
                <p className="mt-1 text-xs text-text-secondary">{premiumCopy.setupBody}</p>

                <div className="mt-2 space-y-2">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{premiumCopy.surplusMode}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['clean', premiumCopy.clean],
                        ['balanced', premiumCopy.balanced],
                        ['aggressive', premiumCopy.aggressive],
                      ].map(([value, label]) => {
                        const active = premiumConfig.surplusMode === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPremiumConfig((current) => ({ ...current, surplusMode: value as T2BulkingPremiumConfig['surplusMode'] }))}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              active
                                ? 'border-accent/40 bg-accent/15 text-accent'
                                : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent/25'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{premiumCopy.weakPointFocus}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['upper_chest', premiumCopy.upperChest],
                        ['v_taper', premiumCopy.vTaper],
                        ['legs', premiumCopy.legs],
                      ].map(([value, label]) => {
                        const active = premiumConfig.weakPointFocus === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPremiumConfig((current) => ({ ...current, weakPointFocus: value as T2BulkingPremiumConfig['weakPointFocus'] }))}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              active
                                ? 'border-accent/40 bg-accent/15 text-accent'
                                : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent/25'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{premiumCopy.recoveryMode}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ['protect', premiumCopy.protect],
                        ['balanced', premiumCopy.balanced],
                        ['performance', premiumCopy.performance],
                      ].map(([value, label]) => {
                        const active = premiumConfig.recoveryMode === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPremiumConfig((current) => ({ ...current, recoveryMode: value as T2BulkingPremiumConfig['recoveryMode'] }))}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              active
                                ? 'border-accent/40 bg-accent/15 text-accent'
                                : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent/25'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 mt-0 flex shrink-0 gap-3 border-t border-white/10 bg-card/95 pt-2 pb-1 backdrop-blur">
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
