import React from 'react';
import { Plant } from '../types';
import { useI18n } from '../i18n';
import { PlantImage } from './PlantImage';
import { ArrowLeft, MessageSquareCode, Eye, ShieldAlert, CheckCircle2, MapPin, BookOpen, Sparkles, Flower2, HeartPulse, QrCode } from 'lucide-react';

interface PlantDetailPageProps {
  plant: Plant;
  onBack: () => void;
  onNavigateToAskWithQuestion: (question: string) => void;
  onNavigateToARWithPlant: (plantId: string) => void;
  onNavigateToScan: () => void;
}

export const PlantDetailPage: React.FC<PlantDetailPageProps> = ({
  plant: rawPlant,
  onBack,
  onNavigateToAskWithQuestion,
  onNavigateToARWithPlant,
  onNavigateToScan,
}) => {
  const { t, localizePlant } = useI18n();
  const plant = localizePlant(rawPlant);
  const catLabel = t(`categories.${rawPlant.category}`);
  const displayCat = catLabel !== `categories.${rawPlant.category}` ? catLabel : plant.category;
  const arabicName = rawPlant.translations?.ar?.name;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300 text-start">
      {/* Back Button */}
      <button
        onClick={onBack}
        id="back-to-plants-btn"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B142B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#00E5FF]/30 text-xs font-semibold transition-all"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        <span>{t('detail.backToDirectory')}</span>
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B142B] via-transparent to-transparent opacity-90" />

          <div className="absolute top-4 start-4 flex flex-col gap-2">
            <span className="px-3 py-1 rounded-full bg-[#060B18]/85 backdrop-blur-md text-xs font-bold text-[#00E5FF] border border-[#00E5FF]/30">
              {t('detail.categoryPrefix')} {displayCat}
            </span>
            {plant.arAvailable && (
              <span className="px-3 py-1 rounded-full bg-[#10B981]/20 backdrop-blur-md text-xs font-bold text-[#10B981] border border-[#10B981]/40 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>{t('detail.modelAvailable')}</span>
              </span>
            )}
          </div>
        </div>

        {/* Plant Overview Details */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-[#0B142B]">
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#00E5FF]">
                  {t('detail.botanicalSpec')}
                </span>
                <div className="flex flex-wrap items-center gap-3 text-sm font-serif font-bold text-[#F59E0B]">
                  <span>
                    {t('detail.malayalamPrefix')} <span lang="ml">{rawPlant.malayalamName}</span>
                  </span>
                  {arabicName && (
                    <span>
                      • {t('detail.arabicPrefix')} <span lang="ar" dir="rtl">{arabicName}</span>
                    </span>
                  )}
                </div>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC] pt-1">
                {plant.name}
              </h1>
            </div>

            {/* Scientific & Vernacular Names */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-y border-[#060B18] py-2.5">
              <span className="italic text-[#00E5FF] font-medium">
                <bdi dir="ltr">{plant.scientificName}</bdi>
              </span>
              <span className="text-[#94A3B8]">•</span>
              <span className="text-[#94A3B8]">
                {t('detail.familyPrefix')} <strong className="text-[#F8FAFC]"><bdi dir="ltr">{plant.family}</bdi></strong>
              </span>
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed">
              <strong className="text-[#F8FAFC] block mb-1">{t('detail.aboutPlant')}</strong>
              {plant.description}
            </p>
          </div>

          {/* Plant Parts Used */}
          {plant.plantPartsTraditionallyUsed && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5">
                <Flower2 className="w-4 h-4 text-[#10B981]" />
                <span>{t('detail.partsUsedTitle')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {plant.plantPartsTraditionallyUsed.split(/[,،]\s*|\s+and\s+|\s+و/i).map((part, i) => {
                  const cleanPart = part.trim().replace(/[.\u06D4]$/, '');
                  if (!cleanPart) return null;
                  return (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg bg-[#060B18] text-xs font-medium text-[#10B981] border border-[#10B981]/30"
                    >
                      ✓ {cleanPart}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive CTA Buttons */}
          <div className="pt-2 flex flex-col xl:flex-row flex-wrap gap-3">
            <button
              onClick={() => onNavigateToAskWithQuestion(t('detail.askPromptTemplate', { name: plant.name }))}
              id="detail-ask-herbiq-btn"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md glow-cyan"
            >
              <MessageSquareCode className="w-4 h-4" />
              <span>{t('detail.askAboutPlant')}</span>
            </button>

            <button
              disabled={!plant.arAvailable}
              onClick={() => onNavigateToARWithPlant(plant.id)}
              id="detail-view-ar-btn"
              className="py-3 px-4 rounded-xl bg-[#060B18] hover:bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 text-xs font-bold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none"
            >
              <Eye className="w-4 h-4" />
              <span>{plant.arAvailable ? t('detail.open3dAr') : t('detail.modelUnavailable')}</span>
            </button>

            <button
              onClick={onNavigateToScan}
              id="detail-scan-qr-btn"
              className="py-3 px-4 rounded-xl bg-[#060B18] hover:bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-xs font-bold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none"
            >
              <QrCode className="w-4 h-4" />
              <span>{t('detail.scanQr')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Detailed Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traditional Knowledge & Usage */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-[#00E5FF]/20 bg-[#0B142B] flex flex-col">
          <div className="flex items-center gap-2.5 text-[#10B981]">
            <BookOpen className="w-5 h-5 shrink-0" />
            <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">{t('detail.traditionalKnowledgeTitle')}</h3>
          </div>

          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl bg-[#060B18] border border-[#10B981]/20">
              <span className="font-bold text-[#10B981] block mb-1">{t('detail.traditionalUses')}</span>
              <p className="text-[#94A3B8] text-sm leading-relaxed">{plant.traditionalUses}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#060B18] border border-[#00E5FF]/20">
              <span className="font-bold text-[#00E5FF] block mb-1">{t('detail.medicinalBenefits')}</span>
              <p className="text-[#94A3B8] text-sm leading-relaxed">{plant.medicinalBenefits}</p>
            </div>

            <div className="p-4 rounded-xl bg-[#060B18] border border-[#F59E0B]/20">
              <span className="font-bold text-[#F59E0B] block mb-1">{t('detail.howTraditionallyUsed')}</span>
              <p className="text-[#94A3B8] text-sm leading-relaxed">{plant.traditionalUsage}</p>
            </div>
          </div>

          {plant.culturalImportance && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[#060B18] to-[#0B142B] border border-[#94A3B8]/30">
              <span className="font-bold text-[#F8FAFC] block mb-1">{t('detail.culturalImportance')}</span>
              <p className="text-[#94A3B8] text-sm leading-relaxed">{plant.culturalImportance}</p>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-[#060B18] flex items-center gap-2 text-xs text-[#10B981]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{t('detail.rootedInAyurveda')}</span>
          </div>
        </div>

        <div className="space-y-6 flex flex-col">
          {/* Identification Markers */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 border border-[#00E5FF]/20 bg-[#0B142B]">
            <div className="flex items-center gap-2.5 text-[#00E5FF]">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-xl font-bold text-[#F8FAFC]">{t('detail.identificationTitle')}</h3>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              {plant.identification}
            </p>
          </div>

          {/* Plant Health & Disease Information */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 border border-[#F59E0B]/30 bg-[#0B142B] flex-1">
            <div className="flex items-center gap-2.5 text-[#F59E0B]">
              <HeartPulse className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-xl font-bold text-[#F8FAFC]">{t('detail.healthTitle')}</h3>
            </div>
            <div className="space-y-3 text-sm text-[#94A3B8]">
              <div>
                <strong className="text-[#F8FAFC] block mb-0.5">{t('detail.healthIssues')}</strong>
                <p>{plant.health.issues}</p>
              </div>
              <div>
                <strong className="text-[#F8FAFC] block mb-0.5">{t('detail.healthSymptoms')}</strong>
                <p>{plant.health.symptoms}</p>
              </div>
              <div>
                <strong className="text-[#10B981] block mb-0.5">{t('detail.healthPrevention')}</strong>
                <p>{plant.health.prevention}</p>
              </div>
            </div>
          </div>

          {/* Habitat & Distribution */}
          <div className="glass-panel p-6 rounded-2xl space-y-3 border border-[#00E5FF]/20 bg-[#0B142B]">
            <div className="flex items-center gap-2.5 text-[#00E5FF]">
              <MapPin className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-xl font-bold text-[#F8FAFC]">{t('detail.habitatTitle')}</h3>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              {plant.habitat}
            </p>
          </div>
        </div>
      </div>

      {/* Educational & Safety Disclaimer */}
      <div className="p-6 rounded-2xl bg-[#0B142B] border border-[#F59E0B]/30 flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <ShieldAlert className="w-8 h-8 text-[#F59E0B] shrink-0 mt-1" />
        <div>
          <h3 className="font-bold text-[#F8FAFC] text-sm mb-1">{t('detail.disclaimerTitle')}</h3>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            {t('detail.disclaimerBody')}
          </p>
        </div>
      </div>
    </div>
  );
};
