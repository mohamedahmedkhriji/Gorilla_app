import React from 'react';

type FeedPageProps = {
  header: React.ReactNode;
  filters: React.ReactNode;
  error?: string;
  children: React.ReactNode;
};

export default function FeedPage({ header, filters, error, children }: FeedPageProps) {
  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 pb-10 pt-4 sm:px-6">
      <div className="relative space-y-5">
        {header}
        {filters}
        {error ? (
          <div className="rounded-[20px] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
