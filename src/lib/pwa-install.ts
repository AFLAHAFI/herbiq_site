/**
 * Global PWA install-prompt capture.
 * Chrome/Edge/Samsung fire `beforeinstallprompt` once, often BEFORE React components mount,
 * so we capture it at module load (imported first in main.tsx) and expose it via a subscription.
 * iOS Safari never fires this event — we expose `isIOS` so the UI can show manual
 * "Share → Add to Home Screen" instructions instead.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  canPrompt: boolean;
  installed: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<(s: InstallState) => void>();

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
  return Boolean(mql?.matches || (navigator as any).standalone === true);
}

function ua(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
}

export function getInstallState(): InstallState {
  const agent = ua();
  const isIOS =
    /iphone|ipad|ipod/i.test(agent) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  return {
    canPrompt: deferredPrompt !== null,
    installed: installed || detectStandalone(),
    isIOS,
    isAndroid: /android/i.test(agent),
  };
}

function emit() {
  const s = getInstallState();
  for (const l of listeners) l(s);
}

export function subscribeInstallState(listener: (s: InstallState) => void): () => void {
  listeners.add(listener);
  listener(getInstallState());
  return () => {
    listeners.delete(listener);
  };
}

/** Shows the native install dialog. Returns the outcome, or 'unavailable' if the browser has not offered it. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const evt = deferredPrompt;
  deferredPrompt = null;
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') installed = true;
    return choice.outcome;
  } catch {
    return 'dismissed';
  } finally {
    emit();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
}
