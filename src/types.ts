export type Page = 'home' | 'plants' | 'ask' | 'ar' | 'about';

export interface IdentificationInfo {
  leaves?: string;
  flowers?: string;
  fruit?: string;
  stem?: string;
}

export interface Plant {
  id: string;
  name: string;
  malayalamName: string;
  scientificName: string;
  family: string;
  alternateNames: string[];
  category: string;
  shortDescription: string;
  description: string;
  identification: IdentificationInfo;
  traditionalKnowledge: string;
  plantPartsTraditionallyUsed: string[];
  habitat: string;
  nativeOrCommonRegion: string;
  cultivation: string;
  safety: string;
  image: string;
  arAvailable: boolean;
  model3D?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'herbiq';
  text: string;
  timestamp: string;
  suggestedPlantId?: string;
}
