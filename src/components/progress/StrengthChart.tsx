import React from 'react';
import { Card } from '../ui/Card';
export function StrengthChart() {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-lg font-medium text-white">Strength Progress</h3>
          <p className="text-xs text-text-secondary">Estimated 1RM Average</p>
        </div>
        <div className="text-2xl font-bold text-accent">+12%</div>
      </div>

      {/* Simple SVG Chart */}
      <div className="h-40 w-full relative">
        <svg
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100">

          {/* Grid lines */}
          <line
            x1="0"
            y1="0"
            x2="100"
            y2="0"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1" />

          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1" />

          <line
            x1="0"
            y1="100"
            x2="100"
            y2="100"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1" />


          {/* Line */}
          <path
            d="M0,80 C20,75 40,60 60,50 S80,20 100,10"
            fill="none"
            stroke="#0A84FF"
            strokeWidth="3"
            strokeLinecap="round" />


          {/* Area under curve */}
          <path
            d="M0,80 C20,75 40,60 60,50 S80,20 100,10 V100 H0 Z"
            fill="url(#gradient)"
            opacity="0.2" />


          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0A84FF" />
              <stop offset="100%" stopColor="#0A84FF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex justify-between text-xs text-text-tertiary mt-4">
        <span>Week 1</span>
        <span>Week 4</span>
        <span>Week 8</span>
      </div>
    </Card>);

}