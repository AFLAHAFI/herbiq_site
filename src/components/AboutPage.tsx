import React from 'react';
import { Page } from '../types';
import { Compass, MessageSquareCode, Eye, BookOpen, Sparkles, ShieldCheck, Heart, Users } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (page: Page) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B142B] border border-[#00E5FF]/30 text-xs font-semibold text-[#00E5FF]">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Our Educational Purpose</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F8FAFC] leading-tight">
          Connecting Garden Visitors to Botanical Wisdom
        </h1>

        <p className="text-base sm:text-lg text-[#94A3B8] leading-relaxed">
          HerbiQ is an educational platform designed to help people discover, understand, and explore medicinal plants. Built specifically for botanical and Ayurvedic garden visitors, HerbiQ bridges the gap between field observation and lifelong learning.
        </p>
      </div>

      {/* Three Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Feature 1: Plant Knowledge */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#00E5FF]/20 bg-[#0B142B] space-y-4 flex flex-col justify-between group hover:border-[#00E5FF]/50 transition-all">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#060B18] border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] group-hover:scale-110 transition-transform">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">
              Plant Knowledge
            </h3>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Explore detailed botanical specifications, scientific classifications, regional vernacular names, morphological markers, and traditional Ayurvedic uses.
            </p>
          </div>
          
          <button
            onClick={() => onNavigate('plants')}
            id="about-card-plants-btn"
            className="pt-2 text-xs font-bold text-[#00E5FF] hover:underline inline-flex items-center gap-1"
          >
            <span>Browse Plant Directory →</span>
          </button>
        </div>

        {/* Feature 2: AI Learning */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#10B981]/20 bg-[#0B142B] space-y-4 flex flex-col justify-between group hover:border-[#10B981]/50 transition-all">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#060B18] border border-[#10B981]/40 flex items-center justify-center text-[#10B981] group-hover:scale-110 transition-transform">
              <MessageSquareCode className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">
              AI Learning
            </h3>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Ask HerbiQ instant questions regarding plant recognition, classical herbal literature, preparation methods, and ecological safety.
            </p>
          </div>

          <button
            onClick={() => onNavigate('ask')}
            id="about-card-ask-btn"
            className="pt-2 text-xs font-bold text-[#10B981] hover:underline inline-flex items-center gap-1"
          >
            <span>Ask HerbiQ AI →</span>
          </button>
        </div>

        {/* Feature 3: AR Experience */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#F59E0B]/20 bg-[#0B142B] space-y-4 flex flex-col justify-between group hover:border-[#F59E0B]/50 transition-all">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#060B18] border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B] group-hover:scale-110 transition-transform">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#F8FAFC]">
              AR Experience
            </h3>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Visualize up to 4 medicinal plant specimens simultaneously in your physical room using your mobile camera for hands-on spatial observation.
            </p>
          </div>

          <button
            onClick={() => onNavigate('ar')}
            id="about-card-ar-btn"
            className="pt-2 text-xs font-bold text-[#F59E0B] hover:underline inline-flex items-center gap-1"
          >
            <span>Try AR Projection →</span>
          </button>
        </div>

      </div>

      {/* Mission & Educational Philosophy */}
      <div className="p-8 sm:p-12 rounded-3xl bg-[#0B142B] border border-[#00E5FF]/20 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#060B18] border border-[#00E5FF]/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#00E5FF]" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#F8FAFC]">
              Educational Mission
            </h2>
            <p className="text-xs text-[#94A3B8]">Independent Public Botanical Resource</p>
          </div>
        </div>

        <p className="text-sm text-[#94A3B8] leading-relaxed">
          Botanical and Ayurvedic gardens play a crucial role in conserving plant biodiversity and preserving traditional healing heritage. HerbiQ enhances visitor engagement by providing accessible, verified, and engaging digital experiences accessible from any desktop or smartphone.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="p-4 rounded-xl bg-[#060B18] border border-[#00E5FF]/10 space-y-1">
            <div className="font-bold text-[#F8FAFC] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00E5FF]" />
              <span>Public Accessibility</span>
            </div>
            <p className="text-[#94A3B8]">Designed for students, garden visitors, researchers, and herbal enthusiasts worldwide.</p>
          </div>

          <div className="p-4 rounded-xl bg-[#060B18] border border-[#10B981]/10 space-y-1">
            <div className="font-bold text-[#F8FAFC] flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#10B981]" />
              <span>Cultural Preservation</span>
            </div>
            <p className="text-[#94A3B8]">Honoring traditional knowledge systems alongside scientific taxonomy.</p>
          </div>
        </div>
      </div>

    </div>
  );
};
