import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppLanguage } from '../../hooks/useAppLanguage';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  compact?: boolean;
  titleClassName?: string;
  backButtonCoachmarkTargetId?: string;
  titleCoachmarkTargetId?: string;
}

const readHeaderStyleGender = () => {
  try {
    return String(localStorage.getItem('appStyleGender') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const isGirlsHeaderStyle = (value: string) =>
  value === 'woman' || value === 'female' || value === 'f' || value === 'girls' || value === 'femme';

export function Header({
  title,
  onBack,
  rightElement,
  compact = false,
  titleClassName = '',
  backButtonCoachmarkTargetId,
  titleCoachmarkTargetId,
}: HeaderProps) {
  const { isArabic } = useAppLanguage();
  const [styleGender, setStyleGender] = useState(() => readHeaderStyleGender());

  useEffect(() => {
    const refreshStyleGender = () => setStyleGender(readHeaderStyleGender());
    window.addEventListener('repset:app-style-gender-changed', refreshStyleGender);
    window.addEventListener('repset:stored-user-changed', refreshStyleGender);
    window.addEventListener('storage', refreshStyleGender);
    return () => {
      window.removeEventListener('repset:app-style-gender-changed', refreshStyleGender);
      window.removeEventListener('repset:stored-user-changed', refreshStyleGender);
      window.removeEventListener('storage', refreshStyleGender);
    };
  }, []);

  const backButtonClassName = isGirlsHeaderStyle(styleGender)
    ? 'flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2B4BD]/55 bg-white/70 text-[#4A4A4A] backdrop-blur-md transition-colors hover:border-[#F9B2D7]/70'
    : 'w-10 h-10 rounded-xl surface-glass flex items-center justify-center text-text-primary hover:border-accent/40 transition-colors';

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className={`flex items-center justify-between ${compact ? 'py-2 mb-2' : 'py-4 mb-6'}`}
    >
      <div className={`flex items-center min-w-0 ${compact ? 'gap-3' : 'gap-4'}`}>
        {onBack && (
          <motion.button
            data-coachmark-target={backButtonCoachmarkTargetId}
            whileTap={{
              scale: 0.92,
            }}
            onClick={onBack}
            className={backButtonClassName}
          >
            <ArrowLeft size={18} className={isArabic ? 'rotate-180' : ''} />
          </motion.button>
        )}
        {title && (
          <h1
            data-coachmark-target={titleCoachmarkTargetId}
            className={`flex-1 text-xl leading-tight text-text-primary ${isArabic ? 'text-right' : ''} ${titleClassName}`}
          >
            {title}
          </h1>
        )}
      </div>
      {rightElement}
    </div>
  );
}
