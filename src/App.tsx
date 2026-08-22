import React, { useState } from 'react';
import { Page } from './types';
import { PLANTS } from './data/plants';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './components/HomePage';
import { PlantsPage } from './components/PlantsPage';
import { PlantDetailPage } from './components/PlantDetailPage';
import { AskHerbiQPage } from './components/AskHerbiQPage';
import { ARExperiencePage } from './components/ARExperiencePage';
import { AboutPage } from './components/AboutPage';
import { QRScannerPage } from './components/QRScannerPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [askQuestion, setAskQuestion] = useState<string | undefined>(undefined);
  const [arPlantId, setArPlantId] = useState<string | undefined>(undefined);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setSelectedPlantId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlant = (plantId: string) => {
    setSelectedPlantId(plantId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToAskWithQuestion = (question: string) => {
    setAskQuestion(question);
    setSelectedPlantId(null);
    setCurrentPage('ask');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToARWithPlant = (plantId: string) => {
    setArPlantId(plantId);
    setSelectedPlantId(null);
    setCurrentPage('ar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedPlant = PLANTS.find((p) => p.id === selectedPlantId);

  return (
    <div className="min-h-screen bg-[#060B18] text-[#F8FAFC] flex flex-col font-sans selection:bg-[#00E5FF]/20 selection:text-[#00E5FF]">
      {/* Top Main Navigation */}
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Main Dynamic Viewport */}
      <main className="flex-1">
        {selectedPlant ? (
          <PlantDetailPage
            plant={selectedPlant}
            onBack={() => setSelectedPlantId(null)}
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
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
