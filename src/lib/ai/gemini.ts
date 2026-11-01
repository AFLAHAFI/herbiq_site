import type { Lang, Plant, PlantScanData, PlantTranslation } from '../../types';
import {
  AIError,
  type AIProvider,
  type CatalogSummaryItem,
  type ChatOptions,
  type ChatTurn,
  type PlantID,
} from './provider';
import { DEFAULT_GEMINI_MODEL } from './key-storage';
import { buildPlantScanPrompt, buildPlantTranslationPrompt } from './prompts';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiProviderConfig {
  apiKey: string;
  model?: string;
  fetchFn?: typeof fetch;
}

function redactSecret(text: string, secret: string): string {
  if (!text) return '';
  if (!secret || secret.length < 4) return text;
  return text.split(secret).join('[REDACTED]');
}

function mapHttpError(status: number, bodyText: string, apiKey: string): AIError {
  const safeBody = redactSecret(bodyText, apiKey);
  if (status === 400 || status === 401 || status === 403) {
    if (
      status === 401 ||
      status === 403 ||
      /API_KEY_INVALID|invalid api key|key not valid|permission_denied|unauthenticated/i.test(safeBody)
    ) {
      return new AIError('INVALID_KEY', 'Invalid or unauthorized Gemini API key.', status);
    }
  }
  if (status === 429) {
    return new AIError('QUOTA_EXCEEDED', 'Gemini API quota or rate limit exceeded (429).', status);
  }
  return new AIError('API_ERROR', `Gemini API request failed with status ${status}.`, status);
}

function extractTextFromCandidate(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
}

export function parseAndValidateScanResult(
  rawText: string,
  validCatalogIds?: Set<string>
): PlantScanData {
  let cleaned = rawText.trim();
  // Strip optional markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AIError('PARSE_ERROR', 'Invalid JSON returned from plant scanner.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AIError('PARSE_ERROR', 'Scanner response must be a JSON object.');
  }
  if (typeof parsed.is_plant !== 'boolean') {
    throw new AIError('PARSE_ERROR', 'Scanner response missing boolean is_plant.');
  }
  if (typeof parsed.common_name !== 'string' || typeof parsed.scientific_name !== 'string') {
    throw new AIError('PARSE_ERROR', 'Scanner response missing plant names.');
  }
  const confidence = parsed.confidence;
  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') {
    throw new AIError('PARSE_ERROR', 'Scanner response has invalid confidence value.');
  }
  if (typeof parsed.short_info !== 'string' || typeof parsed.caution !== 'string') {
    throw new AIError('PARSE_ERROR', 'Scanner response missing short_info or caution.');
  }
  if (!Array.isArray(parsed.uses) || parsed.uses.some((u: unknown) => typeof u !== 'string')) {
    throw new AIError('PARSE_ERROR', 'Scanner response uses must be an array of strings.');
  }

  let matchedId: string | null =
    typeof parsed.matched_catalog_id === 'string' && parsed.matched_catalog_id.trim()
      ? parsed.matched_catalog_id.trim().toLowerCase()
      : null;

  if (matchedId && validCatalogIds && !validCatalogIds.has(matchedId)) {
    matchedId = null;
  }

  return {
    is_plant: parsed.is_plant,
    common_name: parsed.common_name.trim(),
    scientific_name: parsed.scientific_name.trim(),
    confidence,
    matched_catalog_id: matchedId,
    short_info: parsed.short_info.trim(),
    uses: parsed.uses.map((u: string) => u.trim()).filter(Boolean),
    caution: parsed.caution.trim(),
  };
}

