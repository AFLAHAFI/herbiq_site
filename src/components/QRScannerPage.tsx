import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getPlantByHerbiqId } from '../data/plants';
import { recordQrScan } from '../lib/analytics';
import { useI18n } from '../i18n';
import { Camera, ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
  onScanSuccess: (id: string) => void;
  onScanWithAI?: () => void;
}

export const QRScannerPage: React.FC<Props> = ({ onBack, onScanSuccess, onScanWithAI }) => {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const scanner = useRef<Html5Qrcode | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const stopping = useRef<Promise<void> | null>(null);
  const accepted = useRef(false);
  const alive = useRef(true);

  const stop = () => {
    if (stopping.current) return stopping.current;
    const task = (async () => {
      try {
        await pending.current;
      } catch {
        /* Start errors are displayed by start(). */
      }
      const instance = scanner.current;
      if (instance) {
        try {
          if (instance.isScanning) await instance.stop();
        } finally {
          instance.clear();
          scanner.current = null;
        }
      }
      if (alive.current) setRunning(false);
    })();
    stopping.current = task;
    void task
      .finally(() => {
        stopping.current = null;
      })
      .catch(() => {});
    return task;
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      void stop().catch(console.error);
    };
  }, []);

  const accept = async (text: string) => {
    if (accepted.current || !alive.current) return;
    const plant = getPlantByHerbiqId(text);
    if (!plant) {
      setError(t('scan.unknownCodeError'));
      return;
    }
    accepted.current = true;
    setBusy(true);
    try {
      recordQrScan(plant.id);
      await stop();
      if (alive.current) onScanSuccess(plant.id);
    } catch {
      if (alive.current) setError(t('scan.stopError'));
      accepted.current = false;
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const start = async () => {
    if (busy || scanner.current || stopping.current) return;
    setError('');
    setBusy(true);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(t('scan.httpsError'));
      setBusy(false);
      return;
    }
    try {
      scanner.current = new Html5Qrcode('qr-reader');
      const task = scanner.current.start(
        { facingMode: 'environment' },
        {
          fps: 8,
          qrbox: (w, h) => {
            const size = Math.min(240, Math.floor(Math.min(w, h) * 0.8));
            return { width: size, height: size };
          },
        },
        (text) => {
          void accept(text);
        },
        () => {}
      );
      pending.current = task;
      await task;
      if (alive.current) setRunning(true);
    } catch {
      if (alive.current) setError(t('scan.startError'));
      try {
        scanner.current?.clear();
      } catch {
        /* Empty scanner. */
      }
      scanner.current = null;
    } finally {
      pending.current = null;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-8 space-y-6 min-h-[65vh] text-start">
      <button
        className="inline-flex items-center gap-1.5 underline"
        onClick={async () => {
          try {
            await stop();
            onBack();
          } catch {
            setError(t('scan.stopError'));
          }
        }}
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        <span>{t('scan.back')}</span>
      </button>
      <h1 className="text-3xl font-bold">{t('scan.heading')}</h1>
      <p>{t('scan.subtitle')}</p>
      {error && (
        <p role="alert" className="p-4 rounded-xl bg-red-950 text-red-200">
          {error}
        </p>
      )}
      <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />
      <button
        disabled={busy}
        onClick={() => {
          if (running) {
            setBusy(true);
            void stop()
              .catch(() => setError(t('scan.stopError')))
              .finally(() => {
                if (alive.current) setBusy(false);
              });
          } else void start();
        }}
        className="w-full rounded-xl bg-cyan-400 text-slate-950 p-3 font-bold"
      >
        {busy ? t('scan.pleaseWait') : running ? t('scan.stopCamera') : t('scan.startCamera')}
      </button>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void accept(code);
        }}
      >
        <label htmlFor="manual-code" className="block">
          {t('scan.plantCodeLabel')}
        </label>
        <input
          id="manual-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="HERBIQ:tulsi"
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full p-3 rounded-xl bg-slate-900 border border-slate-600"
        />
        <button disabled={busy || !code.trim()} className="w-full p-3 rounded-xl border border-cyan-400">
          {t('scan.openPlant')}
        </button>
      </form>

      {onScanWithAI && (
        <div className="pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            id="scan-plant-with-ai-link"
            onClick={async () => {
              try {
                await stop();
              } catch {
                // ignore
              }
              onScanWithAI();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B142B] text-[#00E5FF] border border-[#00E5FF]/30 hover:bg-[#00E5FF]/10 text-sm font-semibold transition-all"
          >
            <Camera className="w-4 h-4" />
            <span>{t('scan.aiScanLink')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
