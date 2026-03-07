import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { WorkspacePage, WorkspaceStatus } from '../../config/workspacePages';

interface WorkspaceGridProps {
  title: string;
  subtitle: string;
  pages: WorkspacePage[];
  onSelect: (page: WorkspacePage) => void;
  theme?: 'dark' | 'light';
}

const statusMeta: Record<WorkspaceStatus, { label: string; dark: string; light: string }> = {
  ready: {
    label: 'Live',
    dark: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
    light: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  partial: {
    label: 'Partial',
    dark: 'bg-amber-500/15 text-amber-200 border border-amber-500/25',
    light: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  planned: {
    label: 'Planned',
    dark: 'bg-slate-500/15 text-slate-300 border border-slate-500/25',
    light: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
};

export function WorkspaceGrid({
  title,
  subtitle,
  pages,
  onSelect,
  theme = 'dark',
}: WorkspaceGridProps) {
  const isLightTheme = theme === 'light';

  return (
    <section
      className={`rounded-2xl border p-4 md:p-5 ${
        isLightTheme
          ? 'bg-white border-slate-200'
          : 'bg-[#242424] border-gray-800'
      }`}
    >
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
        <p className={`text-sm mt-1 ${isLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {pages.map((page) => {
          const badge = statusMeta[page.status];

          return (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelect(page)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                isLightTheme
                  ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  : 'bg-[#1A1A1A] border-gray-800 hover:bg-[#2A2A2A]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-[11px] uppercase tracking-[0.18em] ${isLightTheme ? 'text-slate-500' : 'text-gray-500'}`}>
                    {page.surface === 'mobile' ? 'Mobile App' : 'Web Panel'}
                  </div>
                  <h3 className="mt-2 text-base md:text-lg font-semibold">{page.title}</h3>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isLightTheme ? badge.light : badge.dark}`}>
                  {badge.label}
                </span>
              </div>

              <p className={`mt-3 text-sm leading-6 ${isLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>
                {page.description}
              </p>

              {page.implementation && (
                <p className={`mt-3 text-xs ${isLightTheme ? 'text-slate-500' : 'text-gray-500'}`}>
                  Current: {page.implementation}
                </p>
              )}

              <div className={`mt-4 flex items-center justify-between text-xs font-semibold ${isLightTheme ? 'text-slate-700' : 'text-white/80'}`}>
                <span>Open module</span>
                <ArrowRight size={14} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
