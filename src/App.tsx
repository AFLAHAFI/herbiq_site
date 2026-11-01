import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Page } from './types';
import { backendConfigured } from './lib/backend';
import { refreshCatalog } from './lib/catalog';
import { PLANTS } from './data/plants';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
const AdminPage = lazy(() => import('./components/AdminPage').then(m => ({default: m.AdminPage})));
const PlantsPage = lazy(() => import('./components/PlantsPage').then(m => ({default: m.PlantsPage})));
const PlantDetailPage = lazy(() => import('./components/PlantDetailPage').then(m => ({default: m.PlantDetailPage})));
const AskHerbiQPage = lazy(() => import('./components/AskHerbiQPage').then(m => ({default: m.AskHerbiQPage})));
const ARExperiencePage = lazy(() => import('./components/ARExperiencePage').then(m => ({default: m.ARExperiencePage})));
const AboutPage = lazy(() => import('./components/AboutPage').then(m => ({default: m.AboutPage})));
const QRScannerPage = lazy(() => import('./components/QRScannerPage').then(m => ({default: m.QRScannerPage})));

export default function App() {
  const readRoute = () => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const page = params.get('page') || 'home';
    return { page: (['home','plants','ask','ar','about','scan','admin'].includes(page) ? page : 'home') as Page,
      plant: params.get('plant'), ar: params.get('ar') || undefined, question: params.get('question') || undefined };
  };
  const [route, setRoute] = useState(readRoute);
  useEffect(() => { const sync = () => setRoute(readRoute()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  const navigate = useCallback((page: Page, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({page, ...extra});
    window.location.hash = params.toString();
    setRoute(readRoute());
    window.scrollTo({top: 0, behavior: 'smooth'});
  }, []);
  const currentPage = route.page;
  const selectedPlantId = route.plant;
  const askQuestion = route.question;
  const arPlantId = route.ar;
  const handleNavigate = (page: Page) => navigate(page);
  const handleSelectPlant = useCallback((id: string) => navigate('plants', {plant: id}), [navigate]);
  const handleNavigateToAskWithQuestion = (question: string) => navigate('ask', {question});
  const handleNavigateToARWithPlant = (id: string) => navigate('ar', {ar: id});

  const [catalogLoading, setCatalogLoading] = useState(backendConfigured);
  const [catalogError, setCatalogError] = useState('');
  const [, setCatalogVersion] = useState(0);
  const reloadCatalog = useCallback(async () => {
    try { await refreshCatalog(); setCatalogError(''); }
    catch { setCatalogError('The plant catalog could not be loaded. Please check your connection and retry.'); }
    finally { setCatalogLoading(false); setCatalogVersion(v => v+1); }
  }, []);
  useEffect(() => {
    void reloadCatalog();
    const refresh = () => { if (document.visibilityState === 'visible') void reloadCatalog(); };
    window.addEventListener('focus',refresh);
    const timer = window.setInterval(refresh,60000);
    return () => { clearInterval(timer); window.removeEventListener('focus',refresh); };
  }, [reloadCatalog]);
  const selectedPlant = PLANTS.find((p) => p.id === selectedPlantId);

  return (
    <div className="min-h-screen bg-[#060B18] text-[#F8FAFC] flex flex-col font-sans selection:bg-[#00E5FF]/20 selection:text-[#00E5FF]">
      {/* Top Main Navigation */}
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Main Dynamic Viewport */}
      <main className="flex-1 min-w-0" id="main-content">
        <ErrorBoundary key={`${currentPage}:${selectedPlantId || ''}`}><Suspense fallback={<p role="status" className="p-12 text-center">Loading HerbiQ…</p>}>
        {currentPage !== 'admin' && !catalogLoading && !catalogError && selectedPlantId && !selectedPlant && <div role="alert" className="p-8 text-center">Plant not found. <button className="underline" onClick={() => navigate('plants')}>Browse plants</button></div>}
        {currentPage === 'admin' ? <AdminPage onChanged={reloadCatalog}/> : catalogLoading ? <p className="p-10" role="status">Loading plant catalog…</p> : catalogError ? <div role="alert" className="p-10">{catalogError} <button className="underline" onClick={() => void reloadCatalog()}>Retry</button></div> : selectedPlant ? (
          <PlantDetailPage key={selectedPlant.id}
            plant={selectedPlant}
            onBack={() => navigate('plants')}
            onNavigateToAskWithQuestion={handleNavigateToAskWithQuestion}
            onNavigateToARWithPlant={handleNavigateToARWithPlant}
            onNavigateToScan={() => handleNavigate('scan')}
          />
        ) : (
          <>
            {currentPage === 'home' && (
              <HomePage
                onNavigate={handleNavigate}
                onSelectPlant={handleSelectPlant}
              />
            )}

            {currentPage === 'plants' && (
              <PlantsPage
                onSelectPlant={handleSelectPlant}
                onNavigateToARWithPlant={handleNavigateToARWithPlant}
              />
            )}

            {currentPage === 'ask' && (
              <AskHerbiQPage
                initialQuestion={askQuestion}
                onSelectPlant={handleSelectPlant}
              />
            )}

            {currentPage === 'scan' && (
              <QRScannerPage
                onBack={() => handleNavigate('home')}
                onScanSuccess={handleSelectPlant}
              />
            )}

            {currentPage === 'ar' && (
              <ARExperiencePage
                initialSelectedPlantId={arPlantId}
                onSelectPlant={handleSelectPlant}
              />
            )}

            {currentPage === 'about' && (
              <AboutPage onNavigate={handleNavigate} />
            )}
          </>
        )}
      </Suspense></ErrorBoundary></main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
