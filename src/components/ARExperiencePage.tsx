import React, { useState, useEffect } from 'react';
import { Plant } from '../types';
import { PLANTS, getPlantById, getARAvailablePlants } from '../data/plants';
import { Plant3DViewer } from './Plant3DViewer';
import { PlantImage } from './PlantImage';
import {
  Box,
  Layers,
  BookOpen,
  Sparkles,
  Camera,
  ChevronRight,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

interface ARExperiencePageProps {
  initialSelectedPlantId?: string;
  onSelectPlant: (plantId: string) => void;
}

export const ARExperiencePage: React.FC<ARExperiencePageProps> = ({
  initialSelectedPlantId,
  onSelectPlant,
}) => {
  const selectedPlants = getARAvailablePlants();
  
  const [activePlantId, setActivePlantId] = useState<string>(() => {
    return initialSelectedPlantId && selectedPlants.some(p => p.id === initialSelectedPlantId)
      ? initialSelectedPlantId
      : (selectedPlants[0]?.id || '');
  });

  const [isARActive, setIsARActive] = useState<boolean>(false); // Default to 3D museum
  const [webXRSupported, setWebXRSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if ('xr' in navigator && (navigator as any).xr?.isSessionSupported) {
      (navigator as any).xr
        .isSessionSupported('immersive-ar')
        .then((supported: boolean) => {
          setWebXRSupported(supported);
        })
        .catch(() => setWebXRSupported(false));
    } else {
      setWebXRSupported(false);
    }
  }, []);

  const activePlant = getPlantById(activePlantId) || selectedPlants[0];

  const handleSelectActivePlant = (id: string) => {
    setActivePlantId(id);
    setIsARActive(false); // Reset to 3D view when switching plants
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#0B142B]">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B142B] text-[#00E5FF] text-xs font-semibold border border-[#00E5FF]/30">
            <Camera className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Augmented Reality Spatial Viewport</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC]">
            Botanical AR Experience
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] max-w-2xl">
            Place realistic 3D medicinal plant specimens directly into your physical room, table, or garden using your camera feed. Move, rotate, and scale virtual flora in real time.
          </p>
        </div>

        {/* Selected Count & Add Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-2xl bg-[#0B142B] border border-[#00E5FF]/30 text-xs font-bold text-[#00E5FF] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#10B981]" />
            <span id="ar-selection-counter">Available AR Specimens: {selectedPlants.length}</span>
          </div>
        </div>
      </div>

      {/* Mode Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0B142B]/80 border border-[#00E5FF]/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsARActive(true)}
            disabled={webXRSupported === false}
            id="switch-ar-mode-btn"
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              isARActive
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] shadow-md glow-cyan'
                : webXRSupported === false
                ? 'bg-[#060B18]/50 text-[#94A3B8]/50 border border-gray-700 cursor-not-allowed'
                : 'bg-[#060B18] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#00E5FF]/20'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{webXRSupported === false ? 'AR Not Supported Here' : 'Live Camera AR View'}</span>
          </button>

          <button
            onClick={() => setIsARActive(false)}
            id="switch-3d-mode-btn"
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              !isARActive
                ? 'bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] shadow-md glow-cyan'
                : 'bg-[#060B18] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#00E5FF]/20'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>3D Studio Viewer</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
          <Smartphone className="w-4 h-4 text-[#00E5FF]" />
          <span>Point device camera at any flat surface or desk</span>
        </div>
      </div>

      {/* Selected Plants Thumbnail Strip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="font-semibold text-[#F8FAFC] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>AR Specimens</span>
          </span>
          <span>Click thumbnail to activate specimen</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {selectedPlants.map((plant) => {
            const isActive = activePlant.id === plant.id;
            return (
              <div
                key={plant.id}
                className={`relative group rounded-2xl p-3 border transition-all cursor-pointer flex items-center gap-3 ${
                  isActive
                    ? 'bg-[#0B142B] border-[#00E5FF] shadow-lg ring-1 ring-[#00E5FF] glow-cyan'
                    : 'bg-[#060B18] border-[#00E5FF]/20 hover:border-[#00E5FF]/60'
                }`}
                onClick={() => handleSelectActivePlant(plant.id)}
                id={`thumbnail-select-${plant.id}`}
              >
                {/* Thumbnail Image */}
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#00E5FF]/30 bg-[#060B18] relative">
                  <PlantImage
                    src={plant.image}
                    alt={plant.name}
                    plantName={plant.name}
                    category={plant.category}
                    className="w-full h-full object-cover"
                  />
                  {isActive && (
                    <div className="absolute inset-0 bg-[#00E5FF]/20 backdrop-blur-[1px]" />
                  )}
                </div>

                {/* Info Text */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[#F8FAFC] truncate">{plant.name}</h4>
                  <p className="text-[10px] italic text-[#00E5FF] truncate">{plant.scientificName}</p>
                  <p className="text-[9px] text-[#94A3B8] truncate">{plant.category}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main AR Viewport & Plant Info Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Interactive 3D / Camera AR Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <Plant3DViewer
            plant={activePlant}
            arMode={isARActive}
            onExitAR={() => setIsARActive(false)}
            onSelectPlantDetail={onSelectPlant}
          />
        </div>

        {/* Right Column: Specimen Information Card (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-6 sm:p-8 rounded-3xl border border-[#00E5FF]/25 space-y-6 shadow-2xl bg-[#0B142B]">
          
          {/* Plant Badges & Names */}
          <div className="space-y-3 pb-4 border-b border-[#060B18]">
            <div className="flex items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-full bg-[#060B18] text-[#10B981] text-[11px] font-bold border border-[#10B981]/30">
                {activePlant.category} Specimen
              </span>
              <span className="text-base font-serif font-bold text-[#F59E0B]">
                {activePlant.malayalamName}
              </span>
            </div>

            <div>
              <h2 className="font-serif text-3xl font-bold text-[#F8FAFC]">
                {activePlant.name}
              </h2>
              <p className="text-sm italic text-[#00E5FF] font-medium pt-0.5">
                {activePlant.scientificName}
              </p>
              <p className="text-xs text-[#94A3B8] pt-0.5">
                Family: <strong className="text-[#F8FAFC]">{activePlant.family}</strong>
              </p>
            </div>
          </div>

          {/* Short Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
              Botanical Overview & Uses
            </h4>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              {activePlant.description}
            </p>
          </div>

          {/* Plant Parts Used */}
          {activePlant.plantPartsTraditionallyUsed && (
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
                Traditionally Used Parts
              </h4>
              <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                {activePlant.plantPartsTraditionallyUsed}
              </p>
            </div>
          )}

          {/* Key Actions */}
          <div className="pt-4 space-y-3 border-t border-[#060B18]">
            {/* Toggle AR View Button */}
            <button
              onClick={() => {
                 if (webXRSupported !== false) {
                     setIsARActive(!isARActive);
                 }
              }}
              disabled={webXRSupported === false && !isARActive}
              id="ar-toggle-viewport-btn"
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                isARActive
                   ? 'bg-gradient-to-r from-[#00E5FF] via-[#00B4D8] to-[#10B981] text-[#060B18] hover:brightness-110 glow-cyan'
                   : webXRSupported === false
                   ? 'bg-[#060B18]/50 text-[#94A3B8]/50 border border-gray-700 cursor-not-allowed'
                   : 'bg-gradient-to-r from-[#00E5FF] via-[#00B4D8] to-[#10B981] text-[#060B18] hover:brightness-110 glow-cyan'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{isARActive ? 'Switch to 3D Museum Mode' : webXRSupported === false ? 'AR Not Supported on this Device' : 'Activate Live AR Camera'}</span>
            </button>

            {/* Plant Information Button */}
            <button
              onClick={() => onSelectPlant(activePlant.id)}
              id="plant-info-full-btn"
              className="w-full py-3.5 px-4 rounded-2xl bg-[#060B18] hover:bg-[#00E5FF]/10 text-[#F8FAFC] border border-[#00E5FF]/30 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-[#00E5FF]" />
              <span>Full Plant Information</span>
              <ChevronRight className="w-4 h-4 text-[#10B981]" />
            </button>
          </div>

          {/* Technical Quality Badge */}
          <div className="p-3 rounded-xl bg-[#060B18] border border-[#00E5FF]/20 text-[11px] text-[#94A3B8] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00E5FF] shrink-0" />
            <span>Botanical specimen digital twin verified against classical identification records.</span>
          </div>

        </div>

      </div>

    </div>
  );
};
