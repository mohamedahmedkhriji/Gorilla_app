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
  const activeIndex = Math.max(0, filters.indexOf(activeCategory));
  const islandStyle = {
    '--filter-count': filters.length,
    '--active-filter-index': activeIndex,
  } as React.CSSProperties;

  return (
    <div
      data-coachmark-target="blogs_category_filters"
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
    >
      <div
        className="feed-category-island min-w-max"
        style={islandStyle}
        role="tablist"
        aria-label="Blog categories"
      >
        <span className="feed-category-indicator" aria-hidden="true" />
        {filters.map((category) => {
          const isActive = category === activeCategory;
          const Icon = FILTER_ICONS[category];

          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(category)}
              className={`feed-category-tab ${isActive ? 'is-active' : ''}`}
            >
              <span className="feed-category-tab-inner">
                <span className="feed-category-icon">
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="feed-category-label">{getLabel(category)}</span>
                <span className="feed-category-count">
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
