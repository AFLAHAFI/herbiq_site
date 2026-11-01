import { Plant } from '../types';
import rawPlantsData from './herbiq-plants.json';

export let PLANTS: Plant[] = rawPlantsData as Plant[];
export function replacePublicCatalog(plants: Plant[]) { PLANTS = plants; }


export function getPlantById(id: string): Plant | undefined {
  return PLANTS.find((plant) => plant.id === id);
}

export function getPlantByHerbiqId(herbiqId: string): Plant | undefined {
  let code = herbiqId.trim();
  if (/^https?:\/\//i.test(code)) {
    try {
      const url = new URL(code);
      // Only accept links for this deployment; never navigate to a scanned external URL.
      if (typeof window === 'undefined' || url.origin !== window.location.origin || url.pathname !== window.location.pathname) return undefined;
      const id = new URLSearchParams(url.hash.slice(1)).get('plant');
      return PLANTS.find(plant => plant.id === id);
    } catch { return undefined; }
  }
  return PLANTS.find(plant => plant.herbiqId.toLowerCase() === code.toLowerCase());
}

export function getARAvailablePlants(): Plant[] {
  return PLANTS.filter((plant) => plant.arAvailable);
}

export function searchPlants(query: string, category: string = 'All'): Plant[] {
  const q = query.trim().toLowerCase();
  
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

    return nameMatch || scientificMatch || malayalamMatch || familyMatch || categoryMatch || descMatch || traditionalMatch || partsMatch;
  });
}

/** Find a plant mentioned in a natural-language question, prioritizing longer aliases. */
export function findPlantInQuestion(question: string): Plant | undefined {
  const normalize = (s: string) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
  const text = ` ${normalize(question)} `;
  return PLANTS.flatMap(plant => [plant.name, ...plant.name.split('/'), plant.id.replace(/-/g, ' '), plant.scientificName, ...plant.malayalamName.split('/')]
    .map(alias => ({plant, alias: normalize(alias)})))
    .filter(item => item.alias && text.includes(` ${item.alias} `))
    .sort((a, b) => b.alias.length - a.alias.length)[0]?.plant;
}
