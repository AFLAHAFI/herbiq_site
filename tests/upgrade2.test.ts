import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import en from '../src/i18n/locales/en.json';
import ml from '../src/i18n/locales/ml.json';
import ar from '../src/i18n/locales/ar.json';
import {
  applyDocumentLang,
  detectInitialLang,
  getDirection,
  getLocalizedPlant,
  translate,
} from '../src/i18n';
import {
  PLANTS,
  findPlantInQuestion,
  normalizeArabic,
  searchPlants,
} from '../src/data/plants';
import { validatePlant, validateTranslations } from '../src/lib/plant-validation';
import { GeminiProvider, parseAndValidateScanResult } from '../src/lib/ai/gemini';
import { AIError } from '../src/lib/ai/provider';
import {
  getStoredApiKey,
  removeApiKey,
  saveApiKey,
} from '../src/lib/ai/key-storage';
import { refreshCatalog } from '../src/lib/catalog';

function collectLeafKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

test('i18n: every key in en.json exists in ml.json and ar.json with non-empty values', () => {
  const enKeys = collectLeafKeys(en);
  const mlKeys = collectLeafKeys(ml);
  const arKeys = collectLeafKeys(ar);

  assert.deepEqual(mlKeys, enKeys, 'ml.json keys must match en.json keys');
  assert.deepEqual(arKeys, enKeys, 'ar.json keys must match en.json keys');

  for (const key of enKeys) {
    assert.ok(translate('en', key).trim().length > 0, `Empty en key: ${key}`);
    assert.ok(translate('ml', key).trim().length > 0, `Empty ml key: ${key}`);
    assert.ok(translate('ar', key).trim().length > 0, `Empty ar key: ${key}`);
  }
});

test('RTL: dir switches to rtl for ar and ltr for en/ml, plus URL and storage detection', () => {
  assert.equal(getDirection('ar'), 'rtl');
  assert.equal(getDirection('en'), 'ltr');
  assert.equal(getDirection('ml'), 'ltr');

  const fakeDoc = { documentElement: { lang: 'en', dir: 'ltr' } } as unknown as Document;
  applyDocumentLang('ar', fakeDoc);
  assert.equal(fakeDoc.documentElement.lang, 'ar');
  assert.equal(fakeDoc.documentElement.dir, 'rtl');

  applyDocumentLang('ml', fakeDoc);
  assert.equal(fakeDoc.documentElement.lang, 'ml');
  assert.equal(fakeDoc.documentElement.dir, 'ltr');

  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  assert.equal(detectInitialLang({ hash: '#page=plants&lang=ar', storage: mockStorage }), 'ar');
  assert.equal(mem.get('herbiq.lang'), 'ar');
  assert.equal(detectInitialLang({ hash: '#page=home', storage: mockStorage }), 'ar');
  assert.equal(detectInitialLang({ hash: '', storage: null, navigatorLang: 'ml-IN' }), 'ml');
  assert.equal(detectInitialLang({ hash: '', storage: null, navigatorLang: 'ar-SA' }), 'ar');
  assert.equal(detectInitialLang({ hash: '', storage: null, navigatorLang: 'fr-FR' }), 'en');

  // Plant fallback when Arabic translation is missing
  const strippedPlant = { ...PLANTS[0], translations: {} };
  const localized = getLocalizedPlant(strippedPlant, 'ar');
  assert.equal(localized.name, strippedPlant.name);
  assert.equal(localized.description, strippedPlant.description);
});

test('Arabic search normalisation: strips tashkeel and unifies Alef, Teh Marbuta, and Alef Maksura', () => {
  // Tashkeel + Alef with hamza + Teh Marbuta + Alef Maksura
  assert.equal(normalizeArabic('أَلْأَشْوَاغَانْدَا'), normalizeArabic('الاشواغاندا'));
  assert.equal(normalizeArabic('إِكْسُورَا'), normalizeArabic('اكسورا'));
  assert.equal(normalizeArabic('آلُوفِيرَا'), normalizeArabic('الوفيرا'));
  assert.equal(normalizeArabic('قرفة'), normalizeArabic('قرفه'));
  assert.equal(normalizeArabic('مقهى'), normalizeArabic('مقهي'));

  // Search plants in Arabic with different spelling/diacritic forms
  assert.equal(searchPlants('تولسي')[0]?.id, 'tulsi');
  assert.equal(searchPlants('الريحان المقدس')[0]?.id, 'tulsi');
  assert.equal(searchPlants('النيم')[0]?.id, 'neem');
  assert.equal(searchPlants('الألوفيرا')[0]?.id, 'aloe-vera');
  assert.equal(searchPlants('الالوفيرا')[0]?.id, 'aloe-vera');
  assert.equal(searchPlants('الكركم')[0]?.id, 'turmeric');
  assert.equal(searchPlants('قرفه')[0]?.id, 'cinnamon');

  // Natural language question matching in Arabic
  assert.equal(findPlantInQuestion('ما هو نبات التولسي؟')?.id, 'tulsi');
  assert.equal(findPlantInQuestion('كيف أتعرف على النيم؟')?.id, 'neem');
});

