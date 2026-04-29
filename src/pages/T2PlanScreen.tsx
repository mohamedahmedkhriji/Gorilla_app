import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Sparkles } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { getBodyPartImage } from '../services/bodyPartTheme';
import { api } from '../services/api';
import { AppLanguage, LocalizedLanguageRecord, getActiveLanguage, getStoredLanguage } from '../services/language';
import { recordBookApplied } from '../services/bookUsage';
import { getAssignedBookPlan, getPlanSwitchPrompt } from '../services/bookPlanSelection';
import { DEFAULT_T2_PREMIUM_CONFIG, getActiveT2PremiumConfig, T2PremiumConfig } from '../services/premiumPlan';

interface T2PlanScreenProps {
  onBack: () => void;
}

type Exercise = {
  name: string;
  prescription: string;
  tempo?: string;
  rest?: string;
  comment?: string;
};

type DayPlan = {
  dayLabel: string;
  focus: string;
  targetMuscles?: string[];
  summary?: string;
  exercises?: Exercise[];
  notes?: string[];
  isRest?: boolean;
};

type WeekPlan = {
  key: string;
  title: string;
  subtitle: string;
  goal: string;
  tempo: string;
  note: string;
  days: DayPlan[];
};

type Row = {
  signal: string;
  action: string;
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
    title: 'T-2 Cutting Plan',
    badge: 'RepSet Cutting Template',
    summary: 'Elite cutting rotation with posterior thickness, upper chest fullness, 3D back density, Tom Platz-style legs, round delts, clean arms, and recovery.',
    usePlan: 'Use As My Plan',
    usingPlan: 'Saving...',
    activePlan: 'Active In My Plan',
    modalTitle: 'Choose T-2 as your personal plan?',
    modalBody: 'This will save T-2 as your active plan on the My Plan page.',
    modalHint: 'You can still personalize exercises, cardio, and volume later.',
    confirm: 'Yes, Use T-2',
    cancel: 'Cancel',
    noSession: 'No active user session found.',
    saveFailed: 'Failed to save T-2 as your plan.',
    success: 'T-2 is now saved as your active plan in My Plan.',
    payloadName: 'T-2 Cutting Personal Plan',
    payloadDescription: 'T-2 cutting template applied as an active personal plan.',
  },
  ar: {
    title: 'خطة T-2 للتنشيف',
    badge: 'قالب تنشيف من RepSet',
    summary: 'خطة تنشيف 8 أسابيع تعتمد على التناوب بين الكثافة والضخ مع تدرج ذكي وتحكم بالكارديو حسب الإجهاد.',
    usePlan: 'اجعلها خطتي',
    usingPlan: 'جارٍ الحفظ...',
    activePlan: 'مفعلة في خطتي',
    modalTitle: 'هل تريد اختيار T-2 كخطتك الشخصية؟',
    modalBody: 'سيتم حفظ T-2 كخطتك النشطة داخل صفحة خطتي.',
    modalHint: 'يمكنك تخصيص التمارين والكارديو وحجم التدريب لاحقًا.',
    confirm: 'نعم، اختر T-2',
    cancel: 'إلغاء',
    noSession: 'لا توجد جلسة مستخدم نشطة.',
    saveFailed: 'تعذر حفظ T-2 كخطتك.',
    success: 'تم حفظ T-2 كخطتك النشطة داخل صفحة خطتي.',
    payloadName: 'خطة T-2 الشخصية للتنشيف',
    payloadDescription: 'تم تطبيق قالب T-2 للتنشيف كخطة شخصية نشطة.',
    'Week 1-2: Focus on technique': 'الأسبوع 1-2: ركز على التقنية',
    'Week 3-4: Increase load': 'الأسبوع 3-4: زد الحمل',
    'Week 5-6: Add intensity techniques': 'الأسبوع 5-6: أضف تقنيات شدة',
    'Week 7-8: Increase cardio': 'الأسبوع 7-8: زد الكارديو',
    'Target reps achieved easily': 'تم تحقيق التكرارات المستهدفة بسهولة',
    '+2.5% weight': '+2.5% وزن',
    'Target reps achieved hard': 'تم تحقيق التكرارات المستهدفة بصعوبة',
    'Same weight': 'نفس الوزن',
    'Target reps missed slightly': 'تم فقدان التكرارات المستهدفة قليلًا',
    'Repeat load': 'كرر نفس الحمل',
    'Target reps missed badly': 'تم فقدان التكرارات المستهدفة بشكل كبير',
    '-5% weight': '-5% وزن',
    'Strength drops 2 sessions': 'القوة انخفضت جلستين',
    'Deload muscle': 'خفف الحمل على العضلة',
    'Form breakdown': 'انهيار التقنية',
    'Reduce weight now': 'خفف الوزن الآن',
    'Pump 9-10': 'البامب 9-10',
    'Increase reps': 'زد التكرارات',
    'Pump 7-8': 'البامب 7-8',
    'Keep same': 'أبقِ كما هو',
    'Pump 5-6': 'البامب 5-6',
    'Reduce weight': 'خفف الوزن',
    'Pump below 5': 'البامب أقل من 5',
    'Increase volume, not weight': 'زد الحجم لا الوزن',
    'Pump increases weekly': 'البامب يتحسن أسبوعيًا',
    'Continue same load': 'استمر على نفس الحمل',
    'Pump plateaus 2 weeks': 'البامب ثابت لأسبوعين',
    '+1 set': '+1 مجموعة',
    'Pump drops': 'البامب ينخفض',
    'Joint pain': 'ألم مفاصل',
    'Change exercise': 'غيّر التمرين',
    'Strength stable': 'القوة ثابتة',
    Perfect: 'مثالي',
    'Strength slightly drops': 'القوة انخفضت قليلًا',
    Acceptable: 'مقبول',
    'Strength drop >10%': 'انخفاض القوة أكثر من 10%',
    'Increase carbs': 'زد الكربوهيدرات',
    'Pump disappearing': 'البامب يختفي',
    'Reduce cardio': 'قلل الكارديو',
    'Fatigue high / sleep poor': 'الإجهاد مرتفع / النوم ضعيف',
    'Reduce volume or intensity': 'قلل الحجم أو الشدة',
    'Fat loss <0.4 kg': 'نزول الدهون أقل من 0.4 كغ',
    '+10 min cardio': '+10 دقائق كارديو',
    'Fat loss 0.5-0.8 kg': 'نزول الدهون 0.5-0.8 كغ',
    'Fat loss >1.2 kg': 'نزول الدهون أكثر من 1.2 كغ',
    'Strength crash': 'انهيار القوة',
    'Stable 2 weeks': 'ثابت لأسبوعين',
    'Reduce calories': 'قلل السعرات',
    'Dropping fast': 'ينخفض بسرعة',
    Continue: 'استمر',
    'Muscle flat look': 'المظهر العضلي مسطح',
    'Refeed day': 'يوم ريفيد',
    'Waist shrinking': 'الخصر ينكمش',
    'Motivation drop': 'انخفاض الدافعية',
    'Poor pump': 'بامب ضعيف',
    'Bad sleep': 'نوم سيئ',
    'Week 1 -> Technique focus': 'الأسبوع 1 -> تركيز على التقنية',
    'Week 2 -> Load increase': 'الأسبوع 2 -> زيادة الحمل',
    'Week 3 -> Intensity techniques': 'الأسبوع 3 -> تقنيات الشدة',
    'Week 4 -> Metabolic pump': 'الأسبوع 4 -> بامب أيضي',
    'Pump score': 'درجة البامب',
    'Strength trend': 'اتجاه القوة',
    Fatigue: 'الإجهاد',
    Sleep: 'النوم',
    Weight: 'الوزن',
    Mood: 'المزاج',
    Load: 'الحمل',
    Volume: 'الحجم',
    Cardio: 'الكارديو',
  },
  it: {
    title: 'Piano T-2 Cutting',
    badge: 'Template Cutting RepSet',
    summary: 'Rotazione cutting settimanale con priorita a femorali, glutei, petto alto, dorsali, deltoidi laterali e controllo cardio basato sulla fatica.',
    usePlan: 'Usalo Come Mio Piano',
    usingPlan: 'Salvataggio...',
    activePlan: 'Attivo In My Plan',
    modalTitle: 'Vuoi scegliere T-2 come piano personale?',
    modalBody: 'Questo salvera T-2 come piano attivo nella pagina My Plan.',
    modalHint: 'Potrai personalizzare esercizi, cardio e volume in seguito.',
    confirm: 'Si, usa T-2',
    cancel: 'Annulla',
    noSession: 'Nessuna sessione utente attiva trovata.',
    saveFailed: 'Impossibile salvare T-2 come tuo piano.',
    success: 'T-2 ora e salvato come piano attivo in My Plan.',
    payloadName: 'Piano Personale T-2 Cutting',
    payloadDescription: 'Template T-2 cutting applicato come piano personale attivo.',
  },
  de: {
    title: 'T-2 Cutting-Plan',
    badge: 'RepSet-Cutting-Vorlage',
    summary: 'Woechentliche Cutting-Rotation mit Fokus auf Hamstrings, Glutes, obere Brust, Lats, seitliche Schultern und fatiguebasiertem Cardio.',
    usePlan: 'Als Meinen Plan Nutzen',
    usingPlan: 'Speichern...',
    activePlan: 'In My Plan Aktiv',
    modalTitle: 'Moechtest du T-2 als deinen persoenlichen Plan waehlen?',
    modalBody: 'Dadurch wird T-2 als aktiver Plan auf der Seite My Plan gespeichert.',
    modalHint: 'Du kannst Uebungen, Cardio und Volumen spaeter anpassen.',
    confirm: 'Ja, T-2 nutzen',
    cancel: 'Abbrechen',
    noSession: 'Keine aktive Benutzersitzung gefunden.',
    saveFailed: 'T-2 konnte nicht als dein Plan gespeichert werden.',
    success: 'T-2 ist jetzt als aktiver Plan in My Plan gespeichert.',
    payloadName: 'T-2 Cutting Persoenlicher Plan',
    payloadDescription: 'T-2-Cutting-Vorlage als aktiver persoenlicher Plan angewendet.',
  },
};

