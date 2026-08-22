export type Page = 'home' | 'plants' | 'ask' | 'ar' | 'about' | 'scan';

export interface PlantHealth {
  issues: string;
  symptoms: string;
  prevention: string;
}

export interface Plant {
  id: string;
  herbiqId: string;
  name: string;
  malayalamName: string;
  scientificName: string;
  family: string;
  category: string;
  description: string;
  traditionalUses: string;
  medicinalBenefits: string;
  plantPartsTraditionallyUsed: string;
  traditionalUsage: string;
  habitat: string;
  identification: string;
  image: string;
  arAvailable: boolean;
  model3D?: string;
  health: PlantHealth;
  culturalImportance?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'herbiq';
  text: string;
  timestamp: string;
  suggestedPlantId?: string;
}
