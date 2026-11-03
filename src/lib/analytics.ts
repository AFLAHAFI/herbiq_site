import type { Plant } from '../types';
import type { PlantRow } from './admin-api';

export const ANALYTICS_STORAGE_KEY = 'herbiq.analytics.stats.v1';
export const ANALYTICS_OFFLINE_QUEUE_KEY = 'herbiq.analytics.queue.v1';

export interface PlantEngagementEntry {
  plantId: string;
  views: number;
  qrScans: number;
  lastInteractionAt: string;
}

export interface StoredAnalyticsState {
  version: 1;
  byPlant: Record<string, PlantEngagementEntry>;
}

export interface QueuedAnalyticsEvent {
  plantId: string;
  type: 'view' | 'qr_scan';
  timestamp: string;
}

export interface AdminAnalyticsSummary {
  totalPlants: number;
  publishedCount: number;
  hiddenCount: number;
  modelsCount: number;
  customPdfCount: number;
  mlCount: number;
  arCount: number;
  totalViews: number;
  totalQrScans: number;
  pendingOfflineEvents: number;
  topPlants: Array<{
    id: string;
    name: string;
    malayalamName: string;
    views: number;
    qrScans: number;
    totalInteractions: number;
    lastInteractionAt: string | null;
  }>;
}

export function loadAnalyticsState(): StoredAnalyticsState {
  if (typeof localStorage === 'undefined') {
    return { version: 1, byPlant: {} };
  }
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return { version: 1, byPlant: {} };
    const parsed = JSON.parse(raw) as StoredAnalyticsState;
    if (!parsed || typeof parsed.byPlant !== 'object' || !parsed.byPlant) {
      return { version: 1, byPlant: {} };
    }
    return parsed;
  } catch {
    return { version: 1, byPlant: {} };
  }
}

function saveAnalyticsState(state: StoredAnalyticsState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function loadOfflineAnalyticsQueue(): QueuedAnalyticsEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ANALYTICS_OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineAnalyticsQueue(queue: QueuedAnalyticsEvent[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ANALYTICS_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

function applyEventToState(
  state: StoredAnalyticsState,
  plantId: string,
  type: 'view' | 'qr_scan',
  timestamp: string
): void {
  if (!plantId) return;
  const existing = state.byPlant[plantId] || {
    plantId,
    views: 0,
    qrScans: 0,
    lastInteractionAt: timestamp,
  };
  if (type === 'view') {
    existing.views += 1;
  } else {
    existing.qrScans += 1;
  }
  existing.lastInteractionAt = timestamp;
  state.byPlant[plantId] = existing;
}

export function recordPlantView(plantId: string): void {
  if (!plantId) return;
  const now = new Date().toISOString();
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline) {
    const queue = loadOfflineAnalyticsQueue();
    queue.push({ plantId, type: 'view', timestamp: now });
    saveOfflineAnalyticsQueue(queue);
  }
  const state = loadAnalyticsState();
  applyEventToState(state, plantId, 'view', now);
  saveAnalyticsState(state);
}

export function recordQrScan(plantId: string): void {
  if (!plantId) return;
  const now = new Date().toISOString();
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (isOffline) {
    const queue = loadOfflineAnalyticsQueue();
    queue.push({ plantId, type: 'qr_scan', timestamp: now });
    saveOfflineAnalyticsQueue(queue);
  }
  const state = loadAnalyticsState();
  applyEventToState(state, plantId, 'qr_scan', now);
  saveAnalyticsState(state);
}

/**
 * Flushes any queued offline analytics events when the device reconnects.
 */
export function flushOfflineAnalyticsQueue(): number {
  const queue = loadOfflineAnalyticsQueue();
  if (queue.length === 0) return 0;
  saveOfflineAnalyticsQueue([]);
  return queue.length;
}

export function computeAdminAnalytics(rows: PlantRow[]): AdminAnalyticsSummary {
  const state = loadAnalyticsState();
  const queue = loadOfflineAnalyticsQueue();

  let publishedCount = 0;
  let hiddenCount = 0;
  let modelsCount = 0;
  let customPdfCount = 0;
  let mlCount = 0;
  let arCount = 0;

  for (const r of rows) {
    if (r.published) publishedCount++;
    else hiddenCount++;

    const p: Plant = r.profile;
    if (p.model3D) modelsCount++;
    if (p.pdfUrl) customPdfCount++;
    if (p.malayalamName && (p.translations?.ml?.description || p.malayalamName)) mlCount++;
    if (p.translations?.ar?.name && p.translations?.ar?.description) arCount++;
  }

  let totalViews = 0;
  let totalQrScans = 0;
  for (const entry of Object.values(state.byPlant)) {
    totalViews += entry.views || 0;
    totalQrScans += entry.qrScans || 0;
  }

  const topPlants = rows
    .map((r) => {
      const stats = state.byPlant[r.id];
      const views = stats?.views || 0;
      const qrScans = stats?.qrScans || 0;
      return {
        id: r.id,
        name: r.profile.name,
        malayalamName: r.profile.malayalamName,
        views,
        qrScans,
        totalInteractions: views + qrScans,
        lastInteractionAt: stats?.lastInteractionAt || null,
      };
    })
    .sort((a, b) => b.totalInteractions - a.totalInteractions || b.qrScans - a.qrScans || a.name.localeCompare(b.name))
    .slice(0, 6);

  return {
    totalPlants: rows.length,
    publishedCount,
    hiddenCount,
    modelsCount,
    customPdfCount,
    mlCount,
    arCount,
    totalViews,
    totalQrScans,
    pendingOfflineEvents: queue.length,
    topPlants,
  };
}
