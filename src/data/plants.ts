import { Plant } from '../types';
import rawPlantsData from './herbiq-plants.json';

export let PLANTS: Plant[] = rawPlantsData as Plant[];
export function replacePublicCatalog(plants: Plant[]) {
  PLANTS = plants;
}

/**
 * Normalizes Arabic text for search and matching:
 * - Strips tashkeel / harakat diacritics and tatweel (kashida)
 * - Unifies Alef variants (أ, إ, آ, ٱ) to bare Alef (ا)
 * - Unifies Teh Marbuta (ة) to Heh (ه)
 * - Unifies Alef Maksura (ى) and Farsi Yeh (ی) to Yeh (ي)
 * - Unifies Hamza on Waw (ؤ) to Waw (و) and Hamza on Yeh (ئ) to Yeh (ي)
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/[\u0649\u06CC]/g, '\u064A')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/\u06AF|\u06A9/g, '\u0643')
    .toLowerCase()
    .trim();
}

export function getPlantById(id: string): Plant | undefined {
  return PLANTS.find((plant) => plant.id === id);
}

export function getPlantByHerbiqId(herbiqId: string): Plant | undefined {
  const code = herbiqId.trim();
  if (/^https?:\/\//i.test(code)) {
    try {
      const url = new URL(code);
      // Only accept links for this deployment; never navigate to a scanned external URL.
      if (typeof window === 'undefined' || url.origin !== window.location.origin || url.pathname !== window.location.pathname)
        return undefined;
      const id = new URLSearchParams(url.hash.slice(1)).get('plant');
      return PLANTS.find((plant) => plant.id === id);
    } catch {
      return undefined;
    }
  }
  return PLANTS.find((plant) => plant.herbiqId.toLowerCase() === code.toLowerCase());
}

export function getARAvailablePlants(): Plant[] {
  return PLANTS.filter((plant) => plant.arAvailable);
}

export function searchPlants(query: string, category: string = 'All'): Plant[] {
  const q = query.trim().toLowerCase();
  const qAr = normalizeArabic(query);

  return PLANTS.filter((plant) => {
    const matchesCategory = category === 'All' || plant.category.toLowerCase() === category.toLowerCase();
    if (!matchesCategory) return false;

    if (!q) return true;

    const nameMatch = plant.name.toLowerCase().includes(q);
    const scientificMatch = plant.scientificName.toLowerCase().includes(q);
    const malayalamMatch = plant.malayalamName.toLowerCase().includes(q);
    const familyMatch = plant.family.toLowerCase().includes(q);
    const categoryMatch = plant.category.toLowerCase().includes(q);
    const descMatch = plant.description.toLowerCase().includes(q);
    const traditionalMatch = plant.traditionalUses.toLowerCase().includes(q);
    const partsMatch = plant.plantPartsTraditionallyUsed.toLowerCase().includes(q);

    if (
      nameMatch ||
      scientificMatch ||
      malayalamMatch ||
      familyMatch ||
      categoryMatch ||
      descMatch ||
      traditionalMatch ||
      partsMatch
    ) {
      return true;
    }

    // Check translations (Arabic, Malayalam, etc.)
    const ar = plant.translations?.ar;
    if (ar && qAr) {
      const arFields = [
        ar.name,
        ar.category,
        ar.description,
        ar.traditionalUses,
        ar.medicinalBenefits,
        ar.plantPartsTraditionallyUsed,
        ar.traditionalUsage,
        ar.habitat,
        ar.identification,
        ar.culturalImportance,
        ...(ar.uses || []),
      ];
      if (arFields.some((val) => typeof val === 'string' && normalizeArabic(val).includes(qAr))) {
        return true;
      }
    }

    const ml = plant.translations?.ml;
    if (ml) {
      const mlFields = [
        ml.name,
        ml.category,
        ml.description,
        ml.traditionalUses,
        ml.medicinalBenefits,
        ml.plantPartsTraditionallyUsed,
        ...(ml.uses || []),
      ];
      if (mlFields.some((val) => typeof val === 'string' && val.toLowerCase().includes(q))) {
        return true;
      }
    }

    return false;
  });
}

/** Find a plant mentioned in a natural-language question, prioritizing longer aliases. */
export function findPlantInQuestion(question: string): Plant | undefined {
  const normalize = (s: string) =>
    normalizeArabic(s)
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
      .trim();

  const text = ` ${normalize(question)} `;
  return PLANTS.flatMap((plant) => {
    const arNames = plant.translations?.ar?.name ? plant.translations.ar.name.split(/[/،,()]/) : [];
    const arAliases = arNames.flatMap((part) => {
      const trimmed = part.trim();
      // Also allow matching without the Arabic definite article "ال"
      const withoutAl = trimmed.startsWith('ال') ? trimmed.slice(2).trim() : '';
      return withoutAl ? [trimmed, withoutAl] : [trimmed];
    });

    return [
      plant.name,
      ...plant.name.split('/'),
      plant.id.replace(/-/g, ' '),
      plant.scientificName,
      ...plant.malayalamName.split('/'),
      ...arAliases,
    ].map((alias) => ({ plant, alias: normalize(alias) }));
  })
    .filter((item) => item.alias && text.includes(` ${item.alias} `))
    .sort((a, b) => b.alias.length - a.alias.length)[0]?.plant;
}
