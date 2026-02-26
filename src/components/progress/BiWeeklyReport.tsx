import React, { useEffect, useState } from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Sparkles, ArrowUpRight, Target } from 'lucide-react';
import { api } from '../../services/api';
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

export function BiWeeklyReport({ onBack }: BiWeeklyReportProps) {
  const [report, setReport] = useState<BiWeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);

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
    : [{ title: 'No major improvements yet', detail: 'Log more workouts this period to unlock detailed trends.' }];
  const nextFocus = report?.nextFocus?.length
    ? report.nextFocus
    : [{ title: 'Keep training consistently', detail: 'Complete your scheduled sessions this week.' }];

  return (
    <div className="flex-1 flex flex-col pb-24">
      <Header title="Bi-Weekly Report" onBack={onBack} />

      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-accent/20 to-purple-500/20 border-accent/20">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-accent" size={20} />
            <h3 className="font-medium text-white">AI Coach Summary</h3>
          </div>
          <p className="text-sm text-white/90 leading-relaxed">
            {loading
              ? 'Analyzing your recent training data...'
              : report?.summary || 'No report data yet. Start logging workouts to generate a personalized report.'}
          </p>
        </Card>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Improvements
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
            Next Focus
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
