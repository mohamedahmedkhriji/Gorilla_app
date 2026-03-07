import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { WorkspaceStatus } from '../../config/workspacePages';

interface WorkspacePlaceholderAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface WorkspacePlaceholderScreenProps {
  title: string;
  description: string;
  onBack: () => void;
  theme?: 'dark' | 'light';
  status?: WorkspaceStatus;
  implementation?: string;
  notes?: string[];
  actions?: WorkspacePlaceholderAction[];
}

const statusCopy: Record<WorkspaceStatus, string> = {
  ready: 'Live',
  partial: 'Partially implemented',
  planned: 'Planned',
};

export function WorkspacePlaceholderScreen({
  title,
  description,
  onBack,
  theme = 'dark',
  status = 'planned',
  implementation,
  notes = [],
  actions = [],
}: WorkspacePlaceholderScreenProps) {
  const isLightTheme = theme === 'light';

  return (
    <div className={`min-h-screen ${isLightTheme ? 'bg-[#F5F7FB] text-[#111827]' : 'bg-[#1A1A1A] text-white'}`}>
      <div className={`border-b p-4 ${isLightTheme ? 'border-slate-200' : 'border-gray-800'}`}>
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-2 mb-4 ${isLightTheme ? 'text-slate-600 hover:text-[#111827]' : 'text-gray-400 hover:text-white'}`}
        >
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className={`text-sm mt-2 max-w-2xl ${isLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>
          {description}
        </p>
      </div>

      <div className="p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className={`rounded-2xl border p-5 ${isLightTheme ? 'bg-white border-slate-200' : 'bg-[#242424] border-gray-800'}`}>
            <h2 className="text-lg font-semibold">Current State</h2>
            <p className={`mt-3 text-sm ${isLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>
              {statusCopy[status]}
            </p>
            {implementation && (
              <p className={`mt-3 text-sm ${isLightTheme ? 'text-slate-600' : 'text-gray-400'}`}>
                Current implementation: {implementation}
              </p>
            )}
            {notes.length > 0 && (
              <div className="mt-4 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      isLightTheme
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-[#1A1A1A] border-gray-800 text-gray-300'
                    }`}
                  >
                    {note}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-2xl border p-5 ${isLightTheme ? 'bg-white border-slate-200' : 'bg-[#242424] border-gray-800'}`}>
            <h2 className="text-lg font-semibold">Next Action</h2>
            <div className="mt-4 space-y-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    action.variant === 'secondary'
                      ? isLightTheme
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-[#1A1A1A] text-white hover:bg-[#2A2A2A]'
                      : 'bg-[#BFFF00] text-black hover:bg-[#a8e600]'
                  }`}
                >
                  {action.label}
                </button>
              ))}
              {!actions.length && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full rounded-xl bg-[#BFFF00] px-4 py-3 text-sm font-semibold text-black hover:bg-[#a8e600] transition-colors"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
