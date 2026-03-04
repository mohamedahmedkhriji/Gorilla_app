import React from 'react';
import logoImage from '../../../assets/logo app .png';

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  alt?: string;
  withFilter?: boolean;
  backgroundClassName?: string;
}

export function BrandLogo({
  className = '',
  imageClassName = 'object-cover',
  alt = 'RepSet Logo',
  withFilter = false,
  backgroundClassName = 'bg-transparent',
}: BrandLogoProps) {
  return (
    <div className={`relative w-full h-full overflow-hidden ${backgroundClassName} ${className}`.trim()}>
      <img
        src={logoImage}
        alt={alt}
        className={`w-full h-full ${imageClassName}`.trim()}
        style={withFilter ? { filter: 'grayscale(100%) contrast(120%)' } : undefined}
      />
      {withFilter && <div className="absolute inset-0 bg-accent mix-blend-multiply" />}
    </div>
  );
}
