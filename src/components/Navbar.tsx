import React, { useEffect, useState } from 'react';
import { Page } from '../types';
import { SUPPORTED_LANGS, LANGUAGE_LABELS, useI18n } from '../i18n';
import {
  getOfflineSyncStatus,
  subscribeOfflineSync,
  type OfflineSyncStatus,
} from '../lib/offline-sync';
import {
  Leaf,
  Sparkles,
  Menu,
  X,
  Compass,
  MessageSquareCode,
  Eye,
  Info,
  QrCode,
  Globe,
  Download,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { lang, setLang, t } = useI18n();
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>(() => getOfflineSyncStatus());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const unsub = subscribeOfflineSync((st) => setSyncStatus(st));
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => {
      unsub();
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    setInstallPrompt(null);
  };

  const navItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: t('nav.home'), icon: Leaf },
    { id: 'plants', label: t('nav.plants'), icon: Compass },
    { id: 'ask', label: t('nav.ask'), icon: MessageSquareCode },
    { id: 'scan', label: t('nav.scan'), icon: QrCode },
    { id: 'ar', label: t('nav.ar'), icon: Eye },
    { id: 'about', label: t('nav.about'), icon: Info },
  ];

  const handleNav = (page: Page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#00E5FF]/20 bg-[#060B18]/90 backdrop-blur-md">
      {/* Offline or Newly Synced Banner */}
      {(!syncStatus.online || syncStatus.usingOfflineCache || syncStatus.newlyAddedCount > 0) && (
        <div
          role="status"
          id="offline-sync-banner"
          className={`w-full px-3 py-1 text-[11px] font-semibold flex items-center justify-center gap-2 border-b ${
            !syncStatus.online || syncStatus.usingOfflineCache
              ? 'bg-amber-950/90 text-amber-200 border-amber-500/30'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
          }`}
        >
          {!syncStatus.online || syncStatus.usingOfflineCache ? (
            <>
              <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>
                Offline Mode — {syncStatus.totalPlants} plants available offline. New plants will auto-sync when online.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>
                Synced +{syncStatus.newlyAddedCount} new plants ({syncStatus.totalPlants} total saved for offline use)
              </span>
            </>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-1.5 sm:gap-3 min-w-0">
        {/* Brand Logo */}
        <button
          onClick={() => handleNav('home')}
          className="flex items-center gap-2 sm:gap-3 group text-start focus:outline-none min-w-0 shrink-0"
          id="brand-logo-btn"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#00E5FF]/20 to-[#10B981]/20 border border-[#00E5FF]/40 flex items-center justify-center shadow-sm group-hover:border-[#00E5FF]/80 transition-all duration-300 glow-cyan shrink-0">
            <Leaf className="w-4 h-4 sm:w-5 sm:h-5 text-[#00E5FF] group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#F8FAFC] group-hover:text-[#00E5FF] transition-colors" dir="ltr">
                HerbiQ
              </span>
              <span className="hidden min-[350px]:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30" dir="ltr">
                AI
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-[#94A3B8] tracking-wide -mt-0.5 truncate max-w-[190px]">
              {t('nav.subtitle')}
            </p>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-1 bg-[#0B142B]/90 p-1.5 rounded-full border border-[#00E5FF]/20">
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

        {/* Language Switcher + Install App + Action Badge */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {installPrompt && (
            <button
              type="button"
              onClick={() => void handleInstallApp()}
              id="install-pwa-btn"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 hover:bg-[#10B981]/30 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          <div
            role="group"
            aria-label={t('nav.language')}
            className="flex items-center gap-0.5 sm:gap-1 bg-[#0B142B] p-0.5 sm:p-1 rounded-xl border border-[#00E5FF]/25"
            id="lang-switcher"
          >
            <Globe className="w-3.5 h-3.5 text-[#00E5FF] ms-1.5 hidden sm:inline" aria-hidden="true" />
            {SUPPORTED_LANGS.map((code) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  id={`lang-btn-${code}`}
                  aria-pressed={active}
                  lang={code}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#00E5FF] text-[#060B18] shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {LANGUAGE_LABELS[code]}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handleNav('ask')}
            className="hidden 2xl:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#00E5FF] to-[#10B981] text-[#060B18] hover:brightness-110 transition-all shadow-md hover:shadow-[#00E5FF]/30"
            id="quick-ask-btn"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('nav.askGuide')}</span>
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 sm:p-2.5 rounded-xl bg-[#0B142B] text-[#F8FAFC] border border-[#00E5FF]/30 focus:outline-none shrink-0"
            aria-label={t('nav.toggleMenu')}
            aria-expanded={mobileMenuOpen}
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6 text-[#00E5FF]" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#060B18] border-b border-[#00E5FF]/25 px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {installPrompt && (
            <button
              type="button"
              onClick={() => void handleInstallApp()}
              id="mobile-install-pwa-btn"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
            >
              <Download className="w-4 h-4" />
              <span>Install HerbiQ App (Offline Ready)</span>
            </button>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                id={`mobile-nav-link-${item.id}`}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-start text-sm font-medium transition-all ${
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