const PREMIUM_UI_COPY: LocalizedLanguageRecord<{
  setupTitle: string;
  setupBody: string;
  cutIntensity: string;
  cardioStyle: string;
  recoveryMode: string;
  conservative: string;
  balanced: string;
  aggressive: string;
  inclineWalk: string;
  bike: string;
  mixed: string;
  protect: string;
  performance: string;
}> = {
  en: {
    setupTitle: 'Premium setup',
    setupBody: 'Choose how RepSet should steer cardio pressure and recovery inside T-2.',
    cutIntensity: 'Cut intensity',
    cardioStyle: 'Cardio style',
    recoveryMode: 'Recovery bias',
    conservative: 'Conservative',
    balanced: 'Balanced',
    aggressive: 'Aggressive',
    inclineWalk: 'Incline walk',
    bike: 'Bike',
    mixed: 'Mixed',
    protect: 'Protect muscle',
    performance: 'Push performance',
  },
  ar: {
    setupTitle: 'إعداد Premium',
    setupBody: 'اختر كيف يدير RepSet ضغط الكارديو والاستشفاء داخل T-2.',
    cutIntensity: 'شدة التنشيف',
    cardioStyle: 'نوع الكارديو',
    recoveryMode: 'اتجاه الاستشفاء',
    conservative: 'محافظ',
    balanced: 'متوازن',
    aggressive: 'هجومي',
    inclineWalk: 'مشي مائل',
    bike: 'دراجة',
    mixed: 'متنوع',
    protect: 'حماية العضلة',
    performance: 'دفع الأداء',
  },
  it: {
    setupTitle: 'Setup premium',
    setupBody: 'Scegli come RepSet deve gestire pressione cardio e recupero dentro T-2.',
    cutIntensity: 'Intensita cut',
    cardioStyle: 'Stile cardio',
    recoveryMode: 'Bias recupero',
    conservative: 'Conservativo',
    balanced: 'Bilanciato',
    aggressive: 'Aggressivo',
    inclineWalk: 'Camminata inclinata',
    bike: 'Bike',
    mixed: 'Misto',
    protect: 'Proteggi muscolo',
    performance: 'Spingi performance',
  },
  de: {
    setupTitle: 'Premium-Setup',
    setupBody: 'Waehle, wie RepSet Cardio-Druck und Erholung in T-2 steuern soll.',
    cutIntensity: 'Cut-Intensitaet',
    cardioStyle: 'Cardio-Stil',
    recoveryMode: 'Erholungs-Bias',
    conservative: 'Konservativ',
    balanced: 'Ausgewogen',
    aggressive: 'Aggressiv',
    inclineWalk: 'Steigungslaufband',
    bike: 'Fahrrad',
    mixed: 'Gemischt',
    protect: 'Muskel schuetzen',
    performance: 'Leistung pushen',
  },
};

