import type { Lang, Plant } from '../../types';
import type { CatalogSummaryItem } from './provider';

export function buildCatalogSummary(plants: Plant[]): CatalogSummaryItem[] {
  return plants.map((p) => ({
    id: p.id,
    name: p.name,
    scientificName: p.scientificName,
    malayalamName: p.malayalamName,
    arabicName: p.translations?.ar?.name || undefined,
    category: p.category,
    shortUses: p.traditionalUses.slice(0, 180),
  }));
}

const LANG_NAMES: Record<Lang, string> = {
  en: 'English (en)',
  ml: 'Malayalam (ml - മലയാളം)',
  ar: 'Arabic (ar - العربية)',
};

export function buildChatSystemPrompt(lang: Lang, plants: Plant[]): string {
  const catalogJson = JSON.stringify(buildCatalogSummary(plants));
  return [
    'You are HerbiQ, an Ayurvedic medicinal-plant guide for a school/garden project.',
    `Selected site language: ${LANG_NAMES[lang] || lang}.`,
    'Language rule: Answer in the user\'s selected site language (en / ml / ar). If the user writes their question in another language, answer in the language they wrote.',
    'Catalog grounding rule: Use the provided HerbiQ catalog first. When your answer is about one or more catalog plants, include the plant\'s exact id in the format [PLANT:plant-id] (for example [PLANT:tulsi] or [PLANT:neem]) so the website UI can display a "View plant" card.',
    'Safety rule: Provide educational botanical and traditional Ayurvedic context only. Never diagnose medical conditions, never prescribe treatments, and never give doses for children, pregnancy, or serious illness; always advise users to consult a qualified doctor or Ayurveda practitioner.',
    'Scope rule: Politely refuse unrelated or harmful requests and guide the visitor back to medicinal plants and botanical learning.',
    `HerbiQ Catalog JSON: ${catalogJson}`,
  ].join('\n\n');
}

export function buildPlantScanPrompt(lang: Lang, catalog: CatalogSummaryItem[]): string {
  const compactCatalog = JSON.stringify(
    catalog.map((c) => ({
      id: c.id,
      name: c.name,
      scientificName: c.scientificName,
      malayalamName: c.malayalamName,
      arabicName: c.arabicName,
    }))
  );
  return [
    'You are HerbiQ Vision, an educational botanical plant identifier for a medicinal plant garden.',
    `Respond with STRICT JSON only. All human-readable text fields (common_name, short_info, uses, caution) MUST be written in ${LANG_NAMES[lang] || lang}. Keep scientific_name in standard Latin binomial format.`,
    'If the image does not show a plant or is too blurry/dark to identify, set "is_plant" to false or "confidence" to "low", and explain in "short_info" and "caution" that a clearer, closer, well-lit leaf/flower photo is needed.',
    'If the identified plant matches one of the plants in the HerbiQ Catalog below (by scientific name or common name), set "matched_catalog_id" to that exact catalog "id" string; otherwise set "matched_catalog_id" to null.',
    'Keep "uses" strictly educational/traditional (no medical diagnosis or clinical dosing). Always include a clear safety reminder in "caution".',
    `HerbiQ Catalog: ${compactCatalog}`,
  ].join('\n\n');
}

export function buildPlantTranslationPrompt(plant: Plant, targetLang: 'ar' | 'ml'): string {
  const targetName = targetLang === 'ar' ? 'Arabic (العربية)' : 'Malayalam (മലയാളം)';
  const sourcePayload = {
    name: plant.name,
    scientificName: plant.scientificName,
    category: plant.category,
    description: plant.description,
    traditionalUses: plant.traditionalUses,
    medicinalBenefits: plant.medicinalBenefits,
    plantPartsTraditionallyUsed: plant.plantPartsTraditionallyUsed,
    traditionalUsage: plant.traditionalUsage,
    habitat: plant.habitat,
    identification: plant.identification,
    culturalImportance: plant.culturalImportance || '',
    health: plant.health,
  };
  return [
    `Translate the following HerbiQ medicinal plant record from English into ${targetName} for an educational botanical garden catalog.`,
    'Rules:',
    '1. Translate accurately and naturally. Do NOT invent or add any new medical claims, dosages, or cures.',
    '2. Return STRICT JSON matching the requested schema.',
    `Source Plant JSON: ${JSON.stringify(sourcePayload)}`,
  ].join('\n');
}

/** Extracts any catalog plant IDs referenced in an AI response via [PLANT:id] or exact ID mention. */
export function extractReferencedPlantIds(text: string, plants: Plant[]): string[] {
  const found = new Set<string>();
  const validIds = new Set(plants.map((p) => p.id));

  const tagRegex = /\[PLANT:([a-z0-9-]+)\]/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(text)) !== null) {
    const id = match[1].toLowerCase();
    if (validIds.has(id)) found.add(id);
  }

  if (found.size === 0) {
    const lower = text.toLowerCase();
    for (const p of plants) {
      const names = [
        p.name.toLowerCase(),
        p.scientificName.toLowerCase(),
        p.malayalamName,
        p.translations?.ar?.name,
      ].filter(Boolean) as string[];
      if (names.some((n) => n.length >= 3 && lower.includes(n.toLowerCase()))) {
        found.add(p.id);
      }
    }
  }

  return Array.from(found);
}

/** Strips [PLANT:id] markers from displayed text so the prose reads cleanly. */
export function cleanPlantTags(text: string): string {
  return text.replace(/\s*\[PLANT:[a-z0-9-]+\]/gi, '').trim();
}
