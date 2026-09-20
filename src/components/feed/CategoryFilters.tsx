import type { FeedCategory } from './types';

type CategoryFiltersProps = {
  filters: FeedCategory[];
  activeCategory: FeedCategory;
  onSelect: (category: FeedCategory) => void;
  getLabel: (category: FeedCategory) => string;
  themeVariant?: 'default' | 'girls';
};

export default function CategoryFilters({
  filters,
  activeCategory,
  onSelect,
  getLabel,
  themeVariant = 'default',
}: CategoryFiltersProps) {
  const isGirlsTheme = themeVariant === 'girls';
  return (
    <div
      data-coachmark-target="blogs_category_filters"
      className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6"
    >
      <div
        className="flex min-w-max items-center gap-1.5"
        role="tablist"
        aria-label="Blog categories"
      >
        {filters.map((category) => {
          const isActive = category === activeCategory;

          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(category)}
              className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${isGirlsTheme ? 'focus-visible:ring-[#F9B2D7]/70' : 'focus-visible:ring-accent'} ${
                isGirlsTheme
                  ? isActive
                    ? 'border-[#F9B2D7]/70 bg-[#F9B2D7] text-[#4A4A4A] shadow-[0_8px_22px_rgba(249,178,215,0.22)]'
                    : 'border-[#E2B4BD]/45 bg-white/70 text-[#795E67] hover:border-[#F9B2D7]/70 hover:text-[#4A4A4A]'
                  : isActive
                    ? 'border-accent bg-accent text-black shadow-[0_8px_22px_rgb(var(--color-accent)/0.16)]'
                    : 'border-white/10 bg-[#111b2a] text-text-secondary hover:border-accent/25 hover:text-text-primary'
              }`}
            >
              {getLabel(category)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
