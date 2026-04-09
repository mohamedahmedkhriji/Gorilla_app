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
} as const;

export function BiWeeklyReport({ onBack }: BiWeeklyReportProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [report, setReport] = useState<BiWeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const copy = BIWEEKLY_REPORT_I18N[language as keyof typeof BIWEEKLY_REPORT_I18N] || BIWEEKLY_REPORT_I18N.en;

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

  return (
    <div className="flex-1 flex flex-col pb-24">
      <Header title={copy.title} onBack={onBack} />

      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-accent/20 to-purple-500/20 border-accent/20">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-accent" size={20} />
            <h3 className="font-medium text-white">{copy.summaryTitle}</h3>
          </div>
          <p className="text-sm text-white/90 leading-relaxed">
            {loading
              ? copy.summaryLoading
              : report?.summary || copy.summaryEmpty}
          </p>
          {!loading && report?.aiStatus === 'fallback' && report?.aiNotice ? (
            <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
              {report.aiNotice}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            {copy.improvementsTitle}
          </h3>
          {improvements.map((item) => (
            <div key={`${item.title}-${item.detail}`} className="bg-card rounded-xl p-4 border border-white/5 flex items-start gap-4">
              <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                <ArrowUpRight size={20} />
              </div>
              <div>
                <h4 className="font-medium text-white">{item.title}</h4>
                <p className="text-xs text-text-secondary mt-1">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            {copy.nextFocusTitle}
          </h3>
          {nextFocus.map((item) => (
            <div key={`${item.title}-${item.detail}`} className="bg-card rounded-xl p-4 border border-white/5 flex items-start gap-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                <Target size={20} />
              </div>
              <div>
                <h4 className="font-medium text-white">{item.title}</h4>
                <p className="text-xs text-text-secondary mt-1">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>);

}
