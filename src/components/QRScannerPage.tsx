import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getPlantByHerbiqId } from '../data/plants';
interface Props { onBack: () => void; onScanSuccess: (id: string) => void; }
export const QRScannerPage: React.FC<Props> = ({onBack, onScanSuccess}) => {
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
      try { await pending.current; } catch { /* Start errors are displayed by start(). */ }
      const instance = scanner.current;
      if (instance) {
        try { if (instance.isScanning) await instance.stop(); } finally { instance.clear(); scanner.current = null; }
      }
      if (alive.current) setRunning(false);
    })();
    stopping.current = task;
    void task.finally(() => { stopping.current = null; }).catch(() => {});
    return task;
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; void stop().catch(console.error); }; }, []);
  const accept = async (text: string) => {
    if (accepted.current || !alive.current) return;
    const plant = getPlantByHerbiqId(text);
    if (!plant) { setError('Unknown HerbiQ code. Try a label such as HERBIQ:tulsi.'); return; }
    accepted.current = true;
    setBusy(true);
    try { await stop(); if (alive.current) onScanSuccess(plant.id); }
    catch { if (alive.current) setError('Unable to stop the camera. Please retry or reload this page.'); accepted.current = false; }
    finally { if (alive.current) setBusy(false); }
  };
  const start = async () => {
    if (busy || scanner.current || stopping.current) return;
    setError(''); setBusy(true);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('Camera access requires HTTPS and a supported browser. You can enter the plant code below.'); setBusy(false); return;
    }
    try {
      scanner.current = new Html5Qrcode('qr-reader');
      const task = scanner.current.start({facingMode: 'environment'}, {fps: 8, qrbox: (w, h) => { const size = Math.min(240, Math.floor(Math.min(w, h) * .8)); return {width: size, height: size}; }}, text => { void accept(text); }, () => {});
      pending.current = task;
      await task;
      if (alive.current) setRunning(true);
    } catch {
      if (alive.current) setError('Camera could not start. Allow camera permission, close other camera apps, then retry. You can also enter the code below.');
      try { scanner.current?.clear(); } catch { /* Empty scanner. */ }
      scanner.current = null;
    } finally { pending.current = null; if (alive.current) setBusy(false); }
  };
  return <div className="max-w-xl mx-auto p-4 sm:p-8 space-y-6 min-h-[65vh]">
    <button className="underline" onClick={async () => { try { await stop(); onBack(); } catch { setError('Camera could not stop. Please reload.'); } }}>Back</button>
    <h1 className="text-3xl font-bold">Scan HerbiQ Code</h1>
    <p>Scan a plant label or enter its code to open the matching profile.</p>
    {error && <p role="alert" className="p-4 rounded-xl bg-red-950 text-red-200">{error}</p>}
    <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />
    <button disabled={busy} onClick={() => { if (running) { setBusy(true); void stop().catch(() => setError('Camera could not stop. Please reload.')).finally(() => { if (alive.current) setBusy(false); }); } else void start(); }} className="w-full rounded-xl bg-cyan-400 text-slate-950 p-3 font-bold">{busy ? 'Please wait…' : running ? 'Stop camera' : 'Start camera'}</button>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void accept(code); }}>
      <label htmlFor="manual-code" className="block">Plant code</label>
      <input id="manual-code" value={code} onChange={e => setCode(e.target.value)} placeholder="HERBIQ:tulsi" autoCapitalize="none" spellCheck={false} className="w-full p-3 rounded-xl bg-slate-900 border border-slate-600" />
      <button disabled={busy || !code.trim()} className="w-full p-3 rounded-xl border border-cyan-400">Open plant</button>
    </form>
  </div>;
};