const T2_CONTENT_COPY: LocalizedLanguageRecord<Record<string, string>> = {
  en: {},
  ar: {
    '8 Weeks': '8 أسابيع',
    'A/B Rotation': 'تناوب A/B',
    'Adaptive Cutting': 'تنشيف ذكي',
    Structure: 'الهيكل',
    Repeat: 'التكرار',
    'Week A': 'الأسبوع A',
    'Week B': 'الأسبوع B',
    'Structure & Density': 'الهيكل والكثافة',
    'Pump + Metabolic': 'الضخ والأيض',
    'Density, structure, and quality tension.': 'كثافة، هيكل، وتوتر تدريبي بجودة عالية.',
    'Fat burning and muscle fullness.': 'حرق دهون مع امتلاء عضلي.',
    'Repeat pattern: A -> B -> A -> B -> A -> B -> A -> B': 'نمط التكرار: A ← B ← A ← B ← A ← B ← A ← B',
    'This week chases stimulus and fullness, not PRs.': 'هذا الأسبوع يطارد التحفيز والامتلاء، وليس الأرقام القياسية.',
    Tempo: 'التمبو',
    Focus: 'التركيز',
    'Progression Rule': 'قاعدة التدرج',
    'Main Progression Table': 'جدول التدرج الرئيسي',
    'Isolation Exercise Progression': 'تدرج تمارين العزل',
    'FST-7 Progression Model': 'نموذج تدرج FST-7',
    'Cutting Phase Protection': 'حماية مرحلة التنشيف',
    'Cardio Adaptive Model': 'نموذج الكارديو التكيفي',
    'Bodyweight AI Decision Table': 'جدول قرار الذكاء الاصطناعي للوزن',
    'CNS Fatigue Model': 'نموذج إجهاد الجهاز العصبي',
    'Monthly Intensity Wave': 'موجة الشدة الشهرية',
    'RepSet AI Logic': 'منطق RepSet الذكي',
    'User Inputs': 'مدخلات المستخدم',
    'AI Adjusts': 'ما يعدله الذكاء الاصطناعي',
    Signal: 'الإشارة',
    Action: 'الإجراء',
    'Upper Chest + Side Delts': 'أعلى الصدر + الدلت الجانبي',
    'Back Width + Abs': 'عرض الظهر + البطن',
    'Quads Focus': 'تركيز الرباعية',
    'Shoulders + Arms': 'الأكتاف + الذراعان',
    'Back Thickness + Hamstrings': 'سماكة الظهر + الخلفية',
    'Cardio + Core': 'كارديو + الكور',
    Rest: 'راحة',
    'Chest Pump': 'ضخ الصدر',
    'Back Pump': 'ضخ الظهر',
    'Hamstrings + Glutes': 'الخلفية + الألوية',
    'Shoulder Pump': 'ضخ الأكتاف',
    'Arms Pump': 'ضخ الذراعين',
    'Long Cardio': 'كارديو طويل',
    'Upper chest priority with width-focused delts.': 'أولوية لأعلى الصدر مع دلت جانبي يركز على العرض.',
    'Lat width work plus abs and vacuum control.': 'عمل على عرض اللاتس مع البطن والتحكم في الفاكيوم.',
    'Quad sweep and controlled knee-friendly volume.': 'سويب للرباعية مع حجم منضبط ومريح للركبة.',
    'Full rest day.': 'يوم راحة كامل.',
    'Compounds mostly 3-1-1-1. Isolations slower and more controlled.': 'التمارين المركبة غالبًا 3-1-1-1، والعزل أبطأ وأكثر تحكمًا.',
    'Default tempo: 2-1-1-2.': 'التمبو الافتراضي: 2-1-1-2.',
    'If 3 symptoms appear together, switch to Pump Week automatically.': 'إذا ظهرت 3 أعراض معًا، انتقل تلقائيًا إلى أسبوع الضخ.',
    'Cutting truth: progression means better stimulus with less fatigue, not chasing PRs.': 'حقيقة التنشيف: التقدم يعني تحفيزًا أفضل مع إجهاد أقل، وليس مطاردة الأرقام القياسية.',
    'RepSet comment:': 'ملاحظة RepSet:',
    'Week focus:': 'تركيز الأسبوع:',
    'Rest ': 'راحة ',
    'Tempo ': 'تمبو ',
  },
  it: {
    '8 Weeks': '8 Settimane',
    'A/B Rotation': 'Rotazione A/B',
    'Adaptive Cutting': 'Cutting Adattivo',
    Structure: 'Struttura',
    Repeat: 'Ripeti',
    'Week A': 'Settimana A',
    'Week B': 'Settimana B',
    'Structure & Density': 'Struttura e Densita',
    'Pump + Metabolic': 'Pump e Metabolico',
    'Density, structure, and quality tension.': 'Densita, struttura e tensione di qualita.',
    'Fat burning and muscle fullness.': 'Bruciare grasso e mantenere pienezza muscolare.',
    'Repeat pattern: A -> B -> A -> B -> A -> B -> A -> B': 'Schema di ripetizione: A -> B -> A -> B -> A -> B -> A -> B',
    'This week chases stimulus and fullness, not PRs.': 'Questa settimana cerca stimolo e pienezza, non record personali.',
    Tempo: 'Tempo',
    Focus: 'Focus',
    'Progression Rule': 'Regola di Progressione',
    'Main Progression Table': 'Tabella Principale di Progressione',
    'Isolation Exercise Progression': 'Progressione Esercizi di Isolamento',
    'FST-7 Progression Model': 'Modello di Progressione FST-7',
    'Cutting Phase Protection': 'Protezione della Fase di Cutting',
    'Cardio Adaptive Model': 'Modello Cardio Adattivo',
    'Bodyweight AI Decision Table': 'Tabella Decisionale AI del Peso',
    'CNS Fatigue Model': 'Modello Fatica SNC',
    'Monthly Intensity Wave': 'Onda Mensile di Intensita',
    'RepSet AI Logic': 'Logica AI RepSet',
    'User Inputs': 'Input Utente',
    'AI Adjusts': 'AI Regola',
    Signal: 'Segnale',
    Action: 'Azione',
    Rest: 'Riposo',
    'Full rest day.': 'Giorno completo di riposo.',
    'If 3 symptoms appear together, switch to Pump Week automatically.': 'Se compaiono 3 sintomi insieme, passa automaticamente alla Pump Week.',
    'Cutting truth: progression means better stimulus with less fatigue, not chasing PRs.': 'Nel cutting progredire significa ottenere uno stimolo migliore con meno fatica, non inseguire PR.',
    'RepSet comment:': 'Nota RepSet:',
    'Week focus:': 'Focus settimana:',
    'Rest ': 'Recupero ',
    'Tempo ': 'Tempo ',
    'Week 1-2: Focus on technique': 'Settimane 1-2: focus sulla tecnica',
    'Week 3-4: Increase load': 'Settimane 3-4: aumenta il carico',
    'Week 5-6: Add intensity techniques': 'Settimane 5-6: aggiungi tecniche di intensita',
    'Week 7-8: Increase cardio': 'Settimane 7-8: aumenta il cardio',
    'Target reps achieved easily': 'Reps target raggiunte facilmente',
    '+2.5% weight': '+2.5% carico',
    'Target reps achieved hard': 'Reps target raggiunte con fatica',
    'Same weight': 'Stesso carico',
    'Target reps missed slightly': 'Reps target mancate di poco',
    'Repeat load': 'Ripeti il carico',
    'Target reps missed badly': 'Reps target mancate nettamente',
    '-5% weight': '-5% carico',
    'Strength drops 2 sessions': 'La forza cala per 2 sessioni',
    'Deload muscle': 'Deload sul muscolo',
    'Form breakdown': 'Tecnica che cede',
    'Reduce weight now': 'Riduci subito il carico',
    'Pump 9-10': 'Pump 9-10',
    'Increase reps': 'Aumenta le reps',
    'Pump 7-8': 'Pump 7-8',
    'Keep same': 'Mantieni uguale',
    'Pump 5-6': 'Pump 5-6',
    'Reduce weight': 'Riduci il carico',
    'Pump below 5': 'Pump sotto 5',
    'Increase volume, not weight': 'Aumenta il volume, non il carico',
    'Pump increases weekly': 'Il pump cresce ogni settimana',
    'Continue same load': 'Continua con lo stesso carico',
    'Pump plateaus 2 weeks': 'Il pump e stabile da 2 settimane',
    '+1 set': '+1 set',
    'Pump drops': 'Il pump cala',
    'Joint pain': 'Dolore articolare',
    'Change exercise': 'Cambia esercizio',
    'Strength stable': 'Forza stabile',
    Perfect: 'Perfetto',
    'Strength slightly drops': 'La forza cala leggermente',
    Acceptable: 'Accettabile',
    'Strength drop >10%': 'Calo della forza >10%',
    'Increase carbs': 'Aumenta i carboidrati',
    'Pump disappearing': 'Il pump sparisce',
    'Reduce cardio': 'Riduci il cardio',
    'Fatigue high / sleep poor': 'Fatica alta / sonno scarso',
    'Reduce volume or intensity': 'Riduci volume o intensita',
    'Fat loss <0.4 kg': 'Perdita di grasso <0.4 kg',
    '+10 min cardio': '+10 min cardio',
    'Fat loss 0.5-0.8 kg': 'Perdita di grasso 0.5-0.8 kg',
    'Fat loss >1.2 kg': 'Perdita di grasso >1.2 kg',
    'Strength crash': 'Crollo della forza',
    'Stable 2 weeks': 'Stabile per 2 settimane',
    'Reduce calories': 'Riduci le calorie',
    'Dropping fast': 'Scende velocemente',
    Continue: 'Continua',
    'Muscle flat look': 'Muscolo dall aspetto piatto',
    'Refeed day': 'Giorno di refeed',
    'Waist shrinking': 'La vita si stringe',
    'Motivation drop': 'Calo di motivazione',
    'Poor pump': 'Pump scarso',
    'Bad sleep': 'Sonno scarso',
    'Week 1 -> Technique focus': 'Settimana 1 -> focus sulla tecnica',
    'Week 2 -> Load increase': 'Settimana 2 -> aumento del carico',
    'Week 3 -> Intensity techniques': 'Settimana 3 -> tecniche di intensita',
    'Week 4 -> Metabolic pump': 'Settimana 4 -> pump metabolico',
    'Pump score': 'Punteggio pump',
    'Strength trend': 'Trend della forza',
    Fatigue: 'Fatica',
    Sleep: 'Sonno',
    Weight: 'Peso',
    Mood: 'Umore',
    Load: 'Carico',
    Volume: 'Volume',
    Cardio: 'Cardio',
  },
  de: {
    '8 Weeks': '8 Wochen',
    'A/B Rotation': 'A/B-Rotation',
    'Adaptive Cutting': 'Adaptives Cutting',
    Structure: 'Struktur',
    Repeat: 'Wiederholung',
    'Week A': 'Woche A',
    'Week B': 'Woche B',
    'Structure & Density': 'Struktur und Dichte',
    'Pump + Metabolic': 'Pump und Metabolisch',
    'Density, structure, and quality tension.': 'Dichte, Struktur und qualitativ hochwertige Spannung.',
    'Fat burning and muscle fullness.': 'Fettverbrennung und muskulare Fuelle.',
    'Repeat pattern: A -> B -> A -> B -> A -> B -> A -> B': 'Wiederholungsmuster: A -> B -> A -> B -> A -> B -> A -> B',
    'This week chases stimulus and fullness, not PRs.': 'Diese Woche jagt Reiz und Fuelle, nicht PRs.',
    Tempo: 'Tempo',
    Focus: 'Fokus',
    'Progression Rule': 'Progressionsregel',
    'Main Progression Table': 'Haupttabelle der Progression',
    'Isolation Exercise Progression': 'Progression fuer Isolationsuebungen',
    'FST-7 Progression Model': 'FST-7-Progressionsmodell',
    'Cutting Phase Protection': 'Schutz in der Cutting-Phase',
    'Cardio Adaptive Model': 'Adaptives Cardio-Modell',
    'Bodyweight AI Decision Table': 'KI-Entscheidungstabelle fuer Koerpergewicht',
    'CNS Fatigue Model': 'ZNS-Ermuedungsmodell',
    'Monthly Intensity Wave': 'Monatliche Intensitaetswelle',
    'RepSet AI Logic': 'RepSet-KI-Logik',
    'User Inputs': 'Nutzereingaben',
    'AI Adjusts': 'KI passt an',
    Signal: 'Signal',
    Action: 'Aktion',
    Rest: 'Ruhe',
    'Full rest day.': 'Vollstaendiger Ruhetag.',
    'If 3 symptoms appear together, switch to Pump Week automatically.': 'Wenn 3 Symptome gleichzeitig auftreten, wechsle automatisch zur Pump-Woche.',
    'Cutting truth: progression means better stimulus with less fatigue, not chasing PRs.': 'Die Wahrheit im Cutting: Fortschritt bedeutet besseren Reiz mit weniger Ermuedung, nicht das Jagen von PRs.',
    'RepSet comment:': 'RepSet-Hinweis:',
    'Week focus:': 'Wochenfokus:',
    'Rest ': 'Pause ',
    'Tempo ': 'Tempo ',
    'Week 1-2: Focus on technique': 'Woche 1-2: Technikfokus',
    'Week 3-4: Increase load': 'Woche 3-4: Last steigern',
    'Week 5-6: Add intensity techniques': 'Woche 5-6: Intensitaetstechniken hinzufuegen',
    'Week 7-8: Increase cardio': 'Woche 7-8: Cardio steigern',
    'Target reps achieved easily': 'Zielwiederholungen leicht erreicht',
    '+2.5% weight': '+2.5% Gewicht',
    'Target reps achieved hard': 'Zielwiederholungen hart erreicht',
    'Same weight': 'Gleiches Gewicht',
    'Target reps missed slightly': 'Zielwiederholungen knapp verfehlt',
    'Repeat load': 'Last wiederholen',
    'Target reps missed badly': 'Zielwiederholungen deutlich verfehlt',
    '-5% weight': '-5% Gewicht',
    'Strength drops 2 sessions': 'Kraft faellt 2 Einheiten lang',
    'Deload muscle': 'Muskel deloaden',
    'Form breakdown': 'Technik bricht ein',
    'Reduce weight now': 'Gewicht jetzt reduzieren',
    'Pump 9-10': 'Pump 9-10',
    'Increase reps': 'Wiederholungen steigern',
    'Pump 7-8': 'Pump 7-8',
    'Keep same': 'Gleich lassen',
    'Pump 5-6': 'Pump 5-6',
    'Reduce weight': 'Gewicht reduzieren',
    'Pump below 5': 'Pump unter 5',
    'Increase volume, not weight': 'Volumen steigern, nicht Gewicht',
    'Pump increases weekly': 'Der Pump steigt woechentlich',
    'Continue same load': 'Mit gleicher Last weitermachen',
    'Pump plateaus 2 weeks': 'Der Pump stagniert 2 Wochen',
    '+1 set': '+1 Satz',
    'Pump drops': 'Der Pump faellt',
    'Joint pain': 'Gelenkschmerzen',
    'Change exercise': 'Uebung wechseln',
    'Strength stable': 'Kraft stabil',
    Perfect: 'Perfekt',
    'Strength slightly drops': 'Kraft faellt leicht',
    Acceptable: 'Akzeptabel',
    'Strength drop >10%': 'Kraftabfall >10%',
    'Increase carbs': 'Kohlenhydrate erhoehen',
    'Pump disappearing': 'Der Pump verschwindet',
    'Reduce cardio': 'Cardio reduzieren',
    'Fatigue high / sleep poor': 'Hohe Ermuedung / schlechter Schlaf',
    'Reduce volume or intensity': 'Volumen oder Intensitaet reduzieren',
    'Fat loss <0.4 kg': 'Fettverlust <0.4 kg',
    '+10 min cardio': '+10 Min Cardio',
    'Fat loss 0.5-0.8 kg': 'Fettverlust 0.5-0.8 kg',
    'Fat loss >1.2 kg': 'Fettverlust >1.2 kg',
    'Strength crash': 'Krafteinbruch',
    'Stable 2 weeks': '2 Wochen stabil',
    'Reduce calories': 'Kalorien reduzieren',
    'Dropping fast': 'Faellt schnell',
    Continue: 'Weiter',
    'Muscle flat look': 'Muskeln wirken flach',
    'Refeed day': 'Refeed-Tag',
    'Waist shrinking': 'Taille wird schmaler',
    'Motivation drop': 'Motivation sinkt',
    'Poor pump': 'Schlechter Pump',
    'Bad sleep': 'Schlechter Schlaf',
    'Week 1 -> Technique focus': 'Woche 1 -> Technikfokus',
    'Week 2 -> Load increase': 'Woche 2 -> Last steigern',
    'Week 3 -> Intensity techniques': 'Woche 3 -> Intensitaetstechniken',
    'Week 4 -> Metabolic pump': 'Woche 4 -> metabolischer Pump',
    'Pump score': 'Pump-Wert',
    'Strength trend': 'Krafttrend',
    Fatigue: 'Ermuedung',
    Sleep: 'Schlaf',
    Weight: 'Gewicht',
    Mood: 'Stimmung',
    Load: 'Last',
    Volume: 'Volumen',
    Cardio: 'Cardio',
  },
};

