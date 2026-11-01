import type { Plant, PlantTranslations } from '../types';

export const PROFILE_FIELDS = [
  ['name', 'English name'],
  ['malayalamName', 'Malayalam name'],
  ['scientificName', 'Scientific name'],
  ['family', 'Family'],
  ['category', 'Category'],
  ['description', 'Description'],
  ['traditionalUses', 'Traditional uses'],
  ['medicinalBenefits', 'Traditional benefits'],
  ['plantPartsTraditionallyUsed', 'Parts used'],
  ['traditionalUsage', 'Traditional usage'],
  ['habitat', 'Habitat'],
  ['identification', 'Identification'],
  ['culturalImportance', 'Cultural importance'],
] as const;

export const TRANSLATABLE_STRING_FIELDS = [
  ['name', 'Translated name'],
  ['category', 'Translated category'],
  ['description', 'Translated description'],
  ['traditionalUses', 'Translated traditional uses'],
  ['medicinalBenefits', 'Translated traditional benefits'],
  ['plantPartsTraditionallyUsed', 'Translated parts used'],
  ['traditionalUsage', 'Translated traditional usage'],
  ['habitat', 'Translated habitat'],
  ['identification', 'Translated identification'],
  ['culturalImportance', 'Translated cultural importance'],
] as const;

export function safeAssetUrl(value: string) {
  if (!value) return true;
  if (/^\/assets\/[a-zA-Z0-9/_ .-]+$/.test(value) && !value.includes('..')) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function validateTranslations(translations: unknown): PlantTranslations {
  if (translations === undefined) return {};
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    throw new Error('Translations must be a JSON object.');
  }
  const serialized = JSON.stringify(translations);
  if (new TextEncoder().encode(serialized).length >= 200000) {
    throw new Error('Translations exceed the 200 KB size limit.');
  }

  for (const [lang, entry] of Object.entries(translations as Record<string, unknown>)) {
    if (!/^[a-z]{2,5}(?:-[A-Za-z0-9]{2,8})?$/.test(lang)) {
      throw new Error(`Invalid translation language key: ${lang}`);
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Translation entry for "${lang}" must be an object.`);
    }
    const obj = entry as Record<string, unknown>;
    for (const [field, label] of TRANSLATABLE_STRING_FIELDS) {
      const val = obj[field];
      if (val !== undefined && val !== null) {
        if (typeof val !== 'string') {
          throw new Error(`${label} (${lang}) must be a string.`);
        }
        if (val.length > 5000) {
          throw new Error(`${label} (${lang}) exceeds 5,000 characters.`);
        }
      }
    }
    if (obj.uses !== undefined && obj.uses !== null) {
      if (!Array.isArray(obj.uses) || obj.uses.some((item) => typeof item !== 'string' || item.length > 1000)) {
        throw new Error(`Translated uses (${lang}) must be an array of strings (max 1,000 characters each).`);
      }
    }
    if (obj.health !== undefined && obj.health !== null) {
      if (typeof obj.health !== 'object' || Array.isArray(obj.health)) {
        throw new Error(`Translated health (${lang}) must be an object.`);
      }
      const h = obj.health as Record<string, unknown>;
      for (const k of ['issues', 'symptoms', 'prevention'] as const) {
        if (h[k] !== undefined && h[k] !== null) {
          if (typeof h[k] !== 'string' || (h[k] as string).length > 5000) {
            throw new Error(`Translated health.${k} (${lang}) must be a string up to 5,000 characters.`);
          }
        }
      }
    }
  }

  return translations as PlantTranslations;
}

export function validatePlant(p: Plant) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id) || p.id.length > 80)
    throw new Error('Plant ID must use lowercase letters, numbers and single hyphens (maximum 80 characters).');
  if (!/^HERBIQ:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.herbiqId) || p.herbiqId.length > 100)
    throw new Error('QR ID must use HERBIQ: followed by a lowercase plant code.');
  for (const [field, label] of PROFILE_FIELDS) {
    const value = p[field] || '';
    if (field !== 'culturalImportance' && !value.trim()) throw new Error(`${label} is required.`);
    if (value.length > 5000) throw new Error(`${label} exceeds 5,000 characters.`);
  }
  if (!p.image || !safeAssetUrl(p.image)) throw new Error('Choose a photo or a valid HTTPS image URL.');
  if (!safeAssetUrl(p.model3D || '')) throw new Error('Model URL must be an /assets/ path or HTTPS URL.');
  if (p.arAvailable && !p.model3D) throw new Error('Add a GLB model URL before enabling 3D/AR.');
  if (
    !p.health ||
    (['issues', 'symptoms', 'prevention'] as const).some(
      (k) => typeof p.health[k] !== 'string' || !p.health[k].trim() || p.health[k].length > 5000
    )
  )
    throw new Error('Complete all plant health fields (maximum 5,000 characters each).');
  if (p.translations !== undefined) {
    validateTranslations(p.translations);
  }
  return p;
}

export function emptyPlant(): Plant {
  return {
    id: '',
    herbiqId: 'HERBIQ:',
    name: '',
    malayalamName: '',
    scientificName: '',
    family: '',
    category: 'Herb',
    description: '',
    traditionalUses: '',
    medicinalBenefits: '',
    plantPartsTraditionallyUsed: '',
    traditionalUsage: '',
    habitat: '',
    identification: '',
    image: '',
    arAvailable: false,
    model3D: '',
    health: { issues: '', symptoms: '', prevention: '' },
    translations: {},
  };
}
