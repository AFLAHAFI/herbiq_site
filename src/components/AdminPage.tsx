import React, { useEffect, useState } from 'react';
import { backend, errorText } from '../lib/backend';
import { listAdminPlants, savePlant, deletePlant, uploadPhoto, requireAdmin, type PlantRow } from '../lib/admin-api';
import { emptyPlant, PROFILE_FIELDS, TRANSLATABLE_STRING_FIELDS } from '../lib/plant-validation';
import { getStoredApiKey, getStoredModel } from '../lib/ai/key-storage';
import { GeminiProvider } from '../lib/ai/gemini';
import { useI18n } from '../i18n';
import type { Lang, Plant, PlantTranslation } from '../types';
import { QRLabels } from './QRLabels';

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
            <button disabled={busy} onClick={() => void run(load)}>
              {t('admin.refresh')}
            </button>
            <button
              disabled={!selected.length || busy}
              onClick={() => setLabels(rows.filter((r) => selected.includes(r.id)).map((r) => r.profile))}
            >
              {t('admin.printSelected', { count: selected.length })}
            </button>
          </div>
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
                    <span>{row.published ? t('admin.published') : t('admin.hidden')}</span>
                  </div>
                  <div className="admin-actions">
                    <button disabled={busy} onClick={() => edit(row)}>
                      {t('admin.edit')}
                    </button>
                    <button onClick={() => setLabels([row.profile])}>{t('admin.qrLabel')}</button>
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
