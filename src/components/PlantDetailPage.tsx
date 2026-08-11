import React from 'react';
import { Plant } from '../types';
import { PlantImage } from './PlantImage';
import { ArrowLeft, MessageSquareCode, Eye, ShieldAlert, CheckCircle2, MapPin, BookOpen, Sparkles, Flower2, Sprout, Globe, Layers } from 'lucide-react';
import { AR_CONFIG_PLANT_IDS } from '../data/plants';

interface PlantDetailPageProps {
  plant: Plant;
  onBack: () => void;
  onNavigateToAskWithQuestion: (question: string) => void;
  onNavigateToARWithPlant: (plantId: string) => void;
}

export const PlantDetailPage: React.FC<PlantDetailPageProps> = ({
  plant,
  onBack,
  onNavigateToAskWithQuestion,
  onNavigateToARWithPlant,
}) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Back Button */}
      <button
        onClick={onBack}
        id="back-to-plants-btn"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B142B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#00E5FF]/30 text-xs font-semibold transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Plant Directory</span>
      </button>

      {/* Main Header Banner Card */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-[#00E5FF]/30 grid grid-cols-1 md:grid-cols-12 gap-0 shadow-2xl bg-[#0B142B]">
        
        {/* Large Plant Image */}
        <div className="md:col-span-5 relative min-h-[300px] md:min-h-[440px] bg-[#060B18]">
          <PlantImage
            src={plant.image}
            alt={plant.name}
            plantName={plant.name}
            category={plant.category}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B142B] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#0B142B] opacity-90" />
          
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span className="px-3 py-1 rounded-full bg-[#060B18]/85 backdrop-blur-md text-xs font-bold text-[#00E5FF] border border-[#00E5FF]/30">
              Category: {plant.category}
            </span>
            {AR_CONFIG_PLANT_IDS.includes(plant.id) && (
              <span className="px-3 py-1 rounded-full bg-[#10B981]/20 backdrop-blur-md text-xs font-bold text-[#10B981] border border-[#10B981]/40 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>AR Projection Ready</span>
              </span>
            )}
          </div>
        </div>

        {/* Plant Overview Details */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#0B142B]">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#00E5FF]">
                  Botanical Specification
                </span>
                <span className="text-sm font-serif font-bold text-[#F59E0B]">
                  Malayalam: {plant.malayalamName}
                </span>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC] pt-1">
                {plant.name}
              </h1>
            </div>

            {/* Scientific & Vernacular Names */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-y border-[#060B18] py-2.5">
              <span className="italic text-[#00E5FF] font-medium">
                {plant.scientificName}
              </span>
              <span className="text-[#94A3B8]">•</span>
              <span className="text-[#94A3B8]">
                Family: <strong className="text-[#F8FAFC]">{plant.family}</strong>
              </span>
              {plant.alternateNames && plant.alternateNames.length > 0 && (
                <>
                  <span className="text-[#94A3B8]">•</span>
                  <span className="text-[#94A3B8]">
                    Also known as: <span className="text-[#F8FAFC]">{plant.alternateNames.join(', ')}</span>
                  </span>
                </>
              )}
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed">
              {plant.description || plant.shortDescription}
            </p>
          </div>

          {/* Plant Parts Used */}
          {plant.plantPartsTraditionallyUsed && plant.plantPartsTraditionallyUsed.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5">
                <Flower2 className="w-4 h-4 text-[#10B981]" />
                <span>Traditionally Utilized Plant Parts</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {plant.plantPartsTraditionallyUsed.map((part, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg bg-[#060B18] text-xs font-medium text-[#10B981] border border-[#10B981]/30"
                  >
                    ✓ {part}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Interactive CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigateToAskWithQuestion(`Tell me about ${plant.name} and its traditional uses.`)}
              id="detail-ask-herbiq-btn"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md glow-cyan"
            >
              <MessageSquareCode className="w-4 h-4" />
              <span>Ask HerbiQ About This Plant</span>
            </button>

            <button
              onClick={() => onNavigateToARWithPlant(plant.id)}
              id="detail-view-ar-btn"
              className="py-3 px-4 rounded-xl bg-[#060B18] hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              <span>{plant.arAvailable ? 'View in AR Projections' : 'Select for AR Experience'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Grid of Detailed Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Identification Markers */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-[#00E5FF]/20 bg-[#0B142B]">
          <div className="flex items-center gap-2.5 text-[#00E5FF]">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">Botanical Identification</h3>
          </div>
          <p className="text-xs text-[#94A3B8]">
            Morphological identification features to observe during your garden visit:
          </p>
          <div className="space-y-3 pt-1 text-xs">
            {plant.identification.leaves && (
              <div className="p-3 rounded-xl bg-[#060B18] border border-[#00E5FF]/20">
                <span className="font-bold text-[#00E5FF] block mb-0.5">Leaves:</span>
                <p className="text-[#F8FAFC] leading-relaxed">{plant.identification.leaves}</p>
              </div>
            )}
            {plant.identification.flowers && (
              <div className="p-3 rounded-xl bg-[#060B18] border border-[#00E5FF]/20">
                <span className="font-bold text-[#10B981] block mb-0.5">Flowers:</span>
                <p className="text-[#F8FAFC] leading-relaxed">{plant.identification.flowers}</p>
              </div>
            )}
            {plant.identification.fruit && (
              <div className="p-3 rounded-xl bg-[#060B18] border border-[#00E5FF]/20">
                <span className="font-bold text-[#F59E0B] block mb-0.5">Fruit / Seeds:</span>
                <p className="text-[#F8FAFC] leading-relaxed">{plant.identification.fruit}</p>
              </div>
            )}
            {plant.identification.stem && (
              <div className="p-3 rounded-xl bg-[#060B18] border border-[#00E5FF]/20">
                <span className="font-bold text-[#94A3B8] block mb-0.5">Stem / Bark:</span>
                <p className="text-[#F8FAFC] leading-relaxed">{plant.identification.stem}</p>
              </div>
            )}
          </div>
        </div>

        {/* Traditional Knowledge */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-[#00E5FF]/20 bg-[#0B142B] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-[#10B981]">
              <BookOpen className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">Traditional Knowledge</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              {plant.traditionalKnowledge}
            </p>
          </div>

          <div className="pt-3 border-t border-[#060B18] flex items-center gap-2 text-xs text-[#F59E0B]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Documented in Classical Ayurvedic Literature (Dravyaguna Shastra).</span>
          </div>
        </div>

        {/* Habitat & Distribution */}
        <div className="glass-panel p-6 rounded-2xl space-y-3 border border-[#00E5FF]/20 bg-[#0B142B]">
          <div className="flex items-center gap-2.5 text-[#F59E0B]">
            <MapPin className="w-5 h-5 shrink-0" />
            <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">Habitat & Geography</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[#94A3B8] block">Native / Common Region:</span>
              <p className="text-[#F8FAFC] font-medium">{plant.nativeOrCommonRegion}</p>
            </div>
            <div>
              <span className="text-[#94A3B8] block">Environmental Habitat:</span>
              <p className="text-[#94A3B8] leading-relaxed">{plant.habitat}</p>
            </div>
          </div>
        </div>

        {/* Cultivation Notes */}
        <div className="glass-panel p-6 rounded-2xl space-y-3 border border-[#00E5FF]/20 bg-[#0B142B]">
          <div className="flex items-center gap-2.5 text-[#10B981]">
            <Sprout className="w-5 h-5 shrink-0" />
            <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">Garden Cultivation</h3>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {plant.cultivation}
          </p>
        </div>

      </div>

      {/* Safety & Precautions Disclaimer */}
      <div className="p-6 rounded-2xl bg-[#0B142B] border border-[#F59E0B]/30 space-y-3">
        <div className="flex items-center gap-2.5 text-[#F59E0B]">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">Safety & Educational Disclaimer</h3>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          {plant.safety}
        </p>
        <p className="text-[11px] text-[#94A3B8]/70 italic pt-1 border-t border-[#060B18]">
          Educational Note: HerbiQ provides botanical and traditional information for educational learning only. Content is strictly for educational exploration and must not be used for self-medication, diagnosis, or clinical treatment.
        </p>
      </div>

    </div>
  );
};
