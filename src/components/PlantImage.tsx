import React, { useState } from 'react';
import { Leaf } from 'lucide-react';

interface PlantImageProps {
  src: string;
  alt: string;
  className?: string;
  plantName?: string;
  category?: string;
}

// Map of high quality fallback unsplash botanical images by plant id / category keyword
const FALLBACK_MAP: Record<string, string> = {
  tulsi: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=800',
  neem: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800',
  'aloe-vera': 'https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?auto=format&fit=crop&q=80&w=800',
  turmeric: 'https://images.unsplash.com/photo-1615485290130-3c22a36b5665?auto=format&fit=crop&q=80&w=800',
  ginger: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=800',
  amla: 'https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&q=80&w=800',
  ashwagandha: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
  hibiscus: 'https://images.unsplash.com/photo-1550950158-d0d960dff51b?auto=format&fit=crop&q=80&w=800',
  mint: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?auto=format&fit=crop&q=80&w=800',
  coriander: 'https://images.unsplash.com/photo-1588879460618-9249e7d947d1?auto=format&fit=crop&q=80&w=800',
  moringa: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=800',
  'curry-leaf': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=800',
};

const CATEGORY_DEFAULT: Record<string, string> = {
  Herb: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=800',
  Tree: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=800',
  Succulent: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=800',
  Shrub: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800',
  Grass: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800',
  Climber: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=800',
  Spice: 'https://images.unsplash.com/photo-1615485290130-3c22a36b5665?auto=format&fit=crop&q=80&w=800',
};

export const PlantImage: React.FC<PlantImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  plantName,
  category = 'Herb',
}) => {
  const [errorStep, setErrorStep] = useState<number>(0);

  const plantIdKey = alt.toLowerCase().replace(/\s+/g, '-');
  
  const getFallbackUrl = () => {
    if (FALLBACK_MAP[plantIdKey]) {
      return FALLBACK_MAP[plantIdKey];
    }
    return CATEGORY_DEFAULT[category] || 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=800';
  };

  const currentSrc = errorStep === 0 ? src : getFallbackUrl();

  const handleError = () => {
    if (errorStep === 0) {
      setErrorStep(1);
    } else {
      setErrorStep(2); // Fallback to styled SVG placeholder
    }
  };

  if (errorStep === 2) {
    return (
      <div className={`bg-gradient-to-br from-[#0D2119] via-[#071410] to-[#0D2119] flex flex-col items-center justify-center p-4 text-center border border-[#45D483]/20 ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-[#45D483]/10 border border-[#45D483]/30 flex items-center justify-center mb-2 text-[#45D483]">
          <Leaf className="w-6 h-6" />
        </div>
        <span className="font-serif text-sm font-bold text-[#F2F7F4]">{plantName || alt}</span>
        <span className="text-[10px] text-[#45D483] font-mono mt-0.5">{category} Specimen</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      className={className}
      loading="lazy"
    />
  );
};
