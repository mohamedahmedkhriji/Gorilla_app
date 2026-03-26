import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, Crown, TrendingUp } from 'lucide-react';
import { Header } from '../components/ui/Header';
import { Card } from '../components/ui/Card';
import { Tank1PlanScreen } from './Tank1PlanScreen';
import { T2PlanScreen } from './T2PlanScreen';
import { T2BulkingPlanScreen } from './T2BulkingPlanScreen';
import { AppLanguage, getActiveLanguage } from '../services/language';
import { BOOK_USAGE_UPDATED_EVENT, readBookUsage, type BookUsageMap } from '../services/bookUsage';
import { getAssignedBookPlan } from '../services/bookPlanSelection';

const tank1CoverImage = new URL('../../assets/emoji/T-1.png', import.meta.url).href;
const vipIcon = new URL('../../assets/emoji/vip.png', import.meta.url).href;

interface BooksLibraryProps {
  onBack: () => void;
}

type BooksLibraryCopy = {
  title: string;
  intro: string;
  openPlan: string;
  notUsedYet: string;
  activeNow: string;
  premium: string;
  t2CoverSubtitle: string;
  t2BulkCoverSubtitle: string;
  tank1Badge: string;
  tank1Author: string;
  tank1Description: string;
  t2Badge: string;
  t2Author: string;
  t2Description: string;
  t2BulkBadge: string;
  t2BulkAuthor: string;
  t2BulkDescription: string;
};

