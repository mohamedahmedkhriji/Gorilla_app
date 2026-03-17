import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, ArrowUp } from 'lucide-react';
import { api } from '../../services/api';
import { AppLanguage, getActiveLanguage, getStoredLanguage } from '../../services/language';

interface OverloadRecommendation {
  name: string;
  current: string;
  next: string;
}

const OVERLOAD_I18N = {
  en: {
    title: 'Next Period Overload',
    sourcePrefix: 'Source',
    sourcePlan: 'Current plan week',
    sourceRecent: 'Recent performance',
    empty: 'No overload recommendations yet. Log more sets to generate your next progression targets.',
    footerPlan: 'Recommendations are generated from your active plan week and your latest completed sets.',
    footerRecent: 'Based on your recent performance, RepSet recommends these increases to maintain progressive overload.',
  },
  ar: {
    title: 'الزيادة التدريجية للفترة القادمة',
    sourcePrefix: 'المصدر',
    sourcePlan: 'أسبوع الخطة الحالي',
    sourceRecent: 'الأداء الأخير',
    empty: 'لا توجد توصيات زيادة بعد. سجّل مجموعات أكثر لتوليد أهداف التقدم التالية.',
    footerPlan: 'يتم إنشاء التوصيات من أسبوع خطتك الحالي وآخر مجموعات مكتملة لديك.',
    footerRecent: 'استنادًا إلى أدائك الأخير، يقترح RepSet هذه الزيادات للحفاظ على الزيادة التدريجية.',
  },
} as const;

interface OverloadPlanningProps {
  coachmarkTargetId?: string;
}

export function OverloadPlanning({ coachmarkTargetId }: OverloadPlanningProps) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [recommendations, setRecommendations] = useState<OverloadRecommendation[]>([]);
  const [sourceMode, setSourceMode] = useState<'plan' | 'recent'>('recent');
  const [loading, setLoading] = useState(true);
  const copy = OVERLOAD_I18N[language] || OVERLOAD_I18N.en;
  const sourceLabel = sourceMode === 'plan' ? copy.sourcePlan : copy.sourceRecent;

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

  const getUserId = () => {
    const localUserId = Number(localStorage.getItem('appUserId') || localStorage.getItem('userId') || 0);
    let parsedUserId = 0;
    try {
      const user = JSON.parse(localStorage.getItem('appUser') || localStorage.getItem('user') || '{}');
      parsedUserId = Number(user?.id || 0);
    } catch {
      parsedUserId = 0;
    }
    return localUserId || parsedUserId;
  };

  const loadOverloadPlan = useCallback(async () => {
    const userId = getUserId();

    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.getOverloadPlan(userId);
      const list = Array.isArray(data?.recommendations) ? data.recommendations : [];
      const source = String(data?.meta?.source || '').toLowerCase();
      const fromPlan = source === 'active_program_plan';
      setSourceMode(fromPlan ? 'plan' : 'recent');
      setRecommendations(list.slice(0, 3));
    } catch (error) {
      console.error('Failed to load overload plan:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverloadPlan();

    const handleRefresh = () => {
      setLoading(true);
      void loadOverloadPlan();
    };

    window.addEventListener('gamification-updated', handleRefresh);
    window.addEventListener('recovery-updated', handleRefresh);
    window.addEventListener('program-updated', handleRefresh);
    window.addEventListener('workout-progress-updated', handleRefresh);

    const intervalId = window.setInterval(() => {
      void loadOverloadPlan();
    }, 30000);

    return () => {
      window.removeEventListener('gamification-updated', handleRefresh);
      window.removeEventListener('recovery-updated', handleRefresh);
      window.removeEventListener('program-updated', handleRefresh);
      window.removeEventListener('workout-progress-updated', handleRefresh);
      window.clearInterval(intervalId);
    };
  }, [loadOverloadPlan]);

  return (
    <Card coachmarkTargetId={coachmarkTargetId} className="bg-gradient-to-br from-card to-accent/5 border-accent/20">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="text-accent" size={20} />
        <h3 className="font-bold text-white">{copy.title}</h3>
      </div>
      <p className="text-[11px] text-text-tertiary -mt-2 mb-3">
        {copy.sourcePrefix}: {sourceLabel}
      </p>

      <div className="space-y-3">
        {!loading && recommendations.length === 0 && (
          <div className="p-3 bg-black/20 rounded-xl border border-white/5 text-xs text-text-secondary">
            {copy.empty}
          </div>
        )}

        {recommendations.map((rec, i) =>
        <div
          key={i}
          className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">

            <span className="text-sm font-medium text-white">{rec.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary">{rec.current}</span>
              <ArrowUp size={12} className="text-text-tertiary" />
              <span className="text-xs font-bold text-accent">{rec.next}</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-text-secondary mt-4 leading-relaxed">
        {sourceMode === 'plan'
          ? copy.footerPlan
          : copy.footerRecent}
      </p>
    </Card>);

}