export class GeminiProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GeminiProviderConfig) {
    this.apiKey = (config.apiKey || '').trim();
    this.model = (config.model || DEFAULT_GEMINI_MODEL).trim();
    this.fetchImpl = config.fetchFn || ((input, init) => fetch(input, init));
  }

  private ensureKey(): void {
    if (!this.apiKey) {
      throw new AIError('INVALID_KEY', 'Gemini API key is required.');
    }
  }

  private headers(): Record<string, string> {
    // Key is sent exclusively via header, never in URLs
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': this.apiKey,
    };
  }

  async *chat(messages: ChatTurn[], opts?: ChatOptions): AsyncIterable<string> {
    this.ensureKey();
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`;

    const contents = messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    };

    if (opts?.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: opts.systemInstruction }],
      };
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: opts?.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      throw new AIError(
        'NETWORK_ERROR',
        redactSecret(err instanceof Error ? err.message : 'Network error', this.apiKey)
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw mapHttpError(response.status, errText, this.apiKey);
    }

    if (!response.body) {
      const fullText = await response.text();
      const parsed = JSON.parse(fullText);
      const chunk = Array.isArray(parsed)
        ? parsed.map(extractTextFromCandidate).join('')
        : extractTextFromCandidate(parsed);
      if (chunk) yield chunk;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const payload = JSON.parse(dataStr);
            const textChunk = extractTextFromCandidate(payload);
            if (textChunk) yield textChunk;
          } catch {
            // Ignore partial or heartbeat lines
          }
        }
      }

      if (buffer.trim().startsWith('data:')) {
        const dataStr = buffer.trim().slice(5).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const payload = JSON.parse(dataStr);
            const textChunk = extractTextFromCandidate(payload);
            if (textChunk) yield textChunk;
          } catch {
            // Ignore
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async identifyPlant(
    imageDataUrl: string,
    lang: Lang,
    catalog: CatalogSummaryItem[] = []
  ): Promise<PlantID> {
    this.ensureKey();
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageDataUrl.trim());
    const mimeType = match ? match[1] : 'image/jpeg';
    const base64Data = match ? match[2] : imageDataUrl.trim();

    const url = `${GEMINI_API_BASE}/${encodeURIComponent(this.model)}:generateContent`;
    const prompt = buildPlantScanPrompt(lang, catalog);

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            is_plant: { type: 'BOOLEAN' },
            common_name: { type: 'STRING' },
            scientific_name: { type: 'STRING' },
            confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
            matched_catalog_id: { type: 'STRING', nullable: true },
            short_info: { type: 'STRING' },
            uses: { type: 'ARRAY', items: { type: 'STRING' } },
            caution: { type: 'STRING' },
          },
          required: [
            'is_plant',
            'common_name',
            'scientific_name',
            'confidence',
            'matched_catalog_id',
            'short_info',
            'uses',
            'caution',
          ],
        },
      },
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      throw new AIError(
        'NETWORK_ERROR',
        redactSecret(err instanceof Error ? err.message : 'Network error', this.apiKey)
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw mapHttpError(response.status, errText, this.apiKey);
    }

    const json = await response.json();
    const rawText = extractTextFromCandidate(json);
    const validIds = catalog.length > 0 ? new Set(catalog.map((c) => c.id)) : undefined;
    return parseAndValidateScanResult(rawText, validIds);
  }

  async testKey(): Promise<boolean> {
    if (!this.apiKey) return false;
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(this.model)}:generateContent`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }],
      generationConfig: { maxOutputTokens: 5 },
    };

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return false;
      }
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw mapHttpError(response.status, errText, this.apiKey);
      }
      return true;
    } catch (err) {
      if (err instanceof AIError && err.code === 'INVALID_KEY') return false;
      return false;
    }
  }

  async translatePlant(plant: Plant, targetLang: 'ar' | 'ml'): Promise<PlantTranslation> {
    this.ensureKey();
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(this.model)}:generateContent`;
    const prompt = buildPlantTranslationPrompt(plant, targetLang);

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            category: { type: 'STRING' },
            description: { type: 'STRING' },
            traditionalUses: { type: 'STRING' },
            medicinalBenefits: { type: 'STRING' },
            plantPartsTraditionallyUsed: { type: 'STRING' },
            traditionalUsage: { type: 'STRING' },
            habitat: { type: 'STRING' },
            identification: { type: 'STRING' },
            culturalImportance: { type: 'STRING' },
            uses: { type: 'ARRAY', items: { type: 'STRING' } },
            health: {
              type: 'OBJECT',
              properties: {
                issues: { type: 'STRING' },
                symptoms: { type: 'STRING' },
                prevention: { type: 'STRING' },
              },
              required: ['issues', 'symptoms', 'prevention'],
            },
          },
          required: [
            'name',
            'category',
            'description',
            'traditionalUses',
            'medicinalBenefits',
            'plantPartsTraditionallyUsed',
            'traditionalUsage',
            'habitat',
            'identification',
            'health',
          ],
        },
      },
    };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      throw new AIError(
        'NETWORK_ERROR',
        redactSecret(err instanceof Error ? err.message : 'Network error', this.apiKey)
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw mapHttpError(response.status, errText, this.apiKey);
    }

    const json = await response.json();
    const rawText = extractTextFromCandidate(json);
    try {
      return JSON.parse(rawText) as PlantTranslation;
    } catch {
      throw new AIError('PARSE_ERROR', 'Could not parse AI translation response.');
    }
  }
}
