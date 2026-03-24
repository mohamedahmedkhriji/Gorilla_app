import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Tank1PlanScreen } from './Tank1PlanScreen';
import { AppLanguage, getActiveLanguage } from '../services/language';

const tank1CoverImage = new URL('../../assets/emoji/T-1.png', import.meta.url).href;

interface BooksLibraryProps {
  onBack: () => void;
}

const BOOKS_LIBRARY_I18N: Record<AppLanguage, {
  title: string;
  intro: string;
  tank1Badge: string;
  tank1Author: string;
  tank1Description: string;
  openPlan: string;
}> = {
  en: {
    title: 'Plans',
    intro: 'Open your RepSet plan template and review the full month-by-month split.',
    tank1Badge: 'RepSet Plan Template',
    tank1Author: 'By RepSet',
    tank1Description: 'Tank-1 is a RepSet bodybuilding plan with Month 1 and Month 2 progression, exact pairings, technique instructions, and RepSet coaching comments for every day.',
    openPlan: 'Open Plan',
  },
  ar: {
    title: 'الخطط',
    intro: 'افتح قالب خطة RepSet وراجع التقسيمة الكاملة شهرًا بعد شهر.',
    tank1Badge: 'قالب خطة RepSet',
    tank1Author: 'بواسطة RepSet',
    tank1Description: 'Tank-1 هي خطة كمال أجسام من RepSet مع تدرج للشهر الأول والشهر الثاني، واقترانات دقيقة، وتعليمات تكنيك، وملاحظات تدريب RepSet لكل يوم.',
    openPlan: 'افتح الخطة',
  },
  it: {
    title: 'Piani',
    intro: 'Apri il tuo template piano RepSet e rivedi la split completa mese per mese.',
    tank1Badge: 'Template Piano RepSet',
    tank1Author: 'Di RepSet',
    tank1Description: 'Tank-1 e un piano bodybuilding RepSet con progressione del mese 1 e del mese 2, abbinamenti esatti, istruzioni tecniche e commenti coaching RepSet per ogni giorno.',
    openPlan: 'Apri Piano',
  },
  de: {
    title: 'Plaene',
    intro: 'Oeffne deine RepSet-Planvorlage und pruefe die komplette Split-Struktur Monat fuer Monat.',
    tank1Badge: 'RepSet-Planvorlage',
    tank1Author: 'Von RepSet',
    tank1Description: 'Tank-1 ist ein RepSet-Bodybuilding-Plan mit Monat-1- und Monat-2-Fortschritt, exakten Kombinationen, Technikhinweisen und RepSet-Coaching-Kommentaren fuer jeden Tag.',
    openPlan: 'Plan Oeffnen',
  },
};

export function BooksLibrary({ onBack }: BooksLibraryProps) {
  const [activePlan, setActivePlan] = useState<'tank-1' | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const copy = useMemo(() => BOOKS_LIBRARY_I18N[language] || BOOKS_LIBRARY_I18N.en, [language]);

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<{ language?: AppLanguage }>).detail?.language;
      setLanguage(nextLanguage || getActiveLanguage());
    };

    window.addEventListener('app-language-changed', handleLanguageChange);
    return () => window.removeEventListener('app-language-changed', handleLanguageChange);
  }, []);

  if (activePlan === 'tank-1') {
    return <Tank1PlanScreen onBack={() => setActivePlan(null)} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-screen pb-24">
      <div className="px-4 sm:px-6 pt-2">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="px-4 sm:px-6 space-y-4">
        <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-4">
          <p className="text-sm text-text-secondary">
            {copy.intro}
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
                {copy.tank1Badge}
              </div>
              <h3 className="font-bold text-white">Tank-1</h3>
              <p className="mb-2 text-xs text-text-secondary">{copy.tank1Author}</p>
              <p className="text-xs text-text-tertiary">
                {copy.tank1Description}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent">
                <ClipboardList size={12} /> {copy.openPlan}
              </div>
            </div>

            <ArrowRight size={16} className="mt-1 shrink-0 text-text-secondary" />
          </div>
        </Card>
      </div>
    </div>
  );
}
