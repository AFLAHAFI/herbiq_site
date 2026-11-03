import type { Plant } from '../types';
import rawPlantsData from '../data/herbiq-plants.json';

export const OFFLINE_CATALOG_STORAGE_KEY = 'herbiq.offline.catalog.v1';
export const OFFLINE_ASSET_CACHE_NAME = 'herbiq-assets-v1';

export interface OfflineSyncStatus {
  online: boolean;
  totalPlants: number;
  newlyAddedCount: number;
  lastSyncedAt: string | null;
  usingOfflineCache: boolean;
}

export interface StoredOfflineCatalog {
  version: 1;
  updatedAt: string;
  plants: Plant[];
}

type SyncListener = (status: OfflineSyncStatus) => void;
const listeners = new Set<SyncListener>();

let currentStatus: OfflineSyncStatus = {
  online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  totalPlants: (rawPlantsData as Plant[]).length,
  newlyAddedCount: 0,
  lastSyncedAt: null,
  usingOfflineCache: false,
};

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener({ ...currentStatus });
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeOfflineSync(listener: SyncListener): () => void {
  listeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    listeners.delete(listener);
  };
}

export function getOfflineSyncStatus(): OfflineSyncStatus {
  return { ...currentStatus };
}

export function loadOfflineCatalog(): StoredOfflineCatalog | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OFFLINE_CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOfflineCatalog;
    if (!parsed || !Array.isArray(parsed.plants) || parsed.plants.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Merges incoming remote plants with any previously cached offline plants and saves to localStorage.
 * Also triggers background caching of plant images & PDFs for offline viewing.
 */
export function saveOfflineCatalog(remotePlants: Plant[]): {
  mergedPlants: Plant[];
  newlyAddedCount: number;
  updatedAt: string;
} {
  const existing = loadOfflineCatalog();
  const existingIds = new Set((existing?.plants || []).map((p) => p.id));

  let newlyAddedCount = 0;
  if (existing && existingIds.size > 0) {
    for (const p of remotePlants) {
      if (!existingIds.has(p.id)) {
        newlyAddedCount++;
      }
    }
  }

  const updatedAt = new Date().toISOString();
  const payload: StoredOfflineCatalog = {
    version: 1,
    updatedAt,
    plants: remotePlants,
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(OFFLINE_CATALOG_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota exceeded errors
    }
  }

  currentStatus = {
    online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
    totalPlants: remotePlants.length,
    newlyAddedCount,
    lastSyncedAt: updatedAt,
    usingOfflineCache: false,
  };
  notifyListeners();

  // Warm image & PDF asset cache in the background when running in a browser
  void warmOfflineAssets(remotePlants);

  return {
    mergedPlants: remotePlants,
    newlyAddedCount,
    updatedAt,
  };
}

export function markUsingOfflineCatalog(plants: Plant[], lastSyncedAt: string | null) {
  currentStatus = {
    online: typeof navigator !== 'undefined' ? navigator.onLine !== false : false,
    totalPlants: plants.length,
    newlyAddedCount: 0,
    lastSyncedAt,
    usingOfflineCache: true,
  };
  notifyListeners();
}

export async function warmOfflineAssets(plants: Plant[]): Promise<void> {
  if (typeof window === 'undefined' || typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(OFFLINE_ASSET_CACHE_NAME);
    const urls = new Set<string>();
    for (const p of plants) {
      if (p.image) urls.add(p.image);
      if (p.pdfUrl) urls.add(p.pdfUrl);
    }
    for (const url of urls) {
      try {
        const match = await cache.match(url);
        if (!match) {
          const resp = await fetch(url, { mode: 'cors' });
          if (resp.ok) {
            await cache.put(url, resp);
          }
        }
      } catch {
        // Ignore individual asset fetch failures
      }
    }
  } catch {
    // Ignore CacheStorage errors in restricted contexts
  }
}

export function registerServiceWorker(): void {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration is progressive enhancement
    });
  });
}
