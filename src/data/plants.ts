import { Plant } from '../types';
import rawPlantsData from './herbiq-plants.json'; // Force Vite to reload this module and the JSON

export const PLANTS: Plant[] = rawPlantsData as Plant[];

export function getPlantById(id: string): Plant | undefined {
  return PLANTS.find((plant) => plant.id === id);
}

export const AR_CONFIG_PLANT_IDS = ['tulsi', 'neem', 'aloe-vera', 'turmeric'];

export function getARAvailablePlants(): Plant[] {
  return PLANTS.filter((plant) => AR_CONFIG_PLANT_IDS.includes(plant.id));
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