const BOOKS_LIBRARY_I18N: Record<AppLanguage, BooksLibraryCopy> = {
  en: {
    title: 'Plans',
    intro: 'Open your RepSet plan templates and review the full structure before applying one.',
    openPlan: 'Open Plan',
    notUsedYet: 'Not used yet',
    activeNow: 'Active now',
    premium: 'Premium',
    tank1Badge: 'RepSet Plan Template',
    tank1Author: 'By RepSet',
    tank1Description: 'Tank-1 is a RepSet bodybuilding plan with Month 1 and Month 2 progression, exact pairings, technique instructions, and RepSet coaching comments for every day.',
    t2Badge: 'RepSet Cutting Template',
    t2Author: 'By RepSet',
    t2Description: 'T-2 is an 8-week cutting plan with alternating density and pump weeks, adaptive overload logic, cardio control, and fatigue-based adjustments.',
    t2BulkBadge: 'RepSet Bulking Template',
    t2BulkAuthor: 'By RepSet',
    t2BulkDescription: 'T-2 Bulking is a 2-week rotating mass plan with a strength week, a hypertrophy stretch week, and smart overload built around chest, back, and leg growth.',
  },
  ar: {
    title: 'الخطط',
    intro: 'افتح قوالب خطط RepSet وراجع الهيكل الكامل قبل تطبيق أي خطة.',
    openPlan: 'افتح الخطة',
    notUsedYet: 'لم تستخدمه بعد',
    activeNow: 'نشطة الآن',
    premium: 'Premium',
    tank1Badge: 'قالب خطة RepSet',
    tank1Author: 'بواسطة RepSet',
    tank1Description: 'Tank-1 هي خطة كمال أجسام من RepSet مع تدرج للشهر الأول والشهر الثاني، واقترانات دقيقة، وتعليمات تكنيك، وملاحظات تدريب RepSet لكل يوم.',
    t2Badge: 'قالب تنشيف من RepSet',
    t2Author: 'بواسطة RepSet',
    t2Description: 'T-2 هي خطة تنشيف لمدة 8 أسابيع تعتمد على التناوب بين أسابيع الكثافة وأسابيع الضخ مع قواعد تدرج ذكية وتحكم في الكارديو حسب الإجهاد.',
    t2BulkBadge: 'قالب تضخيم من RepSet',
    t2BulkAuthor: 'بواسطة RepSet',
    t2BulkDescription: 'T-2 للتضخيم هي خطة كتلة بدوران أسبوعين تجمع بين أسبوع قوة وأسبوع تضخيم تمددي مع تدرج ذكي لزيادة الصدر والظهر والأرجل.',
  },
  it: {
    title: 'Piani',
    intro: 'Apri i template piano RepSet e rivedi la struttura completa prima di applicarne uno.',
    openPlan: 'Apri Piano',
    notUsedYet: 'Non usato ancora',
    activeNow: 'Attivo ora',
    premium: 'Premium',
    tank1Badge: 'Template Piano RepSet',
    tank1Author: 'Di RepSet',
    tank1Description: 'Tank-1 e un piano bodybuilding RepSet con progressione del mese 1 e del mese 2, abbinamenti esatti, istruzioni tecniche e commenti coaching RepSet per ogni giorno.',
    t2Badge: 'Template Cutting RepSet',
    t2Author: 'Di RepSet',
    t2Description: 'T-2 e un piano cutting di 8 settimane con settimane di densita e pump alternate, regole smart di overload e aggiustamenti basati sulla fatica.',
    t2BulkBadge: 'Template Bulk RepSet',
    t2BulkAuthor: 'Di RepSet',
    t2BulkDescription: 'T-2 Bulking e un piano massa a rotazione di 2 settimane con una settimana forza, una settimana stretch hypertrophy e overload smart.',
  },
  de: {
    title: 'Plaene',
    intro: 'Oeffne deine RepSet-Planvorlagen und pruefe die komplette Struktur, bevor du eine uebernimmst.',
    openPlan: 'Plan Oeffnen',
    notUsedYet: 'Noch nicht genutzt',
    activeNow: 'Jetzt aktiv',
    premium: 'Premium',
    tank1Badge: 'RepSet-Planvorlage',
    tank1Author: 'Von RepSet',
    tank1Description: 'Tank-1 ist ein RepSet-Bodybuilding-Plan mit Monat-1- und Monat-2-Fortschritt, exakten Kombinationen, Technikhinweisen und RepSet-Coaching-Kommentaren fuer jeden Tag.',
    t2Badge: 'RepSet-Cutting-Vorlage',
    t2Author: 'Von RepSet',
    t2Description: 'T-2 ist ein 8-Wochen-Cutting-Plan mit wechselnden Dichte- und Pump-Wochen, smarten Overload-Regeln und fatiguebasierten Anpassungen.',
    t2BulkBadge: 'RepSet-Bulking-Vorlage',
    t2BulkAuthor: 'Von RepSet',
    t2BulkDescription: 'T-2 Bulking ist ein 2-Wochen-Masseplan mit Kraftwoche, Stretch-Hypertrophie-Woche und smartem Overload fuer Brust, Ruecken und Beine.',
  },
};

const formatBookUsage = (language: AppLanguage, count: number, emptyLabel: string) => {
  if (count <= 0) return emptyLabel;

  switch (language) {
    case 'ar':
      return `استخدمته ${count} مرة`;
    case 'it':
      return `Usato ${count} volte`;
    case 'de':
      return `${count}x genutzt`;
    case 'en':
    default:
      return `Used ${count} ${count === 1 ? 'time' : 'times'}`;
  }
};

function PremiumCover({
  title,
  subtitle,
  tint,
  overlay,
  coverImageAlt,
}: {
  title: string;
  subtitle: string;
  tint: string;
  overlay: string;
  coverImageAlt: string;
}) {
  return (
    <div className={`relative flex aspect-[2/3] w-16 shrink-0 flex-col justify-between overflow-hidden rounded-lg border border-white/10 ${tint} p-2`}>
      <img src={tank1CoverImage} alt={coverImageAlt} className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className={`absolute inset-0 ${overlay}`} />
      <div className="absolute right-1 top-1 rounded-full border border-white/15 bg-black/35 p-1">
        <img src={vipIcon} alt="VIP" className="h-3.5 w-3.5 object-contain" />
      </div>
      <div className="relative text-[8px] font-semibold uppercase tracking-[0.18em] text-white/80">RepSet</div>
      <div className="relative">
        <div className="font-electrolize text-xl leading-none text-white">{title}</div>
        <div className="mt-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/85">{subtitle}</div>
      </div>
    </div>
  );
}

