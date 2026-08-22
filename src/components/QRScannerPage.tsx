import React, { useEffect, useState } from 'react';
import { getPlantByHerbiqId } from '../data/plants';
import { QrCode, AlertTriangle, ArrowLeft } from 'lucide-react';

interface QRScannerPageProps {
  onBack: () => void;
  onScanSuccess: (plantId: string) => void;
}

declare global {
  interface Window {
    Html5QrcodeScanner: any;
  }
}

export const QRScannerPage: React.FC<QRScannerPageProps> = ({ onBack, onScanSuccess }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let scanner: any = null;

    if (window.Html5QrcodeScanner) {
      scanner = new window.Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText: string) => {
          // Prevent multiple fires if we've already found it
          const plant = getPlantByHerbiqId(decodedText);
          if (plant) {
            scanner.clear();
            onScanSuccess(plant.id);
          } else {
            setError(`Plant not found in HERBIQ database. (Scanned: ${decodedText})`);
          }
        },
        (errorMessage: string) => {
          // This fires constantly when no QR code is found, so we don't display it as a blocking error
          // Only log for debugging if needed
        }
      );
    } else {
      setError("QR Scanner library failed to load. Please check your connection.");
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300 min-h-[70vh]">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B142B] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#00E5FF]/30 text-xs font-semibold transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 mb-2">
          <QrCode className="w-8 h-8 text-[#00E5FF]" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#F8FAFC]">Scan HERBIQ Code</h1>
        <p className="text-[#94A3B8] text-sm max-w-lg mx-auto">
          Hold your device up to any HERBIQ botanical sign to instantly learn about its traditional uses, habitat, and medicinal benefits.
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-[#00E5FF]/30 bg-[#0B142B] max-w-lg mx-auto overflow-hidden">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        
        {/* The target div for Html5QrcodeScanner */}
        <div id="qr-reader" className="w-full rounded-xl overflow-hidden [&_video]:rounded-xl [&_video]:w-full [&_#qr-reader__scan_region]:bg-[#060B18]"></div>
      </div>
    </div>
  );
};
