import type { Lang, Plant, PlantScanData, PlantTranslation } from '../../types';

export type AIErrorCode =
  | 'INVALID_KEY'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'API_ERROR';

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly status?: number;

  constructor(code: AIErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
  }
}

export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

export interface ChatOptions {
  systemInstruction?: string;
  lang?: Lang;
  signal?: AbortSignal;
}

export type PlantID = PlantScanData;

export interface CatalogSummaryItem {
  id: string;
  name: string;
  scientificName: string;
  malayalamName?: string;
  arabicName?: string;
  category?: string;
  shortUses?: string;
}

export interface AIProvider {
  chat(messages: ChatTurn[], opts?: ChatOptions): AsyncIterable<string>;
  identifyPlant(
    imageDataUrl: string,
    lang: Lang,
    catalog?: CatalogSummaryItem[]
  ): Promise<PlantID>;
  testKey(): Promise<boolean>;
  translatePlant?(plant: Plant, targetLang: 'ar' | 'ml'): Promise<PlantTranslation>;
}
