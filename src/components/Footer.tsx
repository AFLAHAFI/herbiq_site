import React from 'react';
import { Page } from '../types';
import { Leaf, ShieldAlert } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: Page) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-[#00E5FF]/20 bg-[#060B18] pt-12 pb-8 text-[#94A3B8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-[#0B142B]">
          
          {/* Brand & Motto */}
          <div className="text-center md:text-left space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0B142B] border border-[#00E5FF]/30 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-[#00E5FF]" />
              </div>
              <span className="font-serif text-2xl font-bold text-[#F8FAFC]">HerbiQ</span>
            </div>
            <p className="text-sm text-[#10B981] font-medium tracking-wide">
              Learn • Explore • Experience
            </p>
          </div>

          {/* Quick Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <button
              onClick={() => onNavigate('plants')}
              className="hover:text-[#00E5FF] transition-colors"
              id="footer-nav-plants"
            >
              Plants
            </button>
            <span className="text-[#0B142B]">•</span>
            <button
              onClick={() => onNavigate('ask')}
              className="hover:text-[#00E5FF] transition-colors"
              id="footer-nav-ask"
            >
              Ask HerbiQ
            </button>
            <span className="text-[#0B142B]">•</span>
            <button
              onClick={() => onNavigate('ar')}
              className="hover:text-[#00E5FF] transition-colors"
              id="footer-nav-ar"
            >
              AR Experience
            </button>
            <span className="text-[#0B142B]">•</span>
            <button
              onClick={() => onNavigate('about')}
              className="hover:text-[#00E5FF] transition-colors"
              id="footer-nav-about"
            >
              About
            </button>
          </nav>
        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]/80">
          <div className="flex items-start md:items-center gap-2 max-w-2xl">
            <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5 md:mt-0" />
            <p>
              <strong className="text-[#F59E0B]">Educational Disclaimer:</strong> HerbiQ is an educational resource for botanical garden visitors. Content provided is not intended for medical diagnosis, treatment, or clinical advice.
            </p>
          </div>
          <p className="shrink-0 text-center md:text-right">
            © {new Date().getFullYear()} HerbiQ. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