const translateT2Text = (language: AppLanguage, value: string) =>
  T2_CONTENT_COPY[language]?.[value] || value;

const localizeT2DayLabel = (language: AppLanguage, dayLabel: string) => {
  const dayNumber = String(dayLabel || '').match(/\d+/)?.[0];
  if (!dayNumber) return translateT2Text(language, dayLabel);
  if (language === 'ar') return `اليوم ${dayNumber}`;
  if (language === 'it') return `Giorno ${dayNumber}`;
  if (language === 'de') return `Tag ${dayNumber}`;
  return dayLabel;
};

const DAY_NAME: Record<string, string> = {
  'Day 1': 'monday',
  'Day 2': 'tuesday',
  'Day 3': 'wednesday',
  'Day 4': 'thursday',
  'Day 5': 'friday',
  'Day 6': 'saturday',
  'Day 7': 'sunday',
};

const HEAVY = /(squat|deadlift|rack pull|barbell row|barbell press|romanian deadlift|db press|machine press|t-bar row|hip thrust|chest supported row|incline machine press|leg press|hack squat|shoulder press)/i;

const progressionPhases = [
  'Day 1 Hamstrings + Glutes -> Day 2 Upper Chest + Triceps -> Day 3 Back -> Day 4 Rest -> Day 5 Quads + Calves -> Day 6 Shoulders + Arms + Back Thickness -> Day 7 Rest',
  'Priority 1: Hamstrings / upper chest / back width and thickness',
  'Priority 2: Quads / shoulders / arms',
  'Execution: add reps first, then weight',
];

