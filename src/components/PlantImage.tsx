import React, { useState, useEffect } from 'react';
import { Leaf } from 'lucide-react';
import { useI18n } from '../i18n';

interface PlantImageProps { src: string; alt: string; className?: string; plantName?: string; category?: string; }

export const PlantImage: React.FC<PlantImageProps> = ({src, alt, className = 'w-full h-full object-cover', plantName}) => {
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();
  useEffect(() => setFailed(false), [src]);
  return failed ? (
    <div role="img" aria-label={`${alt}: ${t('app.photoUnavailable')}`} className={`bg-[#0B142B] flex flex-col items-center justify-center p-4 text-center ${className}`}>
      <Leaf className="w-8 h-8 text-emerald-400 mb-2" aria-hidden="true" />
      <span>{plantName || alt}</span>
      <span className="text-sm text-slate-400">{t('app.photoUnavailable')}</span>
    </div>
  ) : (
    <img src={src} alt={alt} onError={() => setFailed(true)} className={className} loading="lazy" decoding="async" />
  );
};
