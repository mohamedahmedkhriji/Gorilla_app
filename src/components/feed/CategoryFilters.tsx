import React from 'react';
import { Apple, Brain, Dumbbell, MoonStar, Sparkles, Venus } from 'lucide-react';
import type { FeedCategory } from './types';

const FILTER_ICONS: Record<FeedCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  All: Sparkles,
  Women: Venus,
  Training: Dumbbell,
  Nutrition: Apple,
  Recovery: MoonStar,
  Mindset: Brain,
};

type CategoryFiltersProps = {
  filters: FeedCategory[];
  activeCategory: FeedCategory;
  onSelect: (category: FeedCategory) => void;
  getLabel: (category: FeedCategory) => string;
  getCount: (category: FeedCategory) => number;
};

export default function CategoryFilters({
  filters,
  activeCategory,
  onSelect,
  getLabel,
  getCount,
}: CategoryFiltersProps) {
  return (
    <div
      data-coachmark-target="blogs_category_filters"
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
    >
      <div className="flex min-w-max snap-x gap-3">
        {filters.map((category) => {
          const isActive = category === activeCategory;
          const Icon = FILTER_ICONS[category];

          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelect(category)}
              className={`snap-start shrink-0 rounded-full border px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'border-accent/35 bg-accent/12 text-text-primary shadow-[0_10px_28px_rgb(var(--color-accent)/0.16)]'
                  : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent/20 hover:bg-white/10 hover:text-text-primary'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${isActive ? 'bg-accent text-black' : 'bg-white/10 text-text-secondary'}`}>
                  <Icon size={14} />
                </span>
                <span>{getLabel(category)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-black/10 text-black/80' : 'bg-white/10 text-text-tertiary'}`}>
                  {getCount(category)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
