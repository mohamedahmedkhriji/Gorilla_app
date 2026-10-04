import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Sparkles, ArrowUpRight, Target } from 'lucide-react';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';

interface BiWeeklyReportProps {
  onBack: () => void;
}

interface ReportItem {
  title: string;
  detail: string;
}

interface BiWeeklyReportData {
  periodDays: number;
  summary: string;
  aiStatus?: 'generated' | 'fallback' | null;
  aiNotice?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  metrics: {
    consistency: number;
    completedSessions: number;
    plannedSessions: number;
    totalVolume14d: number;
    avgRecovery: number;
  };
  improvements: ReportItem[];
  nextFocus: ReportItem[];
}

const BIWEEKLY_REPORT_I18N = {
  en: {
    title: 'Bi-Weekly Report',
    summaryTitle: 'AI Coach Summary',
    summaryLoading: 'Analyzing your recent training data...',
    summaryEmpty: 'No report data yet. Start logging workouts to generate a personalized report.',
    improvementsTitle: 'Improvements',
    improvementsEmptyTitle: 'No major improvements yet',
    improvementsEmptyDetail: 'Log more workouts this period to unlock detailed trends.',
    nextFocusTitle: 'Next Focus',
    nextFocusEmptyTitle: 'Keep training consistently',
    nextFocusEmptyDetail: 'Complete your scheduled sessions this week.',
  },
  ar: {
    title: 'تقرير نصف أسبوعي',
    summaryTitle: 'ملخص المدرب الذكي',
    summaryLoading: 'جارٍ تحليل بيانات تدريبك الأخيرة...',
    summaryEmpty: 'لا توجد بيانات للتقرير بعد. ابدأ بتسجيل التدريبات لإنشاء تقرير مخصص.',
    improvementsTitle: 'التحسينات',
    improvementsEmptyTitle: 'لا توجد تحسينات كبيرة بعد',
    improvementsEmptyDetail: 'سجّل المزيد من التدريبات خلال هذه الفترة لعرض اتجاهات مفصلة.',
    nextFocusTitle: 'التركيز القادم',
    nextFocusEmptyTitle: 'استمر على الانتظام في التدريب',
    nextFocusEmptyDetail: 'أكمل جلساتك المجدولة هذا الأسبوع.',
  },
  fr: {
    title: 'Rapport Bi-Hebdomadaire',
    summaryTitle: 'Resume du Coach IA',
    summaryLoading: 'Analyse de tes dernieres donnees d entrainement...',
    summaryEmpty: 'Aucune donnee de rapport pour le moment. Commence a enregistrer tes entrainements pour generer un rapport personnalise.',
    improvementsTitle: 'Ameliorations',
    improvementsEmptyTitle: 'Pas encore d amelioration majeure',
    improvementsEmptyDetail: 'Enregistre plus d entrainements sur cette periode pour debloquer des tendances detaillees.',
    nextFocusTitle: 'Prochain Axe',
    nextFocusEmptyTitle: 'Continue a t entrainer regulierement',
    nextFocusEmptyDetail: 'Complete tes seances prevues cette semaine.',
  },
} as const;

const readReportStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const isGirlsStyleValue = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'woman' || normalized === 'female' || normalized === 'f' || normalized === 'girl' || normalized === 'girls' || normalized === 'femme';
};