test('translations column validation in plant-validation.ts and 003_i18n.sql database trigger', async () => {
  for (const p of PLANTS) {
    assert.equal(validatePlant(p), p);
    assert.ok(p.translations?.ar?.name, `Missing Arabic name on ${p.id}`);
  }

  assert.throws(() => validateTranslations('not-an-object'));
  assert.throws(() => validateTranslations([]));
  assert.throws(() => validateTranslations({ INVALID_LANG_KEY_123: { name: 'test' } }));
  assert.throws(() => validateTranslations({ ar: 'not-an-object' }));
  assert.throws(() => validateTranslations({ ar: { name: 123 as any } }));
  assert.throws(() => validateTranslations({ ar: { name: 'x'.repeat(5001) } }));
  assert.throws(() => validateTranslations({ ar: { uses: ['valid', 123 as any] } }));

  // Test 003_i18n.sql migration in PGlite: CHECK constraint, RLS, and revision bump on translation update
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id text primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
      insert into auth.users values ('11111111-1111-1111-1111-111111111111');`);
    await db.exec(readFileSync('supabase/001_schema.sql', 'utf8'));
    await db.exec(readFileSync('supabase/002_seed.sql', 'utf8'));
    await db.exec(readFileSync('supabase/003_i18n.sql', 'utf8'));
    await db.exec(`insert into herbiq_private.admins values ('11111111-1111-1111-1111-111111111111');`);

    // Anonymous cannot update translations
    await db.exec('set role anon;');
    await assert.rejects(
      db.exec(`update public.herbiq_plants set translations = '{"ar":{"name":"تولسي"}}'::jsonb where id = 'tulsi'`)
    );

    // Admin can update translations and revision bumps from 1 to 2
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false); set role authenticated;`);
    const updated = await db.query<{ revision: number; translations: any }>(
      `update public.herbiq_plants set translations = $1::jsonb where id = 'tulsi' returning revision, translations`,
      [JSON.stringify({ ar: { name: 'الريحان المقدس / تولسي', description: 'وصف تعليمي' } })]
    );
    assert.equal(updated.rows[0].revision, 2);
    assert.equal(updated.rows[0].translations.ar.name, 'الريحان المقدس / تولسي');

    // Invalid translations type (array) is rejected by constraint/trigger
    await assert.rejects(
      db.query(`update public.herbiq_plants set translations = '[]'::jsonb where id = 'tulsi'`)
    );
  } finally {
    await db.close();
  }
});

