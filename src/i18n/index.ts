import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Lang, Plant } from '../types';
import en from './locales/en.json';
import ml from './locales/ml.json';
import ar from './locales/ar.json';

export const SUPPORTED_LANGS: readonly Lang[] = ['en', 'ml', 'ar'] as const;
export const LANG_STORAGE_KEY = 'herbiq.lang';

export const LANGUAGE_LABELS: Record<Lang, string> = {
  en: 'EN',
  ml: 'മലയാളം',
  ar: 'العربية',
};

export const LOCALES: Record<Lang, Record<string, any>> = {
  en,
  ml,
  ar,
};

export function isSupportedLang(value: unknown): value is Lang {
  return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export function getDirection(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function applyDocumentLang(lang: Lang, doc: Document | undefined = typeof document !== 'undefined' ? document : undefined): 'rtl' | 'ltr' {
  const dir = getDirection(lang);
  if (doc?.documentElement) {
    doc.documentElement.lang = lang;
    doc.documentElement.dir = dir;
  }
  return dir;
}

export function parseLangFromHash(hash: string): Lang | null {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const langParam = params.get('lang')?.toLowerCase();
  return isSupportedLang(langParam) ? langParam : null;
}

export function saveLangPreference(lang: Lang, storage?: Pick<Storage, 'setItem'> | null): void {
  try {
    const target = storage !== undefined ? storage : typeof window !== 'undefined' ? window.localStorage : null;
    target?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

export function detectInitialLang(options?: {
  hash?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  navigatorLang?: string;
}): Lang {
  const hash = options?.hash !== undefined ? options.hash : typeof window !== 'undefined' ? window.location.hash : '';
  const fromUrl = parseLangFromHash(hash);
  if (fromUrl) {
    saveLangPreference(fromUrl, options?.storage);
    return fromUrl;
  }

  try {
    const storage = options?.storage !== undefined ? options.storage : typeof window !== 'undefined' ? window.localStorage : null;
    const saved = storage?.getItem(LANG_STORAGE_KEY)?.toLowerCase();
    if (isSupportedLang(saved)) return saved;
  } catch {
    // Ignore storage read errors.
  }

  const nav = (
    options?.navigatorLang !== undefined
      ? options.navigatorLang
      : typeof navigator !== 'undefined'
        ? navigator.language || (navigator.languages && navigator.languages[0]) || 'en'
        : 'en'
  ).toLowerCase();

  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('ml')) return 'ml';
  return 'en';
}

function lookupKey(obj: Record<string, any>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = LOCALES[lang] || LOCALES.en;
  let template = lookupKey(dict, key) ?? lookupKey(LOCALES.en, key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      template = template.replaceAll(`{${k}}`, String(v));
    }
  }
  return template;
}

/**
 * Returns a localized view of a Plant object for the given language,
 * falling back cleanly to the English fields whenever a translation field is missing.
 */
export function getLocalizedPlant(plant: Plant, lang: Lang): Plant {
  if (!plant) return plant;
  if (lang === 'en') return plant;

  const tr = plant.translations?.[lang];
  const pick = (val: string | undefined, fallback: string): string =>
    typeof val === 'string' && val.trim().length > 0 ? val : fallback;

  const localizedName =
    lang === 'ml'
      ? pick(tr?.name, plant.malayalamName || plant.name)
      : pick(tr?.name, plant.name);

  const traditionalUsesFallback =
    tr?.uses && Array.isArray(tr.uses) && tr.uses.length > 0
      ? tr.uses.filter(Boolean).join(' • ')
      : plant.traditionalUses;

  return {
    ...plant,
    name: localizedName,
    description: pick(tr?.description, plant.description),
    traditionalUses: pick(tr?.traditionalUses, traditionalUsesFallback),
    medicinalBenefits: pick(tr?.medicinalBenefits, plant.medicinalBenefits),
    plantPartsTraditionallyUsed: pick(tr?.plantPartsTraditionallyUsed, plant.plantPartsTraditionallyUsed),
    traditionalUsage: pick(tr?.traditionalUsage, plant.traditionalUsage),
    habitat: pick(tr?.habitat, plant.habitat),
    identification: pick(tr?.identification, plant.identification),
    culturalImportance: pick(tr?.culturalImportance, plant.culturalImportance || ''),
    health: {
      issues: pick(tr?.health?.issues, plant.health?.issues || ''),
      symptoms: pick(tr?.health?.symptoms, plant.health?.symptoms || ''),
      prevention: pick(tr?.health?.prevention, plant.health?.prevention || ''),
    },
  };
}

export interface I18nContextValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (next: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  localizePlant: (plant: Plant) => Plant;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  dir: 'ltr',
  setLang: () => {},
  t: (key, vars) => translate('en', key, vars),
  localizePlant: (plant) => plant,
});

export const I18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = detectInitialLang();
    applyDocumentLang(initial);
    return initial;
  });

  const setLang = useCallback((next: Lang) => {
    if (!isSupportedLang(next)) return;
    setLangState(next);
    saveLangPreference(next);
    applyDocumentLang(next);
    if (typeof window !== 'undefined' && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      if (params.has('lang')) {
        params.set('lang', next);
        window.history.replaceState(null, '', `#${params.toString()}`);
      }
    }
  }, []);

  useEffect(() => {
    applyDocumentLang(lang);
  }, [lang]);

  useEffect(() => {
    const onHashChange = () => {
      const urlLang = parseLangFromHash(window.location.hash);
      if (urlLang && urlLang !== lang) {
        setLangState(urlLang);
        saveLangPreference(urlLang);
        applyDocumentLang(urlLang);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      dir: getDirection(lang),
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      localizePlant: (plant) => getLocalizedPlant(plant, lang),
    }),
    [lang, setLang]
  );

  return React.createElement(I18nContext.Provider, { value }, children);
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