const mainRows: Row[] = [
  { signal: 'Progression', action: 'Add reps, then weight' },
  { signal: 'Cutting rule', action: "Don't chase ego PRs" },
  { signal: 'Last set', action: 'Near failure' },
  { signal: 'FST-7', action: 'Pump 9-10/10' },
];

const isoRows: Row[] = [
  { signal: 'Rows', action: 'Slow and controlled' },
  { signal: 'RDL', action: 'Stretch' },
  { signal: 'Squats', action: 'Deep' },
  { signal: 'Volume work', action: 'Control before load' },
];

const fstRows: Row[] = [
  { signal: 'Pump increases', action: 'Keep load' },
  { signal: 'Pump drops', action: 'Reduce weight' },
  { signal: 'Pump plateaus', action: 'Add volume carefully' },
  { signal: 'Joint pain', action: 'Change exercise' },
];

const fatigueRows: Row[] = [
  { signal: 'Hamstrings sore >48h', action: 'Reduce Day 6 row load' },
  { signal: 'Chest fatigue high', action: 'Remove machine press Day 2' },
  { signal: 'Shoulder fatigue', action: 'Reduce lateral volume, not intensity' },
  { signal: 'Strength crash', action: 'Reduce cardio' },
];

const cardioRows: Row[] = [
  { signal: 'Fat loss <0.4 kg', action: '+10 min cardio' },
  { signal: 'Fat loss 0.5-0.8 kg', action: 'Perfect' },
  { signal: 'Fat loss >1.2 kg', action: 'Reduce cardio' },
  { signal: 'Strength crash', action: 'Reduce cardio' },
];

