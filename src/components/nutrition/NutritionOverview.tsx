import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Info, Plus, UtensilsCrossed, X } from 'lucide-react';
import BodyMap from '../BodyMap';
import { BODY_MAP_MUSCLES, type BodyMapLevels, type BodyMapMuscle } from '../../lib/muscle-map';
import type { NutritionBodyMode } from './body-svg/nutritionBody.types';
import { AppLanguage, pickLanguage } from '../../services/language';

export type NutritionPlan = {
  targets: { calories: number; protein: number; carbs: number; fat: number; waterMl: number };
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber?: number; sodium?: number };
  hydration: { recommendedWaterMl: number; waterFromFoodsMl: number; remainingWaterMl: number };
  meals: Array<{
    slot: string;
    items: Array<{ name: string; category: string; calories: number; protein: number; carbs: number; fat: number; fiber?: number; sodium?: number }>;
    totals: { calories: number; protein: number; carbs: number; fat: number };
  }>;
  safety?: { warnings?: string[]; clinicianPersonalizationRequired?: boolean; allowedAutomation?: { mealGeneration?: boolean } };
};

type ModeMeta = {
  mode: NutritionBodyMode;
  label: string;
  current: number;
  target: number;
  unit: string;
  remainingLabel: string;
};

const OVERVIEW_COPY = {
  en: {
    todayFuel: "Today's fuel",
    complete: 'complete',
    goal: 'Goal',
    tdee: 'TDEE',
    modes: { hydration: 'Hydration', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' },
    remaining: (value: string, unit: string) => `${value} ${unit} remaining`,
    quickAddWater: 'Quick add water',
    todayMeals: "Today's meals",
    planned: (count: number) => `${count} planned`,
    previousCard: 'Previous nutrition card',
    nextCard: 'Next nutrition card',
    goToCard: (index: number) => `Go to nutrition card ${index}`,
    macros: { protein: 'P', carbs: 'C', fat: 'F' },
    mealSlots: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' },
  },
  ar: {
    todayFuel: 'وقود اليوم',
    complete: 'مكتمل',
    goal: 'الهدف',
    tdee: 'الصرف اليومي',
    modes: { hydration: 'الترطيب', protein: 'البروتين', carbs: 'الكربوهيدرات', fat: 'الدهون' },
    remaining: (value: string, unit: string) => `المتبقي ${value} ${unit}`,
    quickAddWater: 'إضافة ماء سريعة',
    todayMeals: 'وجبات اليوم',
    planned: (count: number) => `${count} مخطط`,
    previousCard: 'بطاقة التغذية السابقة',
    nextCard: 'بطاقة التغذية التالية',
    goToCard: (index: number) => `اذهب إلى بطاقة التغذية ${index}`,
    macros: { protein: 'ب', carbs: 'ك', fat: 'د' },
    mealSlots: { breakfast: 'الفطور', lunch: 'الغداء', dinner: 'العشاء', snack: 'وجبة خفيفة' },
  },
  it: {
    todayFuel: 'Carburante di oggi',
    complete: 'completo',
    goal: 'Obiettivo',
    tdee: 'TDEE',
    modes: { hydration: 'Idratazione', protein: 'Proteine', carbs: 'Carboidrati', fat: 'Grassi' },
    remaining: (value: string, unit: string) => `${value} ${unit} rimanenti`,
    quickAddWater: 'Aggiungi acqua veloce',
    todayMeals: 'Pasti di oggi',
    planned: (count: number) => `${count} pianificati`,
    previousCard: 'Scheda nutrizione precedente',
    nextCard: 'Scheda nutrizione successiva',
    goToCard: (index: number) => `Vai alla scheda nutrizione ${index}`,
    macros: { protein: 'P', carbs: 'C', fat: 'G' },
    mealSlots: { breakfast: 'Colazione', lunch: 'Pranzo', dinner: 'Cena', snack: 'Spuntino' },
  },
  de: {
    todayFuel: 'Heutige Energie',
    complete: 'vollstaendig',
    goal: 'Ziel',
    tdee: 'TDEE',
    modes: { hydration: 'Hydration', protein: 'Protein', carbs: 'Kohlenhydrate', fat: 'Fett' },
    remaining: (value: string, unit: string) => `${value} ${unit} uebrig`,
    quickAddWater: 'Wasser schnell hinzufuegen',
    todayMeals: 'Heutige Mahlzeiten',
    planned: (count: number) => `${count} geplant`,
    previousCard: 'Vorherige Ernaehrungskarte',
    nextCard: 'Naechste Ernaehrungskarte',
    goToCard: (index: number) => `Zur Ernaehrungskarte ${index}`,
    macros: { protein: 'P', carbs: 'K', fat: 'F' },
    mealSlots: { breakfast: 'Fruehstueck', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snack' },
  },
  fr: {
    todayFuel: 'Energie du jour',
    complete: 'termine',
    goal: 'Objectif',
    tdee: 'TDEE',
    modes: { hydration: 'Hydratation', protein: 'Proteines', carbs: 'Glucides', fat: 'Lipides' },
    remaining: (value: string, unit: string) => `${value} ${unit} restants`,
    quickAddWater: 'Ajouter de leau rapidement',
    todayMeals: 'Repas du jour',
    planned: (count: number) => `${count} prevus`,
    previousCard: 'Carte nutrition precedente',
    nextCard: 'Carte nutrition suivante',
    goToCard: (index: number) => `Aller a la carte nutrition ${index}`,
    macros: { protein: 'P', carbs: 'G', fat: 'L' },
    mealSlots: { breakfast: 'Petit-dejeuner', lunch: 'Dejeuner', dinner: 'Diner', snack: 'Collation' },
  },
} as const;

type NutritionOverviewCopy = typeof OVERVIEW_COPY.en;

const clampPercent = (current: number, target: number) => {
  if (!(target > 0)) return 0;
  return Math.max(0, Math.min(160, Math.round((current / target) * 100)));
};

const mealAccent = (slot: string) => {
  const key = slot.toLowerCase();
  if (key.includes('break')) return 'from-amber-400/26 via-orange-300/10';
  if (key.includes('lunch')) return 'from-cyan-400/24 via-sky-300/10';
  if (key.includes('dinner')) return 'from-indigo-400/26 via-cyan-300/10';
  return 'from-emerald-400/20 via-cyan-300/10';
};

const localizeMealSlot = (slot: string, copy: NutritionOverviewCopy) => {
  const key = String(slot || '').trim().toLowerCase();
  if (key.includes('break')) return copy.mealSlots.breakfast;
  if (key.includes('lunch')) return copy.mealSlots.lunch;
  if (key.includes('dinner')) return copy.mealSlots.dinner;
  if (key.includes('snack')) return copy.mealSlots.snack;
  return slot;
};

const getBodyMapLevel = (percent: number) => {
  if (percent <= 0) return 0;
  if (percent < 25) return 1;
  if (percent < 50) return 2;
  if (percent < 75) return 3;
  return 4;
};

const NUTRITION_MODE_MUSCLES: Record<NutritionBodyMode, BodyMapMuscle[]> = {
  hydration: [...BODY_MAP_MUSCLES],
  protein: ['trapezius', 'deltoids', 'chest', 'upper-back', 'serratus', 'biceps', 'triceps', 'forearm', 'abs', 'obliques', 'lower-back', 'gluteal', 'quadriceps', 'hamstring', 'adductors', 'calves'],
  carbs: ['chest', 'upper-back', 'abs', 'obliques', 'quadriceps', 'hamstring', 'gluteal', 'calves'],
  fat: ['abs', 'obliques', 'gluteal', 'quadriceps', 'hamstring'],
  overview: [...BODY_MAP_MUSCLES],
};

type NutritionThemeVariant = 'default' | 'girls';

const nutritionThemes = {
  default: {
    card: 'border-white/10 bg-[#0d131c] text-white shadow-[0_18px_52px_rgba(0,0,0,0.26)]',
    innerCard: 'border-white/10 bg-[#0d131c] shadow-[0_18px_52px_rgba(0,0,0,0.26)]',
    softPanel: 'border-white/10 bg-white/[0.035]',
    eyebrow: 'text-cyan-200/70',
    primaryText: 'text-white',
    secondaryText: 'text-text-secondary',
    tertiaryText: 'text-text-tertiary',
    badge: 'border-cyan-300/18 bg-cyan-300/10',
    accentText: 'text-cyan-200',
    mutedAccentText: 'text-cyan-100/55',
    progress: 'bg-cyan-300',
    iconText: 'text-cyan-300',
    activeButton: 'border-cyan-300 bg-cyan-300 text-black',
    inactiveButton: 'border-white/10 bg-[#0d131c] text-white hover:border-cyan-300/40',
    activeSubtleText: 'text-black/70',
    inactiveSubtleText: 'text-text-secondary',
    waterButton: 'bg-cyan-300 text-black hover:bg-cyan-200',
    mealButton: 'border-white/10 bg-[#0d131c] hover:border-cyan-300/38',
    mealIcon: 'bg-black/24 text-cyan-100',
    mealMacro: 'text-cyan-100/80',
    carouselButton: 'border-white/10 bg-[#0d131c] text-white hover:border-cyan-300/40',
    dotActive: 'bg-cyan-300',
    dotInactive: 'bg-white/25 hover:bg-white/45',
    modalOverlay: 'bg-black/70',
    modalCard: 'border-white/10 bg-[#0d131c]',
    modalHeader: 'border-white/10 bg-[#0d131c]/95',
    closeButton: 'bg-white/10 text-white',
  },
  girls: {
    card: 'border-[#E2B4BD]/55 bg-white/80 text-[#4A4A4A] shadow-[0_18px_52px_rgba(226,180,189,0.26)] backdrop-blur-md',
    innerCard: 'border-[#E2B4BD]/55 bg-white/72 shadow-[0_18px_52px_rgba(226,180,189,0.18)] backdrop-blur-md',
    softPanel: 'border-[#E2B4BD]/45 bg-[#FFF5F8]/72',
    eyebrow: 'text-[#C45A7A]/80',
    primaryText: 'text-[#4A4A4A]',
    secondaryText: 'text-[#7C6168]',
    tertiaryText: 'text-[#9A7881]',
    badge: 'border-[#F9B2D7]/45 bg-[#F9B2D7]/20',
    accentText: 'text-[#C45A7A]',
    mutedAccentText: 'text-[#9A5E70]/65',
    progress: 'bg-[#F9B2D7]',
    iconText: 'text-[#C45A7A]',
    activeButton: 'border-[#F9B2D7] bg-[#F9B2D7] text-[#4A2430]',
    inactiveButton: 'border-[#E2B4BD]/45 bg-white/70 text-[#4A4A4A] hover:border-[#F9B2D7]/70',
    activeSubtleText: 'text-[#4A2430]/70',
    inactiveSubtleText: 'text-[#7C6168]',
    waterButton: 'bg-[#F9B2D7] text-[#4A2430] hover:bg-[#F8C6E0]',
    mealButton: 'border-[#E2B4BD]/45 bg-white/72 hover:border-[#F9B2D7]/70',
    mealIcon: 'bg-white/60 text-[#C45A7A]',
    mealMacro: 'text-[#9A5E70]/80',
    carouselButton: 'border-[#E2B4BD]/55 bg-white/80 text-[#4A4A4A] hover:border-[#F9B2D7]/70',
    dotActive: 'bg-[#F9B2D7]',
    dotInactive: 'bg-[#E2B4BD]/60 hover:bg-[#C45A7A]/45',
    modalOverlay: 'bg-[#4A2430]/55',
    modalCard: 'border-[#E2B4BD]/55 bg-white',
    modalHeader: 'border-[#E2B4BD]/45 bg-white/95',
    closeButton: 'bg-[#F9B2D7]/25 text-[#4A4A4A]',
  },
} as const;

export function NutritionOverview({
  plan,
  goalLabel,
  tdee,
  hydrationLoggedMl,
  addingHydration,
  hydrationError,
  onAddHydration,
  themeVariant = 'default',
  language = 'en',
}: {
  plan: NutritionPlan;
  goalLabel: string;
  tdee: number | null;
  hydrationLoggedMl: number;
  addingHydration: boolean;
  hydrationError: string;
  onAddHydration: (amountMl: number) => void;
  themeVariant?: NutritionThemeVariant;
  language?: AppLanguage;
}) {
  const copy = pickLanguage(language, OVERVIEW_COPY);
  const [mode, setMode] = useState<NutritionBodyMode>('hydration');
  const [activeMealIndex, setActiveMealIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const theme = nutritionThemes[themeVariant];
  const isGirlsTheme = themeVariant === 'girls';

  const directHydrationTarget = Math.max(0, Number(plan.hydration?.remainingWaterMl || plan.targets.waterMl || 0));
  const modes: ModeMeta[] = useMemo(() => [
    {
      mode: 'hydration',
      label: copy.modes.hydration,
      current: hydrationLoggedMl,
      target: directHydrationTarget || Number(plan.targets.waterMl || 0),
      unit: 'ml',
      remainingLabel: copy.remaining(Math.max(0, (directHydrationTarget || plan.targets.waterMl) - hydrationLoggedMl).toLocaleString(), 'ml'),
    },
    {
      mode: 'protein',
      label: copy.modes.protein,
      current: Number(plan.totals.protein || 0),
      target: Number(plan.targets.protein || 0),
      unit: 'g',
      remainingLabel: copy.remaining(Math.max(0, Math.round(plan.targets.protein - plan.totals.protein)).toLocaleString(), 'g'),
    },
    {
      mode: 'carbs',
      label: copy.modes.carbs,
      current: Number(plan.totals.carbs || 0),
      target: Number(plan.targets.carbs || 0),
      unit: 'g',
      remainingLabel: copy.remaining(Math.max(0, Math.round(plan.targets.carbs - plan.totals.carbs)).toLocaleString(), 'g'),
    },
    {
      mode: 'fat',
      label: copy.modes.fat,
      current: Number(plan.totals.fat || 0),
      target: Number(plan.targets.fat || 0),
      unit: 'g',
      remainingLabel: copy.remaining(Math.max(0, Math.round(plan.targets.fat - plan.totals.fat)).toLocaleString(), 'g'),
    },
  ], [copy, directHydrationTarget, hydrationLoggedMl, plan]);

  const activeMode = modes.find((item) => item.mode === mode) || modes[0];
  const caloriesPercent = clampPercent(plan.totals.calories, plan.targets.calories);
  const caloriesRemaining = Math.round(plan.targets.calories - plan.totals.calories);
  const activeMeal = activeMealIndex == null ? null : plan.meals[activeMealIndex];
  const goToCarouselSlide = (index: number) => {
    setCarouselIndex(index);
    carouselRef.current?.scrollTo({
      left: carouselRef.current.clientWidth * index,
      behavior: 'smooth',
    });
  };
  const bodyMapLevels = useMemo<BodyMapLevels>(() => {
    const level = getBodyMapLevel(clampPercent(activeMode.current, activeMode.target));
    return NUTRITION_MODE_MUSCLES[mode].reduce<BodyMapLevels>((levels, muscle) => {
      levels[muscle] = level;
      return levels;
    }, {});
  }, [activeMode.current, activeMode.target, mode]);

  return (
    <div className="space-y-4 pb-4">
      {plan.safety?.warnings?.length ? (
        <section className={`rounded-[1.25rem] border p-3 ${isGirlsTheme ? 'border-[#E2B4BD]/45 bg-white/72' : 'border-amber-300/22 bg-amber-300/8'}`}>
          <div className={`flex gap-2 text-sm ${isGirlsTheme ? 'text-black' : 'text-amber-100'}`}>
            <Info className="mt-0.5 shrink-0" size={16} />
            <div className="space-y-1">
              {plan.safety.warnings.slice(0, 2).map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="relative space-y-3">
        <div
          ref={carouselRef}
          onScroll={(event) => {
            const width = event.currentTarget.clientWidth || 1;
            setCarouselIndex(Math.round(event.currentTarget.scrollLeft / width));
          }}
          className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="w-full shrink-0 snap-start">
            <div className={`space-y-4 rounded-[1.5rem] border p-4 pb-16 ${theme.card}`}>
              <section className={`rounded-[1.5rem] border p-4 ${theme.innerCard}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.eyebrow}`}>{copy.todayFuel}</div>
                    <div className={`mt-1 text-3xl font-black ${theme.primaryText}`}>
                      {plan.totals.calories.toLocaleString()} <span className={`text-base font-semibold ${theme.secondaryText}`}>/ {plan.targets.calories.toLocaleString()} kcal</span>
                    </div>
                  </div>
                  <div className={`rounded-2xl border px-3 py-2 text-right ${theme.badge}`}>
                    <div className={`text-xl font-black ${theme.accentText}`}>{Math.min(caloriesPercent, 100)}%</div>
                    <div className={`text-[10px] uppercase tracking-[0.14em] ${theme.mutedAccentText}`}>{copy.complete}</div>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
                  <div className={`h-full rounded-full ${caloriesRemaining < 0 ? 'bg-orange-400' : theme.progress}`} style={{ width: `${Math.min(caloriesPercent, 100)}%` }} />
                </div>
                <div className={`mt-3 text-[11px] ${theme.tertiaryText}`}>{copy.goal}: {goalLabel}{tdee ? ` | ${copy.tdee} ${tdee.toLocaleString()} kcal` : ''}</div>
              </section>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.eyebrow}`}>{activeMode.label}</div>
                  <div className={`mt-1 text-3xl font-black ${theme.primaryText}`}>{clampPercent(activeMode.current, activeMode.target)}%</div>
                </div>
                <div className={`rounded-2xl border px-3 py-2 text-right ${theme.softPanel}`}>
                  <div className={`text-sm font-black ${theme.accentText}`}>
                    {Math.round(activeMode.current).toLocaleString()} / {Math.round(activeMode.target).toLocaleString()}
                  </div>
                  <div className={`text-[10px] uppercase tracking-[0.14em] ${theme.mutedAccentText}`}>{activeMode.unit}</div>
                </div>
              </div>
              <div className={`mt-4 flex min-h-[20rem] items-center justify-center rounded-2xl border px-2 py-4 ${theme.softPanel}`}>
                <BodyMap className="target-bodymap" body={isGirlsTheme ? 'female' : undefined} levels={bodyMapLevels} view="front" />
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {modes.map((item) => {
                  const pct = clampPercent(item.current, item.target);
                  const isActive = mode === item.mode;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => setMode(item.mode)}
                      className={`min-h-[88px] rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                        isActive ? theme.activeButton : theme.inactiveButton
                      }`}
                    >
                      <div className="text-xs font-black uppercase tracking-[0.14em]">{item.label}</div>
                      <div className="mt-2 text-xl font-black">{pct}%</div>
                      <div className={`mt-1 text-[11px] ${isActive ? theme.activeSubtleText : theme.inactiveSubtleText}`}>{item.remainingLabel}</div>
                    </button>
                  );
                })}
              </div>

              {mode === 'hydration' ? (
                <div className={`rounded-2xl border p-3 ${theme.innerCard}`}>
                  <div className={`flex items-center gap-2 text-sm font-bold ${theme.primaryText}`}><Droplets size={16} className={theme.iconText} /> {copy.quickAddWater}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[250, 500].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={addingHydration}
                        onClick={() => onAddHydration(amount)}
                        className={`min-h-11 rounded-xl text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${theme.waterButton}`}
                      >
                        +{amount} ml
                      </button>
                    ))}
                  </div>
                  {hydrationError ? <div className="mt-2 text-xs text-red-300">{hydrationError}</div> : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-full shrink-0 snap-start">
            <div className={`space-y-3 rounded-[1.5rem] border p-4 pb-16 ${theme.card}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-black ${theme.primaryText}`}>{copy.todayMeals}</h2>
                <div className={`text-xs ${theme.secondaryText}`}>{copy.planned(plan.meals.length)}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {plan.meals.map((meal, index) => (
                  <button
                    key={`${meal.slot}-${index}`}
                    type="button"
                    onClick={() => setActiveMealIndex(index)}
                    className={`group overflow-hidden rounded-[1.25rem] border text-left transition ${theme.mealButton}`}
                  >
                    <div className={`relative min-h-28 bg-gradient-to-br ${mealAccent(meal.slot)} to-transparent p-4`}>
                      <div className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl ${theme.mealIcon}`}>
                        <UtensilsCrossed size={18} />
                      </div>
                      <div className="max-w-[70%]">
                        <div className={`text-xl font-black ${theme.primaryText}`}>{localizeMealSlot(meal.slot, copy)}</div>
                        <div className={`mt-1 text-sm ${theme.secondaryText}`}>{meal.totals.calories} kcal</div>
                      </div>
                      <div className={`mt-5 flex gap-2 text-[11px] font-semibold ${theme.mealMacro}`}>
                        <span>{copy.macros.protein} {meal.totals.protein}g</span>
                        <span>{copy.macros.carbs} {meal.totals.carbs}g</span>
                        <span>{copy.macros.fat} {meal.totals.fat}g</span>
                      </div>
                    </div>
                    <div className={`flex items-center justify-between gap-2 px-4 py-3 text-sm ${theme.secondaryText}`}>
                      <span className="truncate">{meal.items.slice(0, 2).map((item) => item.name.replace(/\s*\([^)]*\)/g, '')).join(', ')}</span>
                      <Plus size={15} className={`shrink-0 ${theme.iconText}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goToCarouselSlide(0)}
            disabled={carouselIndex === 0}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${theme.carouselButton}`}
            aria-label={copy.previousCard}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5 px-1">
            {[0, 1].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToCarouselSlide(index)}
                className={`h-2 rounded-full transition-all ${carouselIndex === index ? `w-6 ${theme.dotActive}` : `w-2 ${theme.dotInactive}`}`}
                aria-label={copy.goToCard(index + 1)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goToCarouselSlide(1)}
            disabled={carouselIndex === 1}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${theme.carouselButton}`}
            aria-label={copy.nextCard}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {activeMeal ? (
        <div className={`fixed inset-0 z-[160] flex items-end justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-16 backdrop-blur-sm sm:items-center sm:p-5 ${theme.modalOverlay}`}>
          <div className={`max-h-[84dvh] w-full max-w-xl overflow-y-auto rounded-[1.5rem] border shadow-2xl ${theme.modalCard}`}>
            <div className={`sticky top-0 z-10 flex items-center justify-between border-b p-4 backdrop-blur ${theme.modalHeader}`}>
              <div>
                <div className={`text-xl font-black ${theme.primaryText}`}>{localizeMealSlot(activeMeal.slot, copy)}</div>
                <div className={`text-sm ${theme.secondaryText}`}>{activeMeal.totals.calories} kcal</div>
              </div>
              <button type="button" onClick={() => setActiveMealIndex(null)} className={`flex h-10 w-10 items-center justify-center rounded-full ${theme.closeButton}`}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 p-4">
              {activeMeal.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className={`rounded-2xl border p-3 ${theme.softPanel}`}>
                  <div className="flex justify-between gap-3">
                    <div className={`font-bold ${theme.primaryText}`}>{item.name}</div>
                    <div className={`shrink-0 text-sm font-bold ${theme.accentText}`}>{item.calories} kcal</div>
                  </div>
                  <div className={`mt-2 text-xs ${theme.secondaryText}`}>{copy.macros.protein} {item.protein}g | {copy.macros.carbs} {item.carbs}g | {copy.macros.fat} {item.fat}g</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
