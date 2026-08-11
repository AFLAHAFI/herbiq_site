import React, { useState, useMemo } from 'react';
import { Plant } from '../types';
import { PLANTS, searchPlants, AR_CONFIG_PLANT_IDS } from '../data/plants';
import { PlantImage } from './PlantImage';
import { Search, ChevronRight, Eye, Filter } from 'lucide-react';

interface PlantsPageProps {
  onSelectPlant: (plantId: string) => void;
  onNavigateToARWithPlant?: (plantId: string) => void;
}

export const PlantsPage: React.FC<PlantsPageProps> = ({ onSelectPlant, onNavigateToARWithPlant }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique categories dynamically from the herbiq-plants.json database
  const categories = useMemo(() => {
    const cats = Array.from(new Set(PLANTS.map((p) => p.category))).sort();
    return ['All', ...cats];
  }, []);

  const filteredPlants = useMemo(() => {
    return searchPlants(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-3 text-center md:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B142B] border border-[#00E5FF]/30 text-xs font-semibold text-[#00E5FF]">
          <span>Official Botanical Database ({PLANTS.length} Species)</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC]">
          Explore Medicinal Plants
        </h1>
        <p className="text-[#94A3B8] text-base max-w-2xl">
          Search species by name, Malayalam title, botanical family, or category. Read traditional Ayurvedic knowledge, morphological identification features, and safety guidelines.
        </p>
      </div>

      {/* Search Bar & Category Filters */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, Malayalam name, scientific name, or family (e.g., Tulsi, തുളസി, Ocimum, Lamiaceae)..."
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[#0B142B] border border-[#00E5FF]/30 text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] text-sm transition-all"
            id="plant-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-xs text-[#94A3B8] font-semibold flex items-center gap-1 shrink-0 pr-1">
            <Filter className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Category:</span>
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
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Grid */}
      <div className="space-y-4">
        <div className="text-xs text-[#94A3B8] flex items-center justify-between">
          <span>
            Showing <span className="text-[#00E5FF] font-bold">{filteredPlants.length}</span> of <span className="text-[#F8FAFC] font-bold">{PLANTS.length}</span> medicinal plants
          </span>
          {selectedCategory !== 'All' && (
            <span className="text-[#10B981]">Filtered by: {selectedCategory}</span>
          )}
        </div>

        {filteredPlants.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center space-y-3 bg-[#0B142B]">
            <p className="text-base text-[#F8FAFC] font-medium">No plants found matching your search.</p>
            <p className="text-xs text-[#94A3B8]">Try searching for a different plant name, scientific name, or resetting category filters.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-4 py-2 rounded-xl bg-[#00E5FF]/20 text-[#00E5FF] text-xs font-bold border border-[#00E5FF]/40 hover:bg-[#00E5FF]/30 transition-all"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlants.map((plant) => (
              <div
                key={plant.id}
                className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between group bg-[#0B142B]"
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
                    
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-[#060B18]/80 text-[10px] font-semibold text-[#00E5FF] border border-[#00E5FF]/30 backdrop-blur-sm">
                        {plant.category}
                      </span>
                      {AR_CONFIG_PLANT_IDS.includes(plant.id) && (
                        <span className="px-2 py-1 rounded-full bg-[#10B981]/20 text-[10px] font-semibold text-[#10B981] border border-[#10B981]/30 backdrop-blur-sm flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>AR</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Information */}
                  <div className="p-5 space-y-2">
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-serif text-2xl font-bold text-[#F8FAFC] group-hover:text-[#00E5FF] transition-colors">
                          {plant.name}
                        </h3>
                        <span className="text-xs font-semibold text-[#F59E0B] shrink-0">{plant.malayalamName}</span>
                      </div>
                      <p className="text-xs italic text-[#00E5FF] font-medium pt-0.5">
                        {plant.scientificName}
                      </p>
                      <p className="text-[11px] text-[#94A3B8] pt-0.5">
                        Family: {plant.family}
                      </p>
                    </div>

                    <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed pt-1">
                      {plant.shortDescription}
                    </p>

                    {/* Traditionally Used Parts */}
                    {plant.plantPartsTraditionallyUsed && plant.plantPartsTraditionallyUsed.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1">
                        <span className="text-[10px] text-[#94A3B8] font-semibold pr-1">Parts:</span>
                        {plant.plantPartsTraditionallyUsed.map((part, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-[#060B18] text-[10px] text-[#10B981] border border-[#10B981]/20"
                          >
                            {part}
                          </span>
                        ))}
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
                    <span>Learn More</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
