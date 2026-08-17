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
          <div className="login-weight-loader mx-auto" role="img" aria-label={title}>
            <svg
              className="login-weight-scene"
              viewBox="0 0 800 600"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <g id="login-dumbbell-shape" className="login-dumbbell-art">
                  <path d="M-42-14H42V14H-42Z" />
                  <path d="M-68-29H-48L-38-19V19L-48 29H-68L-78 19V-19Z" />
                  <path d="M68-29H48L38-19V19L48 29H68L78 19V-19Z" />
                  <path d="M-78-19H-48M-78 19H-48M48-19H78M48 19H78" />
                </g>
              </defs>

              {[205, 305, 405, 505, 605].map((x, index) => (
                <g key={x} transform={`translate(${x} 300) rotate(-90) scale(0.92)`}>
                  <g className={`login-weight-fall login-weight-d${index + 1}`}>
                    <use href="#login-dumbbell-shape" />
                  </g>
                </g>
              ))}
            </svg>
          </div>

          <h2 className="mt-5 font-brand text-[2rem] leading-none text-white">RepSet</h2>
          <p className="mt-3 font-marker text-2xl text-accent">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
