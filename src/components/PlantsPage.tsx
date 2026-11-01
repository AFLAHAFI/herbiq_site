import React, { useState, useMemo } from 'react';
import { PLANTS, searchPlants } from '../data/plants';
import { useI18n } from '../i18n';
import { PlantImage } from './PlantImage';
import { Search, ChevronRight, Eye, Filter } from 'lucide-react';

interface PlantsPageProps {
  onSelectPlant: (plantId: string) => void;
  onNavigateToARWithPlant?: (plantId: string) => void;
}

export const PlantsPage: React.FC<PlantsPageProps> = ({ onSelectPlant }) => {
  const { t, lang, localizePlant } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(PLANTS.map((p) => p.category))).sort();
    return ['All', ...cats];
  }, [PLANTS]);

  const filteredPlants = useMemo(() => {
    return searchPlants(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory, PLANTS]);

  const getCategoryLabel = (cat: string) => {
    const translated = t(`categories.${cat}`);
    return translated !== `categories.${cat}` ? translated : cat;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-start">
      {/* Page Header */}
      <div className="space-y-3 text-center md:text-start">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B142B] border border-[#00E5FF]/30 text-xs font-semibold text-[#00E5FF]">
          <span>{t('plants.badge', { count: PLANTS.length })}</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC]">
          {t('plants.heading')}
        </h1>
        <p className="text-[#94A3B8] text-base max-w-2xl">
          {t('plants.subtitle')}
        </p>
      </div>

      {/* Search Bar & Category Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('plants.searchPlaceholder')}
            className="w-full ps-12 pe-14 py-3.5 rounded-2xl bg-[#0B142B] border border-[#00E5FF]/30 text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] text-sm transition-all"
            id="plant-search-input"
            aria-label={t('plants.searchAria')}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute end-4 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              {t('plants.clear')}
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs text-[#94A3B8] font-semibold flex items-center gap-1 shrink-0 pe-1">
            <Filter className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>{t('plants.categoryLabel')}</span>
          </span>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                id={`filter-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#00E5FF] text-[#060B18] shadow-md glow-cyan'
                    : 'bg-[#0B142B] text-[#94A3B8] border border-[#00E5FF]/20 hover:border-[#00E5FF]/40 hover:text-[#F8FAFC]'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Grid */}
      <div className="space-y-4">
        <div className="text-xs text-[#94A3B8] flex items-center justify-between">
          <span>
            {t('plants.showingCount', { shown: filteredPlants.length, total: PLANTS.length })}
          </span>
          {selectedCategory !== 'All' && (
            <span className="text-[#10B981]">
              {t('plants.filteredBy', { category: getCategoryLabel(selectedCategory) })}
            </span>
          )}
        </div>

        {filteredPlants.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-3 bg-[#0B142B]">
            <p className="text-base text-[#F8FAFC] font-medium">{t('plants.noResultsTitle')}</p>
            <p className="text-xs text-[#94A3B8]">{t('plants.noResultsBody')}</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-4 py-2 rounded-xl bg-[#00E5FF]/20 text-[#00E5FF] text-xs font-bold border border-[#00E5FF]/40 hover:bg-[#00E5FF]/30 transition-all"
            >
              {t('plants.resetFilters')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlants.map((rawPlant) => {
              const plant = localizePlant(rawPlant);
              const arabicName = rawPlant.translations?.ar?.name;
              return (
                <div
                  key={plant.id}
                  className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between group bg-[#0B142B] text-start"
                >
                  <div>
                    {/* Image Header */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#060B18]">
                      <PlantImage
                        src={plant.image}
                        alt={plant.name}
                        plantName={plant.name}
                        category={plant.category}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B142B] via-transparent to-transparent opacity-85" />

                      <div className="absolute top-3 start-3 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-[#060B18]/80 text-[10px] font-semibold text-[#00E5FF] border border-[#00E5FF]/30 backdrop-blur-sm">
                          {getCategoryLabel(rawPlant.category)}
                        </span>
                        {plant.arAvailable && (
                          <span className="px-2 py-1 rounded-full bg-[#10B981]/20 text-[10px] font-semibold text-[#10B981] border border-[#10B981]/30 backdrop-blur-sm flex items-center gap-1" dir="ltr">
                            <Eye className="w-3 h-3" />
                            <span>{t('home.arBadge')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Information */}
                    <div className="p-5 space-y-2">
                      <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-serif text-2xl font-bold text-[#F8FAFC] group-hover:text-[#00E5FF] transition-colors">
                            {plant.name}
                          </h3>
                          {lang === 'ar' ? (
                            <span className="text-xs font-semibold text-[#F59E0B] shrink-0" dir="ltr">
                              {rawPlant.name}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-[#F59E0B] shrink-0" lang="ml">
                              {rawPlant.malayalamName}
                            </span>
                          )}
                        </div>
                        {lang !== 'ar' && arabicName && (
                          <p className="text-xs text-[#10B981] font-medium" lang="ar" dir="rtl">
                            {arabicName}
                          </p>
                        )}
                        <p className="text-xs italic text-[#00E5FF] font-medium pt-0.5">
                          <bdi dir="ltr">{plant.scientificName}</bdi>
                        </p>
                        <p className="text-[11px] text-[#94A3B8] pt-0.5">
                          {t('plants.familyPrefix')} <bdi dir="ltr">{plant.family}</bdi>
                        </p>
                      </div>

                      <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed pt-1">
                        {plant.description}
                      </p>

                      {/* Traditionally Used Parts */}
                      {plant.plantPartsTraditionallyUsed && (
                        <div className="pt-2 flex flex-wrap gap-1">
                          <span className="text-[10px] text-[#94A3B8] font-semibold pe-1">{t('plants.partsPrefix')}</span>
                          {plant.plantPartsTraditionallyUsed.split(/[,،]\s*|\s+and\s+|\s+و/i).map((part, idx) => {
                            const cleanPart = part.trim().replace(/[.\u06D4]$/, '');
                            if (!cleanPart) return null;
                            return (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-[#060B18] text-[10px] text-[#10B981] border border-[#10B981]/20"
                              >
                                {cleanPart}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Learn More Button */}
                  <div className="p-5 pt-0">
                    <button
                      onClick={() => onSelectPlant(plant.id)}
                      id={`learn-more-btn-${plant.id}`}
                      className="w-full py-2.5 rounded-xl bg-[#060B18] hover:bg-[#00E5FF] hover:text-[#060B18] border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>{t('plants.learnMore')}</span>
                      <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