const pumpRows: Row[] = [
  { signal: 'Hamstrings', action: 'Stretch, hinge, and density' },
  { signal: 'Upper chest', action: 'Thickness and fullness' },
  { signal: 'Back', action: 'Width, thickness, and control' },
  { signal: 'Legs and delts', action: 'Leg domination plus round delts' },
];

const cnsSymptoms = ['Motivation drop', 'Strength crash', 'Poor pump', 'Bad sleep'];
const prioritySystem = ['Priority 1: Hamstrings / upper chest / back', 'Priority 2: Tom Platz-style quads and calves', 'Priority 3: Round delts and clean arms', 'Rest days protect recovery and waist control'];
const aiInputs = ['Pump score', 'Strength trend', 'Fatigue', 'Sleep', 'Weight', 'Mood'];
const aiOutputs = ['Load', 'Volume', 'Cardio', 'Rest'];

const weeks: WeekPlan[] = [
  {
    key: 'weekly',
    title: 'Weekly Structure',
    subtitle: 'Elite T-2 Cutting Rotation',
    goal: 'A fixed 7-day split built around posterior thickness, upper chest fullness, 3D back density, Tom Platz-style legs, and shoulder-arm detail.',
    tempo: 'Add reps before weight. Last sets go near failure, FST-7 targets a 9-10/10 pump, and thickness work stays slow and controlled.',
    note: 'Repeat weekly for 8-10 weeks.',
    days: [
      {
        dayLabel: 'Day 1',
        focus: 'Hamstrings + Glutes',
        summary: 'Focus: stretch, hinge, and density.',
        targetMuscles: ['Hamstrings', 'Glutes', 'Calves'],
        notes: ['Tags: priority / posterior_thickness / lower_back_tie_in'],
        exercises: [
          { name: 'Romanian Deadlift (RDL)', prescription: '4 x 6-8', tempo: '3-1-1', comment: 'Main thickness builder for hamstrings and lower back.' },
          { name: 'Stiff-Leg Deadlift', prescription: '3 x 8-10', comment: 'Deeper stretch than RDL.' },
          { name: 'Lying Leg Curl', prescription: '3 x 10-12', comment: 'Last set drop set.' },
          { name: 'Seated Leg Curl', prescription: '3 x 12-15', comment: 'Squeeze and control.' },
          { name: 'Hip Thrust', prescription: '3 x 8-10', comment: 'Glute power and posterior chain.' },
          { name: 'Nordic Curl / GHR', prescription: '3 x 6-8', comment: 'Slow eccentric. Elite hamstring builder.' },
          { name: 'Cable Pull-Through', prescription: '2-3 x 12-15' },
          { name: 'FST-7 Seated Curl', prescription: '7 x 10-12', rest: '30 sec', comment: 'Finisher.' },
        ],
      },
      {
        dayLabel: 'Day 2',
        focus: 'Upper Chest + Triceps',
        summary: 'Focus: upper chest thickness and fullness.',
        targetMuscles: ['Upper Chest', 'Chest', 'Triceps'],
        notes: ['Tags: weak_point_fix / upper_chest / triceps'],
        exercises: [
          { name: 'Incline Barbell Press', prescription: '4 x 6-8', tempo: '3-1-1', comment: 'Replace Smith if possible. Pause at bottom.' },
          { name: 'Incline Dumbbell Press', prescription: '3 x 8-10', comment: 'Last set drop.' },
          { name: 'Seated Cable Press', prescription: '3 x 10-12' },
          { name: 'Low-to-High Cable Fly', prescription: '3 x 12-15' },
          { name: 'Pec Deck Fly', prescription: '3 x 12-15' },
          { name: 'FST-7 Chest Fly', prescription: '7 x 10-12', rest: '30-40 sec', comment: 'Cable or machine.' },
          { name: 'Skullcrusher (EZ bar)', prescription: '3 x 10-12' },
          { name: 'Rope Pushdown', prescription: '3 x 12-15' },
        ],
      },
      {
        dayLabel: 'Day 3',
        focus: 'Back Width + Thickness Hybrid',
        summary: 'Focus: V-taper and 3D density.',
        targetMuscles: ['Back', 'Lats', 'Upper Back'],
        notes: ['Tags: width / thickness / control'],
        exercises: [
          { name: 'Neutral Mag-Grip Lat Pulldown', prescription: '4 sets', comment: '2 warm-up + 2 working sets. Last working set = big drop set.' },
          { name: 'Chest-Supported T-Bar Row', prescription: '4 x 8-10', comment: 'Heavy thickness work.' },
          { name: 'Chest-Supported DB Row (Neutral Grip)', prescription: '3 x 10-12' },
          { name: 'Plate-Loaded High Row', prescription: '3 x 10-12', comment: 'Superset with Pullover Machine.' },
          { name: 'Pullover Machine', prescription: '3 x 12', comment: 'Superset with Plate-Loaded High Row.' },
          { name: 'Close-Grip Cable Row', prescription: '3 x 10-12', comment: 'Superset with Cable Lat Pullover.' },
          { name: 'Cable Lat Pullover', prescription: '3 x 12-15', comment: 'Superset with Close-Grip Cable Row.' },
        ],
      },
      {
        dayLabel: 'Day 4',
        focus: 'Rest',
        summary: 'No lifting. You handle cardio yourself.',
        notes: ['Tags: recovery / no_lifting'],
        isRest: true,
        exercises: [],
      },
      {
        dayLabel: 'Day 5',
        focus: 'Quads + Calves',
        summary: 'Focus: leg domination.',
        targetMuscles: ['Quadriceps', 'Calves', 'Glutes'],
        notes: ['Tags: tom_platz_style / heavy / pain'],
        exercises: [
          { name: 'Barbell Squat (Deep)', prescription: '5 x 6-8', comment: 'Go heavy, controlled.' },
          { name: 'Hack Squat', prescription: '4 x 8-10', comment: 'Deep and slow.' },
          { name: 'Leg Press (Feet Low)', prescription: '4 x 12-15', comment: 'Burn and volume.' },
          { name: 'Bulgarian Split Squat', prescription: '3 x 10 each leg', comment: 'Brutal but necessary.' },
          { name: 'Leg Extension', prescription: '3 x 12-15', comment: 'Last set drop.' },
          { name: 'FST-7 Leg Extension', prescription: '7 x 12-15', rest: '30-40 sec' },
          { name: 'Standing Calf Raise', prescription: '4 x 12-15' },
          { name: 'Seated Calf Raise', prescription: '4 x 12-15' },
        ],
      },
      {
        dayLabel: 'Day 6',
        focus: 'Shoulders + Arms',
        summary: 'Focus: round delts and clean arms.',
        targetMuscles: ['Shoulders', 'Biceps', 'Forearms'],
        notes: ['Tags: width / detail / arms'],
        exercises: [
          { name: 'Seated Machine Shoulder Press', prescription: '3 x 8-10' },
          { name: 'Seated Dumbbell Shoulder Press', prescription: '3 x 8-10' },
          { name: 'Dumbbell Lateral Raise', prescription: '4 x 12-15' },
          { name: 'Single-Arm Cable Lateral Raise', prescription: '3 x 15' },
          { name: 'Bent-Over Rear Delt Fly', prescription: '4 x 15-20' },
          { name: 'FST-7 Cable Lateral Raise', prescription: '7 x 12', rest: '30-40 sec' },
          { name: 'Machine Curl', prescription: '3 x 10-12' },
          { name: 'Preacher Curl (Single Arm)', prescription: '3 x 10-12' },
          { name: 'EZ-Bar Spider Curl', prescription: '3 x 10' },
          { name: 'Hammer Curl', prescription: '3 x 12' },
          { name: 'EZ-Bar Reverse Curl', prescription: '3 x 12-15' },
        ],
      },
      {
        dayLabel: 'Day 7',
        focus: 'Rest',
        summary: 'No lifting. Recovery focus.',
        notes: ['Tags: recovery / no_lifting'],
        isRest: true,
        exercises: [],
      },
    ],
  },
];

