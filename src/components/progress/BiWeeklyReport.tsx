import React from 'react';
import { Header } from '../ui/Header';
import { Card } from '../ui/Card';
import { Sparkles, ArrowUpRight, Target } from 'lucide-react';
interface BiWeeklyReportProps {
  onBack: () => void;
}
export function BiWeeklyReport({ onBack }: BiWeeklyReportProps) {
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
            "Excellent consistency this period, Alex. Your upper body strength
            has increased by 5%, particularly in pushing movements. Recovery
            scores are stable, suggesting you could handle slightly more volume
            next week."
          </p>
        </Card>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Improvements
          </h3>
          <div className="bg-card rounded-xl p-4 border border-white/5 flex items-start gap-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <ArrowUpRight size={20} />
            </div>
            <div>
              <h4 className="font-medium text-white">Bench Press</h4>
              <p className="text-xs text-text-secondary mt-1">
                +5kg increase in 1RM estimate
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-white/5 flex items-start gap-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <ArrowUpRight size={20} />
            </div>
            <div>
              <h4 className="font-medium text-white">Sleep Quality</h4>
              <p className="text-xs text-text-secondary mt-1">
                Avg. 7.5hrs (up from 6.8hrs)
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
            Next Focus
          </h3>
          <div className="bg-card rounded-xl p-4 border border-white/5 flex items-start gap-4">
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
              <Target size={20} />
            </div>
            <div>
              <h4 className="font-medium text-white">Leg Volume</h4>
              <p className="text-xs text-text-secondary mt-1">
                Increase squat volume by 2 sets/week
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>);

}