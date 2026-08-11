import React, { useState } from 'react';
import { Page } from '../types';
import { Leaf, Sparkles, Menu, X, Compass, MessageSquareCode, Eye, Info } from 'lucide-react';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Leaf },
    { id: 'plants', label: 'Plants', icon: Compass },
    { id: 'ask', label: 'Ask HerbiQ', icon: MessageSquareCode },
    { id: 'ar', label: 'AR Experience', icon: Eye },
    { id: 'about', label: 'About', icon: Info },
  ];

  const handleNav = (page: Page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#00E5FF]/20 bg-[#060B18]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <button 
          onClick={() => handleNav('home')}
          className="flex items-center gap-3 group text-left focus:outline-none"
          id="brand-logo-btn"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF]/20 to-[#10B981]/20 border border-[#00E5FF]/40 flex items-center justify-center shadow-sm group-hover:border-[#00E5FF]/80 transition-all duration-300 glow-cyan">
            <Leaf className="w-5 h-5 text-[#00E5FF] group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-2xl font-bold tracking-tight text-[#F8FAFC] group-hover:text-[#00E5FF] transition-colors">
                HerbiQ
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30">
                AI
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] tracking-wide -mt-0.5">Botanical Education</p>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-[#0B142B]/90 p-1.5 rounded-full border border-[#00E5FF]/20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                id={`nav-link-${item.id}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00E5FF]/25 to-[#10B981]/25 text-[#00E5FF] border border-[#00E5FF]/50 shadow-sm glow-cyan'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#060B18]/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#00E5FF]' : 'text-[#94A3B8]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Badge */}
        <div className="hidden lg:flex items-center gap-3">
          <button
            onClick={() => handleNav('ask')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] hover:brightness-110 transition-all shadow-md hover:shadow-[#00E5FF]/30"
            id="quick-ask-btn"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI Companion</span>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2.5 rounded-xl bg-[#0B142B] text-[#F8FAFC] border border-[#00E5FF]/30 focus:outline-none"
          aria-label="Toggle navigation menu"
          id="mobile-menu-toggle"
        >
          {mobileMenuOpen ? <X className="w-6 h-6 text-[#00E5FF]" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#060B18] border-b border-[#00E5FF]/25 px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                id={`mobile-nav-link-${item.id}`}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#0B142B] text-[#00E5FF] border border-[#00E5FF]/50'
                    : 'text-[#94A3B8] hover:bg-[#0B142B]/50 hover:text-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {isActive && <div className="w-2 h-2 rounded-full bg-[#00E5FF]" />}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
