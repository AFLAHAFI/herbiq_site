export type Page = 'home' | 'plants' | 'ask' | 'ar' | 'about' | 'scan' | 'admin';

export type Lang = 'en' | 'ml' | 'ar';

export interface PlantHealth {
  issues: string;
  symptoms: string;
  prevention: string;
}

export interface PlantTranslation {
  name?: string;
  category?: string;
  description?: string;
  traditionalUses?: string;
  medicinalBenefits?: string;
  plantPartsTraditionallyUsed?: string;
  traditionalUsage?: string;
  habitat?: string;
  identification?: string;
  culturalImportance?: string;
  uses?: string[];
  health?: Partial<PlantHealth>;
}

export type PlantTranslations = Partial<Record<Lang | string, PlantTranslation>>;

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
  translations?: PlantTranslations;
}

export interface PlantScanData {
  is_plant: boolean;
  common_name: string;
  scientific_name: string;
  confidence: 'high' | 'medium' | 'low';
  matched_catalog_id: string | null;
  short_info: string;
  uses: string[];
  caution: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'herbiq';
  text: string;
  timestamp: string;
  suggestedPlantId?: string;
  suggestedPlantIds?: string[];
  isAI?: boolean;
  isStreaming?: boolean;
  photoDataUrl?: string;
  scanResult?: PlantScanData;
}
