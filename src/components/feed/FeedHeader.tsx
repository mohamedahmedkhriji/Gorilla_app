import React from 'react';
import { Plus, RefreshCcw, Sparkles } from 'lucide-react';
import { Header } from '../ui/Header';
import type { FeedTab } from './types';

type FeedHeaderProps = {
  title: string;
  subtitle: string;
  tabs: { key: FeedTab; label: string }[];
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  onRefresh: () => void;
  onCreate: () => void;
  refreshAria: string;
  createAria: string;
  refreshing: boolean;
};

export default function FeedHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onRefresh,
  onCreate,
  refreshAria,
  createAria,
  refreshing,
}: FeedHeaderProps) {
  return (
    <section className="surface-glass overflow-hidden rounded-[28px] border border-white/10 px-4 py-4 sm:px-5">
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

      <div data-coachmark-target="blogs_page_intro" className="mt-1 flex items-start gap-3">
        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent sm:flex">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <h1 className="font-electrolize text-[1.75rem] font-semibold leading-none text-text-primary">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-accent text-black shadow-glow'
                  : 'border border-white/10 bg-white/5 text-text-secondary hover:border-accent/25 hover:bg-white/10 hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