const getStoredUserId = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const localUser = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || localUser?.id || 0);
  } catch {
    return Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
  }
};

const parsePrescription = (exercise: Exercise) => {
  const text = String(exercise.prescription || '').trim().toLowerCase();
  const setsMatch = text.match(/^(\d+)\s*x\s*(.+)$/i);
  if (setsMatch) return { sets: Number(setsMatch[1] || 1), reps: setsMatch[2].trim() };
  const roundsMatch = text.match(/^(\d+)\s*rounds?$/i);
  if (roundsMatch) return { sets: Number(roundsMatch[1] || 1), reps: 'Rounds' };
  const supersetsMatch = text.match(/^(\d+)\s*supersets?$/i);
  if (supersetsMatch) return { sets: Number(supersetsMatch[1] || 1), reps: 'Superset' };
  const setsOnlyMatch = text.match(/^(\d+)\s*sets?$/i);
  if (setsOnlyMatch) return { sets: Number(setsOnlyMatch[1] || 1), reps: 'Working sets' };
  const rangeSetsMatch = text.match(/^(\d+)-(\d+)\s*sets?$/i);
  if (rangeSetsMatch) return { sets: Number(rangeSetsMatch[2] || rangeSetsMatch[1] || 1), reps: 'Working sets' };
  if (text === 'optional') return { sets: 1, reps: 'Optional' };
  if (text.includes('min')) return { sets: 1, reps: exercise.prescription };
  return { sets: 3, reps: '8-12' };
};

const inferRestSeconds = (exercise: Exercise) => {
  const restMatch = String(exercise.rest || '').toLowerCase().match(/(\d+)\s*sec/);
  if (restMatch) return Number(restMatch[1] || 35);
  if (/fst-7/i.test(exercise.name) || /^7\s*x/i.test(exercise.prescription)) return 35;
  if (/min/i.test(exercise.prescription) || /vacuum|cardio|circuit/i.test(exercise.name)) return 30;
  if (HEAVY.test(exercise.name)) return 120;
  return 75;
};

const buildPayload = (language: AppLanguage, premiumConfig: T2PremiumConfig) => {
  const copy = COPY[language] || COPY.en;
  const weekPlans = weeks.map((week) => ({
    weeklyWorkouts: week.days.filter((day) => !day.isRest).map((day) => ({
      dayName: DAY_NAME[day.dayLabel] || 'monday',
      workoutName: `${translateT2Text(language, week.title)} - ${translateT2Text(language, day.focus)}`,
      workoutType: 'Custom',
      targetMuscles: day.targetMuscles || [],
      notes: [
        translateT2Text(language, week.subtitle),
        day.summary ? translateT2Text(language, day.summary) : '',
        ...(day.notes || []).map((note) => translateT2Text(language, note)),
      ].filter(Boolean).join(' '),
      exercises: (day.exercises || []).map((exercise) => {
        const parsed = parsePrescription(exercise);
        return {
          exerciseName: exercise.name,
          sets: parsed.sets,
          reps: parsed.reps,
          restSeconds: inferRestSeconds(exercise),
          targetWeight: 20,
          targetMuscles: day.targetMuscles || [],
          notes: [
            exercise.comment ? `${translateT2Text(language, 'RepSet comment:')} ${translateT2Text(language, exercise.comment)}` : '',
            exercise.tempo ? `${translateT2Text(language, 'Tempo ')}${exercise.tempo}` : '',
            exercise.rest ? `${translateT2Text(language, 'Rest ')}${exercise.rest}` : '',
            `${translateT2Text(language, 'Week focus:')} ${translateT2Text(language, week.subtitle)}`,
          ].filter(Boolean).join(' '),
        };
      }),
    })),
  }));

  return {
    planName: copy.payloadName,
    description: copy.payloadDescription,
    premiumPlanConfig: premiumConfig,
    cycleWeeks: 8,
    templateWeekCount: 1,
    selectedDays: weeks[0]?.days.filter((day) => !day.isRest).map((day) => DAY_NAME[day.dayLabel] || 'monday') || [],
    weeklyWorkouts: weekPlans[0]?.weeklyWorkouts || [],
    weekPlans,
  };
};

