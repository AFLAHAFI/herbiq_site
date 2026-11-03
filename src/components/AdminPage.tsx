import React, { useEffect, useMemo, useState } from 'react';
import { backend, errorText } from '../lib/backend';
import {
  listAdminPlants,
  savePlant,
  deletePlant,
  uploadPhoto,
  uploadModel3D,
  uploadPdf,
  requireAdmin,
  type PlantRow,
} from '../lib/admin-api';
import { emptyPlant, PROFILE_FIELDS, TRANSLATABLE_STRING_FIELDS } from '../lib/plant-validation';
import { computeAdminAnalytics } from '../lib/analytics';
import { downloadPlantPdfFile, printPlantInfoCard } from '../lib/plant-pdf';
import { getStoredApiKey, getStoredModel } from '../lib/ai/key-storage';
import { GeminiProvider } from '../lib/ai/gemini';
import { useI18n } from '../i18n';
import type { Lang, Plant, PlantTranslation } from '../types';
import { QRLabels } from './QRLabels';
import { BulkImportPanel, exportCatalogSpreadsheet } from './BulkImportPanel';

export function AdminPage({ onChanged }: { onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PlantRow[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Plant | null>(null);
  const [original, setOriginal] = useState<PlantRow | null>(null);
  const [published, setPublished] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [labels, setLabels] = useState<Plant[] | null>(null);
  const [editLang, setEditLang] = useState<Lang>('en');
  const [translating, setTranslating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  const load = async () => {
    const next = await listAdminPlants();
    setRows(next);
    setSelected((s) => s.filter((id) => next.some((p) => p.id === id)));
  };

  useEffect(() => {
    if (!backend) {
      setChecking(false);
      return;
    }
    let alive = true;
    let generation = 0;
    const verify = async () => {
      const current = ++generation;
      try {
        const { data, error } = await backend.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          if (alive && current === generation) {
            setAuthorized(false);
            setRows([]);
            setDraft(null);
            setLabels(null);
            setPassword('');
          }
          return;
        }
        await requireAdmin();
        const list = await listAdminPlants();
        if (alive && current === generation) {
          setRows(list);
          setAuthorized(true);
        }
      } catch (e) {
        if (alive && current === generation) {
          setAuthorized(false);
          setRows([]);
          setDraft(null);
          setLabels(null);
          setError(errorText(e));
        }
      } finally {
        if (alive && current === generation) setChecking(false);
      }
    };
    void verify();
    const { data } = backend.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (alive) void verify();
      }, 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const edit = (row?: PlantRow) => {
    setOriginal(row || null);
    setDraft(row ? structuredClone(row.profile) : emptyPlant());
    setPublished(row?.published || false);
    setEditLang('en');
    setError('');
    setNotice('');
  };

  const updateTranslationField = (langKey: 'ar' | 'ml', field: keyof PlantTranslation, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const existingLang = prev.translations?.[langKey] || {};
      const nextTranslations = {
        ...(prev.translations || {}),
        [langKey]: {
          ...existingLang,
          [field]: value,
        },
      };
      return {
        ...prev,
        ...(langKey === 'ml' && field === 'name' && value.trim() ? { malayalamName: value } : {}),
        translations: nextTranslations,
      };
    });
  };

  const updateTranslationHealthField = (
    langKey: 'ar' | 'ml',
    field: 'issues' | 'symptoms' | 'prevention',
    value: string
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const existingLang = prev.translations?.[langKey] || {};
      const existingHealth = existingLang.health || {};
      return {
        ...prev,
        translations: {
          ...(prev.translations || {}),
          [langKey]: {
            ...existingLang,
            health: {
              ...existingHealth,
              [field]: value,
            },
          },
        },
      };
    });
  };

  const handleTranslateWithAI = async (targetLang: 'ar' | 'ml') => {
    if (!draft || translating || busy) return;
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      setError(t('admin.translateNeedKey'));
      return;
    }
    setTranslating(true);
    setError('');
    setNotice('');
    try {
      const provider = new GeminiProvider({ apiKey, model: getStoredModel() });
      const translated = await provider.translatePlant(draft, targetLang);
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          translations: {
            ...(prev.translations || {}),
            [targetLang]: {
              ...(prev.translations?.[targetLang] || {}),
              ...translated,
            },
          },
        };
      });
      setNotice(t('admin.translateDraftNotice'));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setTranslating(false);
    }
  };

  const analytics = useMemo(() => computeAdminAnalytics(rows), [rows]);

  if (!backend) {
    return (
      <div className="admin-page">
        <h1>{t('admin.setupRequiredTitle')}</h1>
        <p>{t('admin.setupRequiredBody1')}</p>
        <p>{t('admin.setupRequiredBody2')}</p>
      </div>
    );
  }
  if (checking) {
    return (
      <p className="p-10" role="status">
        {t('admin.checkingSession')}
      </p>
    );
  }

  const messages = (
    <>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admin-notice">
          {notice}
        </p>
      )}
    </>
  );

  if (!authorized) {
    return (
      <div className="admin-page max-w-lg">
        <h1>{t('admin.loginTitle')}</h1>
        <p>{t('admin.loginSubtitle')}</p>
        {messages}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { error } = await backend.auth.signInWithPassword({ email: email.trim(), password });
              if (error) throw error;
              setPassword('');
              await requireAdmin();
              await load();
              setAuthorized(true);
            });
          }}
        >
          <label>
            {t('admin.email')}
            <input required type="email" dir="ltr" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            {t('admin.password')}
            <input required type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button disabled={busy}>{busy ? t('admin.signingIn') : t('admin.signIn')}</button>
        </form>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await backend.auth.signOut();
              setAuthorized(false);
              setRows([]);
              setNotice(t('admin.signedOut'));
            })
          }
        >
          {t('admin.clearSession')}
        </button>
      </div>
    );
  }

  const activeTranslation: PlantTranslation =
    editLang !== 'en' && draft ? draft.translations?.[editLang] || {} : {};

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <h1>{t('admin.heading')}</h1>
          <p>{t('admin.stats', { total: rows.length, published: rows.filter((r) => r.published).length })}</p>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const { error } = await backend.auth.signOut();
              if (error) throw error;
              setAuthorized(false);
              setRows([]);
              setDraft(null);
              setLabels(null);
            })
          }
        >
          {t('admin.signOut')}
        </button>
      </div>
      {messages}
      {draft ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const saved = await savePlant(draft, published, original?.revision);
              setOriginal(saved);
              setDraft(structuredClone(saved.profile));
              await load();
              await onChanged();
              setNotice(t('admin.plantSavedNotice'));
            });
          }}
        >
          <div className="admin-heading">
            <h2>{original ? t('admin.editPlant') : t('admin.addPlant')}</h2>
            <button type="button" disabled={busy} onClick={() => setDraft(null)}>
              {t('admin.backToList')}
            </button>
          </div>

          {/* Language Tabs */}
          <div className="admin-actions" role="tablist" aria-label="Plant translation languages">
            {(
              [
                ['en', t('admin.langTabEn')],
                ['ml', t('admin.langTabMl')],
                ['ar', t('admin.langTabAr')],
              ] as const
            ).map(([code, label]) => (
              <button
                key={code}
                type="button"
                role="tab"
                id={`admin-lang-tab-${code}`}
                aria-selected={editLang === code}
                onClick={() => setEditLang(code)}
                style={
                  editLang === code
                    ? { background: '#00e5ff', color: '#060b18', fontWeight: 700 }
                    : undefined
                }
              >
                {label}
              </button>
            ))}

            {editLang !== 'en' && (
              <button
                type="button"
                id="admin-translate-ai-btn"
                disabled={busy || translating || !getStoredApiKey()}
                title={!getStoredApiKey() ? t('admin.translateNeedKey') : undefined}
                onClick={() => void handleTranslateWithAI(editLang)}
              >
                {translating ? t('admin.translating') : t('admin.translateWithAI')}
              </button>
            )}
          </div>

          <fieldset disabled={busy || translating}>
            {editLang === 'en' ? (
              <div className="admin-fields">
                <label>
                  {t('admin.stableId')}
                  <input
                    required
                    disabled={!!original}
                    dir="ltr"
                    value={draft.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      setDraft({ ...draft, id, herbiqId: `HERBIQ:${id}` });
                    }}
                  />
                  <small>{t('admin.stableIdHint')}</small>
                </label>
                <label>
                  {t('admin.qrId')}
                  <input required dir="ltr" value={draft.herbiqId} onChange={(e) => setDraft({ ...draft, herbiqId: e.target.value })} />
                  <small>{t('admin.qrIdHint')}</small>
                </label>
                {PROFILE_FIELDS.map(([key, label], index) => (
                  <label key={key}>
                    {label}
                    {index < 5 ? (
                      <input required value={draft[key] || ''} maxLength={5000} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
                    ) : (
                      <textarea
                        rows={3}
                        required={key !== 'culturalImportance'}
                        maxLength={5000}
                        value={draft[key] || ''}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      />
                    )}
                  </label>
                ))}
                {(['issues', 'symptoms', 'prevention'] as const).map((key) => (
                  <label key={key}>
                    Plant health — {key}
                    <textarea
                      required
                      rows={3}
                      maxLength={5000}
                      value={draft.health[key]}
                      onChange={(e) => setDraft({ ...draft, health: { ...draft.health, [key]: e.target.value } })}
                    />
                  </label>
                ))}
                <label>
                  {t('admin.photoUrl')}
                  <input required dir="ltr" value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} />
                </label>
                <label>
                  {t('admin.uploadPhoto')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void run(async () => {
                          const image = await uploadPhoto(file);
                          setDraft((d) => (d ? { ...d, image } : d));
                          setNotice(t('admin.photoUploadedNotice'));
                        });
                    }}
                  />
                  <small>{t('admin.uploadPhotoHint')}</small>
                </label>
                <label>
                  {t('admin.modelUrl')}
                  <input dir="ltr" value={draft.model3D || ''} onChange={(e) => setDraft({ ...draft, model3D: e.target.value })} />
                </label>
                <label>
                  {t('admin.uploadModel')}
                  <input
                    type="file"
                    accept=".glb,model/gltf-binary"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void run(async () => {
                          const model3D = await uploadModel3D(file);
                          setDraft((d) => (d ? { ...d, model3D, arAvailable: true } : d));
                          setNotice(t('admin.modelUploadedNotice'));
                        });
                    }}
                  />
                  <small>{t('admin.uploadModelHint')}</small>
                </label>
                <label>
                  PDF Data Sheet URL (optional)
                  <input
                    dir="ltr"
                    placeholder="https://... or /assets/..."
                    value={draft.pdfUrl || ''}
                    onChange={(e) => setDraft({ ...draft, pdfUrl: e.target.value })}
                  />
                </label>
                <label>
                  Upload Custom Plant PDF (.pdf)
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void run(async () => {
                          const pdfUrl = await uploadPdf(file);
                          setDraft((d) => (d ? { ...d, pdfUrl } : d));
                          setNotice('PDF document uploaded. Save the plant to publish it.');
                        });
                    }}
                  />
                  <small>Optional custom PDF brochure (up to 20 MB). Every plant also gets an automatic PDF Info Card.</small>
                </label>
              </div>
            ) : (
              <div className="admin-fields" dir={editLang === 'ar' ? 'rtl' : 'ltr'} lang={editLang}>
                {TRANSLATABLE_STRING_FIELDS.map(([key, label], index) => (
                  <label key={key}>
                    {label} ({editLang.toUpperCase()})
                    {index < 2 ? (
                      <input
                        value={(activeTranslation[key] as string) || ''}
                        maxLength={5000}
                        placeholder={draft[key as keyof Plant] as string}
                        onChange={(e) => updateTranslationField(editLang, key, e.target.value)}
                      />
                    ) : (
                      <textarea
                        rows={3}
                        maxLength={5000}
                        value={(activeTranslation[key] as string) || ''}
                        placeholder={(draft[key as keyof Plant] as string) || ''}
                        onChange={(e) => updateTranslationField(editLang, key, e.target.value)}
                      />
                    )}
                  </label>
                ))}
                {(['issues', 'symptoms', 'prevention'] as const).map((key) => (
                  <label key={key}>
                    Translated health — {key} ({editLang.toUpperCase()})
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={activeTranslation.health?.[key] || ''}
                      placeholder={draft.health[key]}
                      onChange={(e) => updateTranslationHealthField(editLang, key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}

            {draft.image && <img className="admin-photo" src={draft.image} alt="Plant photo preview" />}
            <label className="admin-check">
              <input type="checkbox" checked={draft.arAvailable} onChange={(e) => setDraft({ ...draft, arAvailable: e.target.checked })} />
              {t('admin.enableAr')}
            </label>
            <label className="admin-check">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              {t('admin.publishPlant')}
            </label>
            <button type="submit">{busy ? t('admin.saving') : t('admin.savePlant')}</button>
          </fieldset>
        </form>
      ) : (
        <>
          <div className="admin-actions">
            <button disabled={busy} onClick={() => edit()}>
              {t('admin.addPlant')}
            </button>
            <button
              type="button"
              id="admin-bulk-upload-btn"
              disabled={busy}
              onClick={() => setBulkOpen((v) => !v)}
              style={{ background: '#00e5ff', color: '#060b18', fontWeight: 700 }}
            >
              📁 {t('admin.bulkUploadBtn')}
            </button>
            <button
              type="button"
              id="admin-analytics-toggle-btn"
              disabled={busy}
              onClick={() => setAnalyticsOpen((v) => !v)}
            >
              📊 {analyticsOpen ? 'Hide Analytics' : 'Show Analytics'}
            </button>
            <button disabled={busy} onClick={() => void run(load)}>
              {t('admin.refresh')}
            </button>
            <button
              disabled={!selected.length || busy}
              onClick={() => setLabels(rows.filter((r) => selected.includes(r.id)).map((r) => r.profile))}
            >
              {t('admin.printSelected', { count: selected.length })}
            </button>
            <button
              type="button"
              id="admin-export-xlsx-btn"
              disabled={!rows.length || busy}
              onClick={() => exportCatalogSpreadsheet(rows, 'xlsx')}
            >
              ⬇ {t('admin.bulkExportXlsx')}
            </button>
            <button
              type="button"
              id="admin-export-csv-btn"
              disabled={!rows.length || busy}
              onClick={() => exportCatalogSpreadsheet(rows, 'csv')}
            >
              ⬇ {t('admin.bulkExportCsv')}
            </button>
          </div>

          {/* Admin Analytics & QR Scan Counter Dashboard */}
          {analyticsOpen && (
            <section
              aria-label="Admin Analytics & QR Scan Counter"
              id="admin-analytics-panel"
              className="p-4 sm:p-5 rounded-2xl bg-[#0b142b] border border-[#00e5ff]/30 space-y-4 my-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">📊 HerbiQ Analytics &amp; QR Scan Insights</h2>
                  <p className="text-xs text-slate-400">
                    Real-time catalog readiness, multi-language coverage, and QR scan / plant view engagement
                  </p>
                </div>
                {analytics.pendingOfflineEvents > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 text-xs font-semibold">
                    ⚡ {analytics.pendingOfflineEvents} offline events queued
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Total Plants</span>
                  <strong className="text-xl text-cyan-300">{analytics.totalPlants}</strong>
                  <span className="text-[11px] text-emerald-400 block">
                    {analytics.publishedCount} published · {analytics.hiddenCount} hidden
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">QR Code Scans</span>
                  <strong className="text-xl text-emerald-300">{analytics.totalQrScans}</strong>
                  <span className="text-[11px] text-slate-400 block">Camera &amp; code lookups</span>
                </div>

                <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Plant Page Views</span>
                  <strong className="text-xl text-amber-300">{analytics.totalViews}</strong>
                  <span className="text-[11px] text-slate-400 block">Detail sheet visits</span>
                </div>

                <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">3D / AR Models</span>
                  <strong className="text-xl text-cyan-300">{analytics.modelsCount}</strong>
                  <span className="text-[11px] text-slate-400 block">Interactive .glb assets</span>
                </div>

                <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">PDF Data Sheets</span>
                  <strong className="text-xl text-emerald-300">{analytics.totalPlants}</strong>
                  <span className="text-[11px] text-slate-400 block">
                    {analytics.customPdfCount} custom .pdf + 100% auto
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Languages (ML / AR)</span>
                  <strong className="text-xl text-amber-300">
                    {analytics.mlCount} / {analytics.arCount}
                  </strong>
                  <span className="text-[11px] text-slate-400 block">Malayalam &amp; Arabic ready</span>
                </div>
              </div>

              {analytics.topPlants.some((p) => p.totalInteractions > 0) && (
                <div className="pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
                    Top Scanned &amp; Viewed Plants
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {analytics.topPlants
                      .filter((p) => p.totalInteractions > 0)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-[#060b18] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <strong className="text-white block truncate">{item.name}</strong>
                            <span className="text-amber-300 text-[11px]" lang="ml">
                              {item.malayalamName}
                            </span>
                          </div>
                          <div className="text-end shrink-0">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-semibold block">
                              {item.qrScans} QR · {item.views} views
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {bulkOpen && (
            <BulkImportPanel
              existingRows={rows}
              onClose={() => setBulkOpen(false)}
              onCompleted={async () => {
                await load();
                await onChanged();
              }}
            />
          )}
          <label>
            {t('admin.searchPlants')}
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('admin.searchPlaceholder')} />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={!!rows.length && selected.length === rows.length}
              onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
            />
            {t('admin.selectAll')}
          </label>
          <div className="admin-list">
            {rows
              .filter((r) =>
                [r.profile.name, r.profile.malayalamName, r.profile.translations?.ar?.name || '', r.qr_id].some((v) =>
                  v.toLowerCase().includes(query.toLowerCase())
                )
              )
              .map((row) => (
                <article key={row.id} className="admin-row">
                  <input
                    aria-label={`Select ${row.profile.name}`}
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, row.id] : s.filter((id) => id !== row.id)))}
                  />
                  <div>
                    <strong>{row.profile.name}</strong>
                    <p>
                      <span lang="ml">{row.profile.malayalamName}</span>
                      {row.profile.translations?.ar?.name && (
                        <>
                          {' '}· <span lang="ar" dir="rtl">{row.profile.translations.ar.name}</span>
                        </>
                      )}{' '}
                      · <bdi dir="ltr">{row.qr_id}</bdi>
                    </p>
                    <span>
                      {row.published ? t('admin.published') : t('admin.hidden')}
                      {row.profile.model3D ? ' · 🧊 3D' : ''}
                      {row.profile.pdfUrl ? ' · 📄 Custom PDF' : ' · 📄 Auto PDF'}
                    </span>
                  </div>
                  <div className="admin-actions">
                    <button disabled={busy} onClick={() => edit(row)}>
                      {t('admin.edit')}
                    </button>
                    <button onClick={() => setLabels([row.profile])}>{t('admin.qrLabel')}</button>
                    <button
                      type="button"
                      onClick={() => void downloadPlantPdfFile(row.profile)}
                    >
                      📄 PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void printPlantInfoCard(row.profile)}
                    >
                      🖨 Info Card
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (confirm(t('admin.deleteConfirm', { name: row.profile.name })))
                          void run(async () => {
                            await deletePlant(row);
                            await load();
                            await onChanged();
                            setNotice(t('admin.plantDeletedNotice'));
                          });
                      }}
                    >
                      {t('admin.delete')}
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!rows.length && <p>{t('admin.noPlantsYet')}</p>}
        </>
      )}
      {labels && <QRLabels plants={labels} onClose={() => setLabels(null)} />}
    </div>
  );
}
