import React from 'react';
import loadingLoginGif from '../../../assets/laodainglogin.gif';

interface LoginTransitionOverlayProps {
  title: string;
  subtitle: string;
}

export function LoginTransitionOverlay({ title, subtitle }: LoginTransitionOverlayProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05070d]/78 px-4 backdrop-blur-md">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(22,32,46,0.96),rgba(10,15,24,0.98))] p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(187,255,92,0.18),transparent_55%)]" />
        <div className="relative">
          <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/30 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <img
              src={loadingLoginGif}
              alt={title}
              className="h-full w-full rounded-[1.25rem] object-cover"
            />
          </div>

          <h2 className="mt-5 font-brand text-[2rem] leading-none text-white">RepSet</h2>
          <p className="mt-3 font-marker text-2xl text-accent">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
