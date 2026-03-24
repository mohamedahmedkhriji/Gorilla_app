import React, { useState } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Tank1PlanScreen } from './Tank1PlanScreen';

const tank1CoverImage = new URL('../../assets/emoji/T-1.png', import.meta.url).href;

interface BooksLibraryProps {
  onBack: () => void;
}

export function BooksLibrary({ onBack }: BooksLibraryProps) {
  const [activePlan, setActivePlan] = useState<'tank-1' | null>(null);

  if (activePlan === 'tank-1') {
    return <Tank1PlanScreen onBack={() => setActivePlan(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title="Plans" onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 space-y-4">
        <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-4">
          <p className="text-sm text-text-secondary">
            Open your RepSet plan template and review the full month-by-month split.
          </p>
        </div>

        <Card
          onClick={() => setActivePlan('tank-1')}
          className="cursor-pointer border border-accent/20 bg-accent/5 p-4 transition-colors hover:border-accent/40"
        >
          <div className="flex gap-4">
            <div className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-accent/30 via-accent/10 to-white/10">
              <img
                src={tank1CoverImage}
                alt="Tank-1 cover"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex-1">
              <div className="mb-2 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                RepSet Plan Template
              </div>
              <h3 className="font-bold text-white">Tank-1</h3>
              <p className="mb-2 text-xs text-text-secondary">By RepSet</p>
              <p className="text-xs text-text-tertiary">
                Tank-1 is a RepSet bodybuilding plan with Month 1 and Month 2 progression, exact pairings,
                technique instructions, and RepSet coaching comments for every day.
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent">
                <ClipboardList size={12} /> Open Plan
              </div>
            </div>

            <ArrowRight size={16} className="mt-1 shrink-0 text-text-secondary" />
          </div>
        </Card>
      </div>
    </div>
  );
}
