import React from 'react';
import { Page, Plant } from '../types';
import { PLANTS } from '../data/plants';
import { PlantImage } from './PlantImage';
import { Compass, MessageSquareCode, Eye, Sparkles, ChevronRight, Flower2, ShieldCheck, Camera, ArrowRight, BookOpen } from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: Page) => void;
  onSelectPlant: (plantId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSelectPlant }) => {
  // Show first 4 cards for explore section
  const explorePlants = PLANTS.slice(0, 4);
  const featuredPlant = PLANTS.find((p) => p.id === 'tulsi') || PLANTS[0];

  return (
    <div className="space-y-20 pb-16">
      {/* HERO SECTION */}
      <section className="relative pt-8 pb-12 md:pt-16 md:pb-24 overflow-hidden">
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00E5FF]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-[#10B981]/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Text Column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B142B] border border-[#00E5FF]/30 text-xs font-medium text-[#00E5FF]">
                <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Botanical Education Platform</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#F8FAFC] leading-[1.12]">
                Discover the world of{' '}
                <span className="bg-gradient-to-r from-[#00E5FF] via-[#10B981] to-[#F59E0B] bg-clip-text text-transparent">
                  medicinal plants.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-[#94A3B8] font-normal leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Explore plants, learn their traditional knowledge, ask HerbiQ, and experience selected plants through augmented reality.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <button
                  onClick={() => onNavigate('plants')}
                  id="hero-explore-btn"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-base hover:brightness-110 transition-all shadow-lg hover:shadow-[#00E5FF]/25 flex items-center justify-center gap-2.5 group glow-cyan"
                >
                  <Compass className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                  <span>Explore Plants</span>
                </button>

                <button
                  onClick={() => onNavigate('ask')}
                  id="hero-ask-btn"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#0B142B] text-[#F8FAFC] border border-[#00E5FF]/30 hover:border-[#00E5FF]/60 font-semibold text-base transition-all hover:bg-[#0B142B]/80 flex items-center justify-center gap-2.5 group"
                >
                  <MessageSquareCode className="w-5 h-5 text-[#00E5FF] group-hover:scale-110 transition-transform" />
                  <span>Ask HerbiQ</span>
                </button>
              </div>

              {/* Subtle Trust Indicators */}
              <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-xs text-[#94A3B8]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span>Traditional Ayurvedic Knowledge</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-[#94A3B8]/30" />
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#00E5FF]" />
                  <span>Botanical Identification</span>
                </div>
              </div>
            </div>

            {/* Botanical Specimen Showcase Card */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="relative w-full max-w-md aspect-[4/5] rounded-3xl p-1 bg-gradient-to-b from-[#00E5FF]/40 via-[#10B981]/20 to-[#0B142B] shadow-2xl glow-cyan">
                <div className="w-full h-full bg-[#0B142B] rounded-[22px] overflow-hidden relative flex flex-col justify-between p-6">
                  
                  {/* Plant Card Header Overlay */}
                  <div className="flex items-center justify-between z-10">
                    <span className="px-3 py-1 rounded-full bg-[#060B18]/80 backdrop-blur-md text-[11px] font-semibold text-[#00E5FF] border border-[#00E5FF]/30">
                      Featured Specimen
                    </span>
                    <div className="w-8 h-8 rounded-full bg-[#060B18]/80 backdrop-blur-md flex items-center justify-center border border-[#00E5FF]/30">
                      <Sparkles className="w-4 h-4 text-[#00E5FF] animate-pulse" />
                    </div>
                  </div>

                  {/* Specimen Visual */}
                  <div className="relative my-4 flex-1 rounded-2xl overflow-hidden group">
                    <PlantImage
                      src={featuredPlant.image}
                      alt={featuredPlant.name}
                      plantName={featuredPlant.name}
                      category={featuredPlant.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B142B] via-transparent to-transparent opacity-90" />
                    
                    {/* Floating Specimen Info */}
                    <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-[#060B18]/90 backdrop-blur-md border border-[#00E5FF]/30">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-[#F8FAFC]">{featuredPlant.name}</div>
                        <div className="text-[10px] text-[#F59E0B] font-semibold">{featuredPlant.malayalamName}</div>
                      </div>
                      <div className="text-[11px] italic text-[#94A3B8]">{featuredPlant.scientificName}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#10B981]">
                        <Flower2 className="w-3 h-3" />
                        <span>Family: {featuredPlant.family}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Specimen Footer */}
                  <button
                    onClick={() => onSelectPlant(featuredPlant.id)}
                    className="w-full py-2.5 rounded-xl bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <span>View {featuredPlant.name} Profile</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* EXPLORE MEDICINAL PLANTS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-xs font-bold tracking-wider text-[#00E5FF] uppercase mb-1">
              Botanical Database ({PLANTS.length} Species)
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
              Explore Medicinal Plants
            </h2>
          </div>
          <button
            onClick={() => onNavigate('plants')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#00E5FF] hover:text-[#10B981] transition-colors"
            id="view-all-plants-link"
          >
            <span>Browse Full Directory ({PLANTS.length} Plants)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Plant Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {explorePlants.map((plant) => (
            <div
              key={plant.id}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between group bg-[#0B142B]"
            >
              <div>
                {/* Image Area */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[#060B18]">
                  <PlantImage
                    src={plant.image}
                    alt={plant.name}
                    plantName={plant.name}
                    category={plant.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B142B] via-transparent to-transparent opacity-80" />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#060B18]/80 text-[10px] font-semibold text-[#00E5FF] border border-[#00E5FF]/30 backdrop-blur-sm">
                    {plant.category}
                  </div>
                  {plant.arAvailable && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[10px] font-semibold text-[#10B981] border border-[#10B981]/30 backdrop-blur-sm flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>AR</span>
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="p-5 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-serif text-2xl font-bold text-[#F8FAFC] group-hover:text-[#00E5FF] transition-colors">
                      {plant.name}
                    </h3>
                    <span className="text-xs font-semibold text-[#F59E0B] shrink-0">{plant.malayalamName}</span>
                  </div>
                  <p className="text-xs italic text-[#94A3B8] font-medium">
                    {plant.scientificName} • {plant.family}
                  </p>
                  <p className="text-xs text-[#94A3B8] line-clamp-2 pt-1 leading-relaxed">
                    {plant.description}
                  </p>
                </div>
              </div>

              {/* Card Footer Button */}
              <div className="p-5 pt-0">
                <button
                  onClick={() => onSelectPlant(plant.id)}
                  id={`learn-more-home-${plant.id}`}
                  className="w-full py-2.5 rounded-xl bg-[#060B18] hover:bg-[#00E5FF] hover:text-[#060B18] border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Learn More</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* VISITED A MEDICINAL PLANT GARDEN SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-r from-[#0B142B] via-[#060B18] to-[#0B142B] border border-[#00E5FF]/25 p-8 sm:p-12 overflow-hidden shadow-xl">
          <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-[#00E5FF]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-semibold border border-[#00E5FF]/30">
              <Compass className="w-3.5 h-3.5" />
              <span>Continue Your Learning Journey</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
              Visited a medicinal plant garden?
            </h2>

            <p className="text-base text-[#94A3B8] leading-relaxed">
              HerbiQ is created for visitors who want to continue exploring medicinal plants after their garden visit. Search species by name or family, review traditional knowledge, and deepen your understanding at your own pace.
            </p>

            <div className="pt-2">
              <button
                onClick={() => onNavigate('plants')}
                id="explore-knowledge-btn"
                className="px-6 py-3 rounded-xl bg-[#00E5FF] text-[#060B18] font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-md glow-cyan"
              >
                <span>Explore Plant Knowledge</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* COMPACT ASK HERBIQ PREVIEW SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-3xl p-8 sm:p-10 border border-[#00E5FF]/25 relative overflow-hidden bg-[#0B142B]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-semibold border border-[#00E5FF]/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Conversational AI Assistant</span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
                Ask HerbiQ
              </h2>

              <p className="text-base text-[#94A3B8]">
                Have a question about a medicinal plant? Get educational insights on traditional usage, identification tips, and safety considerations.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => onNavigate('ask')}
                  id="start-chat-btn"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-md glow-cyan"
                >
                  <MessageSquareCode className="w-4 h-4" />
                  <span>Ask HerbiQ Questions</span>
                </button>
              </div>
            </div>

            {/* Chat Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-[#060B18] p-5 rounded-2xl border border-[#00E5FF]/20 space-y-3 shadow-inner">
                {/* User Prompt */}
                <div className="flex justify-end">
                  <div className="bg-[#0B142B] text-[#F8FAFC] text-xs px-3.5 py-2.5 rounded-2xl rounded-tr-none border border-[#00E5FF]/30 max-w-[85%]">
                    How do I recognize Neem in a garden?
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#00E5FF]/20 border border-[#00E5FF]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
                  </div>
                  <div className="bg-[#0B142B]/80 text-[#94A3B8] text-xs p-3 rounded-2xl rounded-tl-none border border-[#00E5FF]/20 space-y-1">
                    <p className="text-[#F8FAFC] font-medium">HerbiQ AI:</p>
                    <p className="leading-relaxed">
                      Neem (Azadirachta indica) is identified by its pinnately compound leaves with serrated leaflets. Its bark is rough and greyish-brown, and its crushed leaves have a distinct bitter aroma.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* AR EXPERIENCE SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#0B142B] border border-[#00E5FF]/30 p-8 sm:p-12 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-semibold border border-[#F59E0B]/30">
                <Camera className="w-3.5 h-3.5" />
                <span>Augmented Reality Visualization</span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">
                Bring medicinal plants into your space.
              </h2>

              <p className="text-base text-[#94A3B8] leading-relaxed">
                Experience selected medicinal plants in 3D directly in your space. Select up to 4 plants at one time to compare and inspect their features.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onNavigate('ar')}
                  id="try-ar-btn"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] via-[#00B4D8] to-[#10B981] text-[#060B18] font-bold text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-lg glow-cyan"
                >
                  <Eye className="w-4 h-4" />
                  <span>Try AR Experience</span>
                </button>

                <span className="text-xs text-[#F59E0B] font-medium bg-[#060B18] px-3 py-2 rounded-xl border border-[#F59E0B]/20">
                  ✦ Select up to 4 plants at a time
                </span>
              </div>
            </div>

            {/* AR Visual Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-xs aspect-[3/4] rounded-2xl border border-[#00E5FF]/40 bg-[#060B18] p-4 flex flex-col justify-between relative glow-cyan">
                <div className="flex items-center justify-between text-[11px] text-[#00E5FF]">
                  <span className="font-mono">AR CAMERA SELECTION</span>
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                </div>

                <div className="my-auto text-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/40 mx-auto flex items-center justify-center">
                    <Eye className="w-8 h-8 text-[#00E5FF]" />
                  </div>
                  <p className="text-xs text-[#F8FAFC] font-medium">Virtual Botanical Projection</p>
                  <p className="text-[10px] text-[#94A3B8]">Spatial specimen selection ready</p>
                </div>

                <div className="p-2 rounded-xl bg-[#0B142B] border border-[#00E5FF]/20 text-[10px] text-center text-[#00E5FF]">
                  Counter: Selected 4 / 4
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};
