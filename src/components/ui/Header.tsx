import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
interface HeaderProps {
  title?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}
export function Header({ title, onBack, rightElement }: HeaderProps) {
  return (
    <div className="flex items-center justify-between py-4 mb-6">
      <div className="flex items-center gap-4">
        {onBack &&
        <motion.button
          whileTap={{
            scale: 0.9
          }}
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-text-primary hover:bg-white/10 transition-colors">

            <ArrowLeft size={20} />
          </motion.button>
        }
        {title &&
        <h1 className="text-lg font-medium text-text-primary">{title}</h1>
        }
      </div>
      {rightElement}
    </div>);

}