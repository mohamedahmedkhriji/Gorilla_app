import React from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { Header } from '../ui/Header';

type FeedHeaderProps = {
  onRefresh: () => void;
  onCreate: () => void;
  refreshAria: string;
  createAria: string;
  refreshing: boolean;
};

export default function FeedHeader({
  onRefresh,
  onCreate,
  refreshAria,
  createAria,
  refreshing,
}: FeedHeaderProps) {
  return (
    <section data-coachmark-target="blogs_page_intro" className="surface-glass overflow-hidden rounded-[28px] border border-white/10 px-4 py-4 sm:px-5">
      <Header
        compact
        rightElement={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-primary transition-all duration-200 hover:border-accent/40 hover:bg-white/10 active:scale-95 disabled:opacity-60"
              aria-label={refreshAria}
            >
              <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              data-coachmark-target="blogs_create_button"
              type="button"
              onClick={onCreate}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-black shadow-glow transition-all duration-200 hover:opacity-95 active:scale-95"
              aria-label={createAria}
            >
              <Plus size={20} />
            </button>
          </div>
        )}
      />
    </section>
  );
}
