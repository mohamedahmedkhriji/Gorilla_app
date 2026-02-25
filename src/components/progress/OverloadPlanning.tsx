import React from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, ArrowUp } from 'lucide-react';
export function OverloadPlanning() {
  const recommendations = [
  {
    name: 'Bench Press',
    current: '60kg',
    next: '+2.5kg'
  },
  {
    name: 'Squat',
    current: '100kg',
    next: '+5kg'
  },
  {
    name: 'Pull Ups',
    current: '8 reps',
    next: '+1 rep'
  }];

  return (
    <Card className="bg-gradient-to-br from-card to-accent/5 border-accent/20">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="text-accent" size={20} />
        <h3 className="font-bold text-white">Next Period Overload</h3>
      </div>

      <div className="space-y-3">
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
        Based on your recent performance, GORILLA recommends these increases to
        maintain progressive overload.
      </p>
    </Card>);

}