function DecisionTable({ title, rows, language }: { title: string; rows: Row[]; language: AppLanguage }) {
  return (
    <Card className="border border-white/12 bg-white/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2Text(language, title)}</h3>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
        <div className="grid grid-cols-[1.1fr,1fr] border-b border-white/10 bg-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
          <span>{translateT2Text(language, 'Signal')}</span>
          <span>{translateT2Text(language, 'Action')}</span>
        </div>
        {rows.map((row) => (
          <div key={`${title}-${row.signal}`} className="grid grid-cols-[1.1fr,1fr] gap-4 border-b border-white/10 px-4 py-3 text-sm last:border-b-0">
            <span className="text-text-primary">{translateT2Text(language, row.signal)}</span>
            <span className="text-text-secondary">{translateT2Text(language, row.action)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function T2PlanScreen({ onBack }: T2PlanScreenProps) {
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignedPlan, setAssignedPlan] = useState(() => getAssignedBookPlan());
  const [premiumConfig] = useState<T2PremiumConfig>(
    () => getActiveT2PremiumConfig() || DEFAULT_T2_PREMIUM_CONFIG,
  );
  const copy = useMemo(() => COPY[language] || COPY.en, [language]);
  const isArabic = language === 'ar';
  const isCurrentPlanActive = assignedPlan.id === 't-2';
  const modalCopy = useMemo(() => {
    if (assignedPlan.id && assignedPlan.id !== 't-2') {
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
    const userId = getStoredUserId();
    if (!userId) {
      setError(copy.noSession);
      return;
    }

    const payload = buildPayload(language, premiumConfig);
    setIsApplying(true);
    try {
      const result = await api.saveCustomProgram(userId, payload);
      if (!result?.success) throw new Error(result?.error || copy.saveFailed);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('recoveryNeedsUpdate');
        localStorage.setItem('assignedProgramTemplate', JSON.stringify({
          ...(result?.assignedProgram || {}),
          ...payload,
          templateWeekPlans: payload.weekPlans,
          repeatedWeekPlans: payload.weekPlans,
        }));
        setAssignedPlan({ id: 't-2', name: payload.planName });
        recordBookApplied('t-2', userId);
        window.dispatchEvent(new CustomEvent('program-updated'));
      }
      setIsConfirmOpen(false);
      setSuccess(copy.success);
    } catch (saveError) {
      console.error('Failed to save T-2 plan:', saveError);
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

        <Card className="overflow-hidden border border-accent/20 bg-[radial-gradient(circle_at_top_left,rgba(201,255,89,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
          <div className="mb-2 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            {copy.badge}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-electrolize text-white">T-2</h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">{copy.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{translateT2Text(language, 'Weekly Repeat')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{translateT2Text(language, '5 Lift Days')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{translateT2Text(language, '8-10 Weeks')}</span>
            </div>
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2Text(language, 'Structure')}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2Text(language, 'Priority Days')}</p>
              <p className="mt-2 text-lg font-semibold text-white">{translateT2Text(language, 'Hamstrings / Upper Chest / Back')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2Text(language, 'Support Days')}</p>
              <p className="mt-2 text-lg font-semibold text-white">{translateT2Text(language, 'Tom Platz Legs / Delts / Arms')}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2Text(language, 'Repeat')}</p>
            <p className="mt-2 text-sm text-text-secondary">{translateT2Text(language, 'Repeat weekly: Day 1 Hamstrings + Glutes -> Day 2 Upper Chest + Triceps -> Day 3 Back -> Day 4 Rest -> Day 5 Quads + Calves -> Day 6 Shoulders + Arms -> Day 7 Rest')}</p>
          </div>
        </Card>

        {weeks.map((week) => (
          <section key={week.key} className="space-y-4">
            <Card className="border border-white/12 bg-white/5 p-5">
              <div className="mb-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                {translateT2Text(language, week.title)}
              </div>
              <h3 className="text-xl font-semibold text-white">{translateT2Text(language, week.subtitle)}</h3>
              <p className="mt-2 text-sm text-text-secondary">{translateT2Text(language, week.goal)}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2Text(language, 'Tempo')}</p>
                  <p className="mt-2 text-sm text-text-secondary">{translateT2Text(language, week.tempo)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2Text(language, 'Focus')}</p>
                  <p className="mt-2 text-sm text-text-secondary">{translateT2Text(language, week.note)}</p>
                </div>
              </div>
            </Card>

            {week.days.map((day) => (
              <Card key={`${week.key}-${day.dayLabel}`} className="border border-white/12 bg-white/5 p-5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{localizeT2DayLabel(language, day.dayLabel)}</div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{translateT2Text(language, day.focus)}</h4>
                    {day.summary && <p className="mt-2 text-sm text-text-secondary">{translateT2Text(language, day.summary)}</p>}
                  </div>
                  {day.targetMuscles && day.targetMuscles.length > 0 && (
                    <div className="grid shrink-0 grid-cols-3 gap-2">
                      {day.targetMuscles.slice(0, 3).map((muscle) => (
                        <div key={`${day.dayLabel}-${muscle}`} className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5" title={muscle}>
                          <img src={getBodyPartImage(muscle)} alt={muscle} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {day.notes && day.notes.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {day.notes.map((note) => (
                      <p key={`${day.dayLabel}-${note}`} className="text-xs text-text-secondary">{note}</p>
                    ))}
                  </div>
                )}

                {day.exercises && day.exercises.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {day.exercises.map((exercise) => (
                      <div key={`${day.dayLabel}-${exercise.name}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{exercise.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-accent">{exercise.prescription}</p>
                          </div>
                          {(exercise.tempo || exercise.rest) && (
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              {exercise.tempo && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                                  {translateT2Text(language, 'Tempo ')}{exercise.tempo}
                                </span>
                              )}
                              {exercise.rest && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                                  {translateT2Text(language, 'Rest ')}{exercise.rest}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {exercise.comment && (
                          <p className="mt-3 text-xs text-text-secondary">
                            <span className="font-semibold text-text-primary">{translateT2Text(language, 'RepSet comment:')}</span> {translateT2Text(language, exercise.comment)}
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

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2Text(language, 'Progression Rule')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {progressionPhases.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">{translateT2Text(language, item)}</div>
            ))}
          </div>
        </Card>

        <DecisionTable title="Execution Rules" rows={mainRows} language={language} />
        <DecisionTable title="Mind-Muscle Focus" rows={isoRows} language={language} />
        <DecisionTable title="FST-7 Progression Model" rows={fstRows} language={language} />
        <DecisionTable title="Fatigue Rules" rows={fatigueRows} language={language} />
        <DecisionTable title="Cardio Adaptive Model" rows={cardioRows} language={language} />
        <DecisionTable title="What This Program Builds" rows={pumpRows} language={language} />

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2Text(language, 'CNS Fatigue Model')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {cnsSymptoms.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">{translateT2Text(language, item)}</div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-4 text-sm text-text-primary">
            {translateT2Text(language, 'If 3 symptoms appear together, reduce volume or cardio before chasing load.')}
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2Text(language, 'Priority System')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {prioritySystem.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-text-secondary">{translateT2Text(language, item)}</div>
            ))}
          </div>
        </Card>

        <Card className="border border-white/12 bg-white/5 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-secondary">{translateT2Text(language, 'RepSet AI Logic')}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2Text(language, 'User Inputs')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aiInputs.map((item) => (
                  <span key={item} className="rounded-full bg-white/8 px-3 py-1 text-xs text-text-secondary">{translateT2Text(language, item)}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{translateT2Text(language, 'AI Adjusts')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aiOutputs.map((item) => (
                  <span key={item} className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">{translateT2Text(language, item)}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-text-secondary">
            {translateT2Text(language, 'Cutting truth: progression means better stimulus with less fatigue, not chasing PRs.')}
          </div>
        </Card>
      </div>

      {isConfirmOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/70 px-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:items-center sm:p-4"
          onClick={() => {
            if (!isApplying) setIsConfirmOpen(false);
          }}
        >
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`flex max-h-[min(calc(100dvh-8.5rem),38rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-card p-3.5 shadow-2xl sm:max-h-[min(90dvh,48rem)] sm:max-w-md sm:p-5 ${isArabic ? 'text-right' : 'text-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-2 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
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
      , document.body)}
    </div>
  );
}