function BookCard({
  title,
  badge,
  author,
  description,
  usageLabel,
  usageActive,
  activeLabel,
  isCurrentPlan,
  premiumLabel,
  isPremium,
  openLabel,
  onClick,
  cover,
  className,
}: {
  title: string;
  badge: string;
  author: string;
  description: string;
  usageLabel: string;
  usageActive: boolean;
  activeLabel: string;
  isCurrentPlan: boolean;
  premiumLabel: string;
  isPremium: boolean;
  openLabel: string;
  onClick: () => void;
  cover: React.ReactNode;
  className: string;
}) {
  return (
    <Card onClick={onClick} className={`cursor-pointer p-4 transition-colors hover:border-accent/40 ${className}`}>
      <div className="flex gap-4">
        {cover}
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              {badge}
            </div>
            {isPremium && (
              <div className="inline-flex items-center gap-1 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-yellow-100">
                <img src={vipIcon} alt="VIP" className="h-3 w-3 object-contain" />
                {premiumLabel}
              </div>
            )}
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] ${
                usageActive
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : 'border-white/10 bg-white/5 text-text-secondary'
              }`}
            >
              <TrendingUp size={10} />
              {usageLabel}
            </div>
            {isCurrentPlan && (
              <div className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-emerald-200">
                <Crown size={10} />
                {activeLabel}
              </div>
            )}
          </div>
          <h3 className="font-bold text-white">{title}</h3>
          <p className="mb-2 text-xs text-text-secondary">{author}</p>
          <p className="text-xs text-text-tertiary">{description}</p>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent">
            <ClipboardList size={12} /> {openLabel}
          </div>
        </div>
        <ArrowRight size={16} className="mt-1 shrink-0 text-text-secondary" />
      </div>
    </Card>
  );
}

export function BooksLibrary({ onBack }: BooksLibraryProps) {
  const [activePlan, setActivePlan] = useState<'tank-1' | 't-2' | 't-2-bulk' | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(() => getActiveLanguage());
  const [usage, setUsage] = useState<BookUsageMap>(() => readBookUsage());
  const [assignedPlanId, setAssignedPlanId] = useState(() => getAssignedBookPlan().id);
  const copy = useMemo(() => BOOKS_LIBRARY_I18N[language] || BOOKS_LIBRARY_I18N.en, [language]);

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<{ language?: AppLanguage }>).detail?.language;
      setLanguage(nextLanguage || getActiveLanguage());
    };
    const handleUsageChange = () => {
      setUsage(readBookUsage());
      setAssignedPlanId(getAssignedBookPlan().id);
    };

    window.addEventListener('app-language-changed', handleLanguageChange);
    window.addEventListener(BOOK_USAGE_UPDATED_EVENT, handleUsageChange);
    window.addEventListener('program-updated', handleUsageChange);
    window.addEventListener('storage', handleUsageChange);

    return () => {
      window.removeEventListener('app-language-changed', handleLanguageChange);
      window.removeEventListener(BOOK_USAGE_UPDATED_EVENT, handleUsageChange);
      window.removeEventListener('program-updated', handleUsageChange);
      window.removeEventListener('storage', handleUsageChange);
    };
  }, []);

  if (activePlan === 'tank-1') return <Tank1PlanScreen onBack={() => setActivePlan(null)} />;
  if (activePlan === 't-2') return <T2PlanScreen onBack={() => setActivePlan(null)} />;
  if (activePlan === 't-2-bulk') return <T2BulkingPlanScreen onBack={() => setActivePlan(null)} />;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background pb-24">
      <div className="px-4 pt-2 sm:px-6">
        <Header title={copy.title} onBack={onBack} />
      </div>

      <div className="space-y-4 px-4 sm:px-6">
        <div className="rounded-2xl border border-white/12 bg-white/5 px-4 py-4">
          <p className="text-sm text-text-secondary">{copy.intro}</p>
        </div>

        <BookCard
          title="Tank-1"
          badge={copy.tank1Badge}
          author={copy.tank1Author}
          description={copy.tank1Description}
          usageLabel={formatBookUsage(language, usage['tank-1']?.appliedCount || 0, copy.notUsedYet)}
          usageActive={(usage['tank-1']?.appliedCount || 0) > 0}
          activeLabel={copy.activeNow}
          isCurrentPlan={assignedPlanId === 'tank-1'}
          premiumLabel={copy.premium}
          isPremium={false}
          openLabel={copy.openPlan}
          onClick={() => setActivePlan('tank-1')}
          className="border border-accent/20 bg-accent/5"
          cover={(
            <div className="aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-accent/30 via-accent/10 to-white/10">
              <img src={tank1CoverImage} alt="Tank-1 cover" className="h-full w-full object-cover" />
            </div>
          )}
        />

        <BookCard
          title="T-2"
          badge={copy.t2Badge}
          author={copy.t2Author}
          description={copy.t2Description}
          usageLabel={formatBookUsage(language, usage['t-2']?.appliedCount || 0, copy.notUsedYet)}
          usageActive={(usage['t-2']?.appliedCount || 0) > 0}
          activeLabel={copy.activeNow}
          isCurrentPlan={assignedPlanId === 't-2'}
          premiumLabel={copy.premium}
          isPremium
          openLabel={copy.openPlan}
          onClick={() => setActivePlan('t-2')}
          className="border border-white/12 bg-white/5"
          cover={(
            <PremiumCover
              title="T-2"
              subtitle={language === 'ar' ? 'تنشيف' : language === 'it' ? 'Definizione' : language === 'de' ? 'Definition' : 'Cutting'}
              tint="bg-[radial-gradient(circle_at_top_left,rgba(201,255,89,0.45),transparent_38%),linear-gradient(160deg,rgba(24,30,18,1),rgba(44,55,35,0.96))]"
              overlay="bg-[linear-gradient(160deg,rgba(24,30,18,0.55),rgba(44,55,35,0.92))]"
              coverImageAlt="T-2 cover"
            />
          )}
        />

        <BookCard
          title="T-2 Bulking"
          badge={copy.t2BulkBadge}
          author={copy.t2BulkAuthor}
          description={copy.t2BulkDescription}
          usageLabel={formatBookUsage(language, usage['t-2-bulk']?.appliedCount || 0, copy.notUsedYet)}
          usageActive={(usage['t-2-bulk']?.appliedCount || 0) > 0}
          activeLabel={copy.activeNow}
          isCurrentPlan={assignedPlanId === 't-2-bulk'}
          premiumLabel={copy.premium}
          isPremium
          openLabel={copy.openPlan}
          onClick={() => setActivePlan('t-2-bulk')}
          className="border border-orange-300/20 bg-orange-300/5"
          cover={(
            <PremiumCover
              title="T-2"
              subtitle={language === 'ar' ? 'تضخيم' : language === 'it' ? 'Massa' : language === 'de' ? 'Aufbau' : 'Bulking'}
              tint="bg-[radial-gradient(circle_at_top_left,rgba(255,178,89,0.5),transparent_40%),linear-gradient(160deg,rgba(46,26,17,1),rgba(75,45,29,0.96))]"
              overlay="bg-[linear-gradient(160deg,rgba(46,26,17,0.55),rgba(75,45,29,0.92))]"
              coverImageAlt="T-2 Bulking cover"
            />
          )}
        />
      </div>
    </div>
  );
}
