import React from 'react';

export default function PostSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-card/90 p-4 shadow-[0_20px_50px_rgb(5_10_20/0.12)]">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/5" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/5" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-white/10" />
        <div className="h-3.5 w-3/5 animate-pulse rounded-full bg-white/5" />
      </div>

      <div className="mt-4 aspect-[4/5] animate-pulse rounded-[20px] bg-white/10" />

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          ))}
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/5" />
      </div>

      <div className="mt-4 flex gap-3">
        <div className="h-3 w-16 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-20 animate-pulse rounded-full bg-white/5" />
      </div>
    </div>
  );
}