test('AI provider: streaming chat, 401 invalid key, 429 quota, and scanner JSON parse + bad JSON', async () => {
  const secretKey = 'AIzaSyTestSecretKeyNeverLeak12345';
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};

  // 1. Streaming chat
  const sseBody = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Tulsi is an "}]}}]}\n\n',
    'data: {"candidates":[{"content":{"parts":[{"text":"aromatic herb [PLANT:tulsi]."}]}}]}\n\n',
    'data: [DONE]\n\n',
  ].join('');

  const streamProvider = new GeminiProvider({
    apiKey: secretKey,
    fetchFn: async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseBody));
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    },
  });

  const chunks: string[] = [];
  for await (const chunk of streamProvider.chat([{ role: 'user', content: 'What is Tulsi?' }])) {
    chunks.push(chunk);
  }
  assert.equal(chunks.join(''), 'Tulsi is an aromatic herb [PLANT:tulsi].');
  assert.ok(!capturedUrl.includes(secretKey), 'API key must never appear in request URL');
  assert.equal(capturedHeaders['x-goog-api-key'], secretKey);

  // 2. 401 Invalid Key
  const invalidKeyProvider = new GeminiProvider({
    apiKey: secretKey,
    fetchFn: async () =>
      new Response(JSON.stringify({ error: { message: `Invalid key ${secretKey}` } }), { status: 401 }),
  });

  await assert.rejects(
    async () => {
      for await (const _ of invalidKeyProvider.chat([{ role: 'user', content: 'Hi' }])) {
        // consume
      }
    },
    (err: any) => {
      assert.ok(err instanceof AIError);
      assert.equal(err.code, 'INVALID_KEY');
      assert.ok(!err.message.includes(secretKey), 'Error message must never contain API key');
      return true;
    }
  );

  // 3. 429 Quota Exceeded
  const quotaProvider = new GeminiProvider({
    apiKey: secretKey,
    fetchFn: async () => new Response('Quota exceeded', { status: 429 }),
  });

  await assert.rejects(
    async () => {
      for await (const _ of quotaProvider.chat([{ role: 'user', content: 'Hi' }])) {
        // consume
      }
    },
    (err: any) => err instanceof AIError && err.code === 'QUOTA_EXCEEDED'
  );

  // 4. Scanner valid JSON + bad JSON
  const validScanJson = JSON.stringify({
    is_plant: true,
    common_name: 'Holy Basil / Tulsi',
    scientific_name: 'Ocimum tenuiflorum',
    confidence: 'high',
    matched_catalog_id: 'tulsi',
    short_info: 'Aromatic medicinal herb.',
    uses: ['Traditional herbal tea', 'Respiratory comfort traditions'],
    caution: 'Educational only; consult a qualified practitioner.',
  });

  const scanProvider = new GeminiProvider({
    apiKey: secretKey,
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: validScanJson }] } }],
        }),
        { status: 200 }
      ),
  });

  const scanResult = await scanProvider.identifyPlant('data:image/jpeg;base64,AA==', 'en', [
    { id: 'tulsi', name: 'Tulsi', scientificName: 'Ocimum tenuiflorum' },
  ]);
  assert.equal(scanResult.is_plant, true);
  assert.equal(scanResult.matched_catalog_id, 'tulsi');
  assert.equal(scanResult.confidence, 'high');

  // Bad JSON throws PARSE_ERROR
  assert.throws(
    () => parseAndValidateScanResult('not valid json {{{'),
    (err: any) => err instanceof AIError && err.code === 'PARSE_ERROR'
  );
  assert.throws(
    () => parseAndValidateScanResult(JSON.stringify({ is_plant: 'yes' })),
    (err: any) => err instanceof AIError && err.code === 'PARSE_ERROR'
  );

  // 5. Automatic 404 model fallback (e.g. gemini-2.5-flash deprecated for new keys -> falls back to gemini-flash-latest)
  const triedUrls: string[] = [];
  const fallbackProvider = new GeminiProvider({
    apiKey: secretKey,
    model: 'gemini-2.5-flash',
    fetchFn: async (input) => {
      const url = String(input);
      triedUrls.push(url);
      if (url.includes('gemini-2.5-flash')) {
        return new Response(
          JSON.stringify({ error: { code: 404, message: 'Model no longer available to new users' } }),
          { status: 404 }
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'internal reasoning', thought: true },
                  { text: validScanJson },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      );
    },
  });

  const fallbackScan = await fallbackProvider.identifyPlant('data:image/jpeg;base64,AA==', 'en', [
    { id: 'tulsi', name: 'Tulsi', scientificName: 'Ocimum tenuiflorum' },
  ]);
  assert.equal(fallbackScan.matched_catalog_id, 'tulsi');
  assert.ok(triedUrls.length >= 2, 'Should retry with fallback model on 404');
  assert.ok(triedUrls[1].includes('gemini-flash-latest'));
});

test('Key safety: Gemini API key is isolated and never sent in any Supabase request', async () => {
  const secretKey = 'AIzaSyIsolatedBrowserKey999999';
  const localMem = new Map<string, string>();
  const sessionMem = new Map<string, string>();
  const mockLocal = {
    getItem: (k: string) => localMem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      localMem.set(k, v);
    },
    removeItem: (k: string) => {
      localMem.delete(k);
    },
  };
  const mockSession = {
    getItem: (k: string) => sessionMem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      sessionMem.set(k, v);
    },
    removeItem: (k: string) => {
      sessionMem.delete(k);
    },
  };

  // Default: session only
  saveApiKey(secretKey, false, { localStorage: mockLocal, sessionStorage: mockSession });
  assert.equal(sessionMem.get('herbiq.gemini.key.session'), secretKey);
  assert.equal(localMem.get('herbiq.gemini.key'), undefined);
  assert.equal(getStoredApiKey({ localStorage: mockLocal, sessionStorage: mockSession }), secretKey);

  // Remember on device
  saveApiKey(secretKey, true, { localStorage: mockLocal, sessionStorage: mockSession });
  assert.equal(localMem.get('herbiq.gemini.key'), secretKey);
  assert.equal(sessionMem.get('herbiq.gemini.key.session'), undefined);

  // Spy on global fetch while running catalog refresh / Supabase operations
  const originalFetch = globalThis.fetch;
  const outboundRequests: { url: string; headers: string; body: string }[] = [];
  globalThis.fetch = async (input: any, init?: any) => {
    outboundRequests.push({
      url: String(input),
      headers: JSON.stringify(init?.headers || {}),
      body: String(init?.body || ''),
    });
    return new Response(JSON.stringify([]), { status: 200 });
  };

  try {
    await refreshCatalog();
    for (const req of outboundRequests) {
      assert.ok(!req.url.includes(secretKey), 'Supabase URL must never contain Gemini key');
      assert.ok(!req.headers.includes(secretKey), 'Supabase headers must never contain Gemini key');
      assert.ok(!req.body.includes(secretKey), 'Supabase body must never contain Gemini key');
    }
  } finally {
    globalThis.fetch = originalFetch;
    removeApiKey({ localStorage: mockLocal, sessionStorage: mockSession });
  }
});
