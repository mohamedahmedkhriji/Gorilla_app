import React from 'react';

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
          <div className="login-speed-scene mx-auto" role="img" aria-label={title}>
            <div className="login-speed-clouds">
              <div className="login-speed-cloud login-speed-cloud-1" />
              <div className="login-speed-cloud login-speed-cloud-2" />
              <div className="login-speed-cloud login-speed-cloud-3" />
              <div className="login-speed-cloud login-speed-cloud-4" />
              <div className="login-speed-cloud login-speed-cloud-5" />
            </div>

            <div className="login-speed-loader">
              <span>
                <span />
                <span />
                <span />
                <span />
              </span>
              <div className="login-speed-base">
                <span />
                <div className="login-speed-face" />
              </div>
            </div>

            <div className="login-speed-lines">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <h2 className="mt-5 font-brand text-[2rem] leading-none text-white">RepSet</h2>
          <p className="mt-3 font-marker text-2xl text-accent">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