export function BiWeeklyReport({ onBack }: BiWeeklyReportProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [report, setReport] = useState<BiWeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [styleGender, setStyleGender] = useState(() => readReportStyleGender());
  const copy = BIWEEKLY_REPORT_I18N[language as keyof typeof BIWEEKLY_REPORT_I18N] || BIWEEKLY_REPORT_I18N.en;
  const isGirlsTheme = isGirlsStyleValue(styleGender);

  useEffect(() => {
    setLanguage(getActiveLanguage());

    const handleLanguageChanged = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChanged);
    window.addEventListener('storage', handleLanguageChanged);
    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChanged);
      window.removeEventListener('storage', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    const handleThemeChanged = () => setStyleGender(readReportStyleGender());
    window.addEventListener('repset:app-style-gender-changed', handleThemeChanged);
    window.addEventListener('repset:stored-user-changed', handleThemeChanged);
    window.addEventListener('storage', handleThemeChanged);
    return () => {
      window.removeEventListener('repset:app-style-gender-changed', handleThemeChanged);
      window.removeEventListener('repset:stored-user-changed', handleThemeChanged);
      window.removeEventListener('storage', handleThemeChanged);
    };
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    const parsedUserId = Number(user?.id || 0);
    const userId = localUserId || parsedUserId;

    if (!userId) {
      setLoading(false);
      return;
    }

    const loadReport = async () => {
      try {
        const data = await api.getBiWeeklyReport(userId);
        setReport(data);
      } catch (error) {
        console.error('Failed to load bi-weekly report:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, []);

  const improvements = report?.improvements?.length
    ? report.improvements
    : [{ title: copy.improvementsEmptyTitle, detail: copy.improvementsEmptyDetail }];
  const nextFocus = report?.nextFocus?.length
    ? report.nextFocus
    : [{ title: copy.nextFocusEmptyTitle, detail: copy.nextFocusEmptyDetail }];
  const sectionTitleClassName = isGirlsTheme ? 'text-[#A87884]' : 'text-text-secondary';
  const cardClassName = isGirlsTheme
    ? 'border-[#E2B4BD]/45 bg-white/75 shadow-[0_12px_28px_rgba(226,180,189,0.12)] ring-1 ring-white/35'
    : 'bg-card border-white/5';
  const itemTitleClassName = isGirlsTheme ? 'text-[#4A4A4A]' : 'text-white';
  const itemDetailClassName = isGirlsTheme ? 'text-[#795E67]' : 'text-text-secondary';
  const improvementIconClassName = isGirlsTheme
    ? 'bg-[#CFECF3]/60 text-[#4A4A4A] ring-1 ring-[#CFECF3]/80'
    : 'bg-green-500/10 text-green-500';
  const nextFocusIconClassName = isGirlsTheme
    ? 'bg-[#F9B2D7]/22 text-[#A87884] ring-1 ring-[#F9B2D7]/35'
    : 'bg-yellow-500/10 text-yellow-500';

  return (
    <div className="flex-1 flex flex-col pb-24">
      <Header title={copy.title} onBack={onBack} />

      <div className="space-y-6">
        <Card className={isGirlsTheme
          ? '!border-[#E2B4BD]/45 !bg-[linear-gradient(135deg,rgba(249,178,215,0.24),rgba(255,255,255,0.82)_50%,rgba(207,236,243,0.30))] !shadow-[0_18px_42px_rgba(226,180,189,0.18)] ring-1 ring-white/45'
          : 'bg-gradient-to-br from-accent/20 to-purple-500/20 border-accent/20'
        }>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className={isGirlsTheme ? 'text-[#A87884]' : 'text-accent'} size={20} />
            <h3 className={`font-medium ${itemTitleClassName}`}>{copy.summaryTitle}</h3>
          </div>
          <p className={`text-sm leading-relaxed ${isGirlsTheme ? 'text-[#795E67]' : 'text-white/90'}`}>
            {loading
              ? copy.summaryLoading
              : report?.summary || copy.summaryEmpty}
          </p>
          {!loading && report?.aiStatus === 'fallback' && report?.aiNotice ? (
            <div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/55 text-[#795E67]' : 'border-yellow-400/20 bg-yellow-500/10 text-yellow-100'}`}>
              {report.aiNotice}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <h3 className={`text-sm font-medium uppercase tracking-wider ${sectionTitleClassName}`}>
            {copy.improvementsTitle}
          </h3>
          {improvements.map((item) => (
            <div key={`${item.title}-${item.detail}`} className={`rounded-xl border p-4 flex items-start gap-4 ${cardClassName}`}>
              <div className={`p-2 rounded-lg ${improvementIconClassName}`}>
                <ArrowUpRight size={20} />
              </div>
              <div>
                <h4 className={`font-medium ${itemTitleClassName}`}>{item.title}</h4>
                <p className={`text-xs mt-1 ${itemDetailClassName}`}>
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className={`text-sm font-medium uppercase tracking-wider ${sectionTitleClassName}`}>
            {copy.nextFocusTitle}
          </h3>
          {nextFocus.map((item) => (
            <div key={`${item.title}-${item.detail}`} className={`rounded-xl border p-4 flex items-start gap-4 ${cardClassName}`}>
              <div className={`p-2 rounded-lg ${nextFocusIconClassName}`}>
                <Target size={20} />
              </div>
              <div>
                <h4 className={`font-medium ${itemTitleClassName}`}>{item.title}</h4>
                <p className={`text-xs mt-1 ${itemDetailClassName}`}>
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>);

}
