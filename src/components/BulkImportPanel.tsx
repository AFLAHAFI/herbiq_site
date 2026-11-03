import React, { useMemo, useRef, useState } from 'react';
import type { Lang, Plant, PlantTranslation } from '../types';
import { useI18n } from '../i18n';
import { PROFILE_FIELDS, TRANSLATABLE_STRING_FIELDS } from '../lib/plant-validation';
import { savePlant, uploadModel3D, uploadPdf, uploadPhoto, type PlantRow } from '../lib/admin-api';
import { errorText } from '../lib/backend';
import {
  BULK_SHEET_HEADERS,
  buildSampleTemplateRows,
  buildSampleTemplateZip,
  parseBulkUploadFiles,
  plantToSheetRow,
  revalidateStagedItem,
  serializeRowsToCsv,
  serializeRowsToXlsx,
  type BulkStagedItem,
  type DuplicatePolicy,
} from '../lib/bulk-import';
import { getStoredApiKey, getStoredModel, saveApiKey } from '../lib/ai/key-storage';
import { GeminiProvider } from '../lib/ai/gemini';

interface BulkImportPanelProps {
  existingRows: PlantRow[];
  onClose: () => void;
  onCompleted: () => Promise<void>;
}

export function triggerBinaryDownload(bytes: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportCatalogSpreadsheet(rows: PlantRow[], format: 'xlsx' | 'csv') {
  const sheetRows: string[][] = [
    [...BULK_SHEET_HEADERS],
    ...rows.map((r) => plantToSheetRow(r.profile, r.published)),
  ];
  if (format === 'xlsx') {
    const bytes = serializeRowsToXlsx(sheetRows, 'HerbiQ Catalog');
    triggerBinaryDownload(
      bytes,
      'herbiq_catalog_export.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  } else {
    const csv = serializeRowsToCsv(sheetRows);
    triggerBinaryDownload(
      new TextEncoder().encode(csv),
      'herbiq_catalog_export.csv',
      'text/csv;charset=utf-8'
    );
  }
}

export const BulkImportPanel: React.FC<BulkImportPanelProps> = ({
  existingRows,
  onClose,
  onCompleted,
}) => {
  const { t } = useI18n();
  const [stagedItems, setStagedItems] = useState<BulkStagedItem[]>([]);
  const [spreadsheetName, setSpreadsheetName] = useState('');
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>('update');
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Inline row editor state
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [rowDraft, setRowDraft] = useState<Plant | null>(null);
  const [rowPublished, setRowPublished] = useState(true);
  const [rowEditLang, setRowEditLang] = useState<Lang>('en');

  // Optional inline Gemini key if admin wants to use Bulk AI Translate
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getStoredApiKey());

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);

  const existingById = useMemo(() => {
    const map = new Map<string, PlantRow>();
    for (const r of existingRows) {
      map.set(r.id, r);
    }
    return map;
  }, [existingRows]);

  const existingIdSet = useMemo(() => new Set(existingRows.map((r) => r.id)), [existingRows]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const files = Array.from(fileList);
      const parsed = await parseBulkUploadFiles(files, existingIdSet);
      setSpreadsheetName(parsed.spreadsheetName);
      setStagedItems(parsed.items);
      setEditingRowIndex(null);
      setRowDraft(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const updateStagedItem = (
    rowIndex: number,
    updater: (item: BulkStagedItem) => BulkStagedItem
  ) => {
    setStagedItems((prev) =>
      prev.map((item) =>
        item.rowIndex === rowIndex ? revalidateStagedItem(updater(item), existingIdSet) : item
      )
    );
  };

  const handleAttachRowPhoto = (rowIndex: number, file: File | undefined) => {
    if (!file) return;
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : undefined;
    updateStagedItem(rowIndex, (item) => ({
      ...item,
      imageFileRef: file.name,
      matchedImageFile: file,
      imagePreviewUrl: previewUrl,
    }));
  };

  const handleAttachRowModel = (rowIndex: number, file: File | undefined) => {
    if (!file) return;
    updateStagedItem(rowIndex, (item) => ({
      ...item,
      modelFileRef: file.name,
      matchedModelFile: file,
      plant: {
        ...item.plant,
        arAvailable: true,
      },
    }));
  };

  const handleAttachRowPdf = (rowIndex: number, file: File | undefined) => {
    if (!file) return;
    updateStagedItem(rowIndex, (item) => ({
      ...item,
      pdfFileRef: file.name,
      matchedPdfFile: file,
    }));
  };

  const openRowEditor = (item: BulkStagedItem) => {
    setEditingRowIndex(item.rowIndex);
    setRowDraft(structuredClone(item.plant));
    setRowPublished(item.published);
    setRowEditLang('en');
  };

  const saveRowEditor = () => {
    if (editingRowIndex === null || !rowDraft) return;
    updateStagedItem(editingRowIndex, (item) => ({
      ...item,
      plant: structuredClone(rowDraft),
      published: rowPublished,
    }));
    setEditingRowIndex(null);
    setRowDraft(null);
  };

  const updateRowDraftTranslation = (
    langKey: 'ar' | 'ml',
    field: keyof PlantTranslation,
    value: string
  ) => {
    setRowDraft((prev) => {
      if (!prev) return prev;
      const existingLang = prev.translations?.[langKey] || {};
      return {
        ...prev,
        ...(langKey === 'ml' && field === 'name' && value.trim() ? { malayalamName: value } : {}),
        translations: {
          ...(prev.translations || {}),
          [langKey]: {
            ...existingLang,
            [field]: value,
          },
        },
      };
    });
  };

  const updateRowDraftHealthTranslation = (
    langKey: 'ar' | 'ml',
    field: 'issues' | 'symptoms' | 'prevention',
    value: string
  ) => {
    setRowDraft((prev) => {
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

  const handleBulkAiTranslateMissing = async () => {
    const activeKey = getStoredApiKey() || apiKeyDraft.trim();
    if (!activeKey) {
      setError(t('admin.translateNeedKey'));
      return;
    }
    if (apiKeyDraft.trim() && !getStoredApiKey()) {
      saveApiKey(apiKeyDraft.trim(), false);
    }

    const targets = stagedItems.filter((item) => item.selected);
    if (targets.length === 0) return;

    setBusy(true);
    setError('');
    setNotice('');
    const provider = new GeminiProvider({ apiKey: activeKey, model: getStoredModel() });

    try {
      for (let i = 0; i < targets.length; i++) {
        const currentItem = targets[i];
        setProgressText(
          t('admin.bulkAiTranslating', { current: i + 1, total: targets.length })
        );
        let nextPlant = structuredClone(currentItem.plant);

        // Fill Malayalam if missing description
        if (!nextPlant.translations?.ml?.description) {
          const mlTrans = await provider.translatePlant(nextPlant, 'ml');
          nextPlant = {
            ...nextPlant,
            malayalamName: nextPlant.malayalamName || mlTrans.name || nextPlant.name,
            translations: {
              ...(nextPlant.translations || {}),
              ml: {
                ...(nextPlant.translations?.ml || {}),
                ...mlTrans,
              },
            },
          };
        }

        // Fill Arabic if missing description or name
        if (!nextPlant.translations?.ar?.description || !nextPlant.translations?.ar?.name) {
          const arTrans = await provider.translatePlant(nextPlant, 'ar');
          nextPlant = {
            ...nextPlant,
            translations: {
              ...(nextPlant.translations || {}),
              ar: {
                ...(nextPlant.translations?.ar || {}),
                ...arTrans,
              },
            },
          };
        }

        updateStagedItem(currentItem.rowIndex, (old) => ({
          ...old,
          plant: nextPlant,
        }));
      }
      setNotice(t('admin.translateDraftNotice'));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setProgressText('');
      setBusy(false);
    }
  };

  const actionableItems = useMemo(
    () =>
      stagedItems.filter((item) => {
        if (!item.selected) return false;
        if (item.validationErrors.length > 0) return false;
        if (item.isExistingInDb && duplicatePolicy === 'skip') return false;
        return true;
      }),
    [stagedItems, duplicatePolicy]
  );

  const handleConfirmBulkUpload = async () => {
    if (busy || actionableItems.length === 0) return;
    setBusy(true);
    setError('');
    setNotice('');

    let savedCount = 0;
    let skippedCount = stagedItems.filter(
      (i) => i.selected && i.isExistingInDb && duplicatePolicy === 'skip'
    ).length;
    let failedCount = 0;
    const failureMessages: string[] = [];

    try {
      for (let i = 0; i < actionableItems.length; i++) {
        const item = actionableItems[i];
        setProgressText(
          t('admin.bulkUploadingProgress', {
            current: i + 1,
            total: actionableItems.length,
            name: item.plant.name || item.plant.id,
          })
        );

        try {
          let finalImageUrl = item.plant.image;
          if (item.matchedImageFile) {
            finalImageUrl = await uploadPhoto(item.matchedImageFile);
          }

          let finalModelUrl = item.plant.model3D || '';
          if (item.matchedModelFile) {
            finalModelUrl = await uploadModel3D(item.matchedModelFile);
          }

          let finalPdfUrl = item.plant.pdfUrl || '';
          if (item.matchedPdfFile) {
            finalPdfUrl = await uploadPdf(item.matchedPdfFile);
          }

          const finalPlant: Plant = {
            ...item.plant,
            image: finalImageUrl,
            ...(finalModelUrl ? { model3D: finalModelUrl } : {}),
            ...(finalPdfUrl ? { pdfUrl: finalPdfUrl } : {}),
            arAvailable: finalModelUrl ? item.plant.arAvailable : false,
          };

          const existingRow = existingById.get(finalPlant.id);
          await savePlant(
            finalPlant,
            item.published,
            existingRow ? existingRow.revision : undefined
          );
          savedCount++;
        } catch (rowErr) {
          failedCount++;
          failureMessages.push(`${item.plant.name || item.plant.id}: ${errorText(rowErr)}`);
        }
      }

      await onCompleted();
      setNotice(
        t('admin.bulkUploadComplete', {
          saved: savedCount,
          skipped: skippedCount,
          failed: failedCount,
        })
      );
      if (failureMessages.length > 0) {
        setError(failureMessages.join(' | '));
      }
    } finally {
      setProgressText('');
      setBusy(false);
    }
  };

  const activeRowTranslation: PlantTranslation =
    rowEditLang !== 'en' && rowDraft ? rowDraft.translations?.[rowEditLang] || {} : {};

  return (
    <section
      aria-label={t('admin.bulkTitle')}
      className="p-5 sm:p-6 rounded-2xl bg-[#0b142b] border border-[#22d3ee]/40 space-y-5 my-4"
    >
      <div className="admin-heading">
        <div>
          <h2>{t('admin.bulkTitle')}</h2>
          <p>{t('admin.bulkSubtitle')}</p>
        </div>
        <button type="button" disabled={busy} onClick={onClose}>
          {t('admin.close')}
        </button>
      </div>

      {/* Template Downloads & Upload Trigger Buttons */}
      <div className="admin-actions">
        {/* Hidden Folder Input */}
        <input
          ref={(el) => {
            folderInputRef.current = el;
            if (el) {
              el.setAttribute('webkitdirectory', '');
              el.setAttribute('directory', '');
            }
          }}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Hidden ZIP / Sheet / Multi-file Input */}
        <input
          ref={filesInputRef}
          type="file"
          multiple
          accept=".zip,.xlsx,.csv,image/jpeg,image/png,image/webp,.glb,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          id="bulk-select-folder-btn"
          disabled={busy}
          onClick={() => folderInputRef.current?.click()}
          style={{ background: '#00e5ff', color: '#060b18', fontWeight: 700 }}
        >
          📁 {t('admin.bulkSelectFolder')}
        </button>

        <button
          type="button"
          id="bulk-select-zip-btn"
          disabled={busy}
          onClick={() => filesInputRef.current?.click()}
        >
          📦 {t('admin.bulkSelectZipOrSheet')}
        </button>

        <button
          type="button"
          id="bulk-download-template-zip-btn"
          disabled={busy}
          onClick={() =>
            triggerBinaryDownload(
              buildSampleTemplateZip(),
              'herbiq_bulk_template.zip',
              'application/zip'
            )
          }
        >
          ⬇ {t('admin.bulkDownloadTemplateZip')}
        </button>

        <button
          type="button"
          id="bulk-download-template-xlsx-btn"
          disabled={busy}
          onClick={() =>
            triggerBinaryDownload(
              serializeRowsToXlsx(buildSampleTemplateRows(), 'HerbiQ Template'),
              'plants_template.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
          }
        >
          ⬇ {t('admin.bulkDownloadTemplateXlsx')}
        </button>

        <button
          type="button"
          id="bulk-download-template-csv-btn"
          disabled={busy}
          onClick={() =>
            triggerBinaryDownload(
              new TextEncoder().encode(serializeRowsToCsv(buildSampleTemplateRows())),
              'plants_template.csv',
              'text/csv;charset=utf-8'
            )
          }
        >
          ⬇ {t('admin.bulkDownloadTemplateCsv')}
        </button>
      </div>

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
      {progressText && (
        <p role="status" className="admin-notice">
          ⏳ {progressText}
        </p>
      )}

      {/* Staged Items Table & Controls */}
      {stagedItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#060b18] border border-slate-700">
            <div className="flex flex-wrap items-center gap-3">
              <strong className="text-sm text-cyan-300">
                📄 {spreadsheetName} ({stagedItems.length} rows)
              </strong>
              <label className="!m-0 !flex-row items-center gap-2 text-xs">
                <span>{t('admin.bulkDuplicateLabel')}</span>
                <select
                  value={duplicatePolicy}
                  onChange={(e) => setDuplicatePolicy(e.target.value as DuplicatePolicy)}
                  className="!w-auto !py-1.5 !px-2.5 text-xs rounded-lg bg-[#0b142b] border border-slate-600 text-white"
                >
                  <option value="update">{t('admin.bulkDuplicateUpdate')}</option>
                  <option value="skip">{t('admin.bulkDuplicateSkip')}</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!getStoredApiKey() && (
                <input
                  type="password"
                  dir="ltr"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="Gemini API Key (for AI Translate)"
                  className="!w-52 !py-1.5 !px-2.5 text-xs"
                />
              )}
              <button
                type="button"
                id="bulk-ai-translate-btn"
                disabled={busy}
                onClick={() => void handleBulkAiTranslateMissing()}
              >
                ✨ {t('admin.bulkAiTranslateMissing')}
              </button>

              <button
                type="button"
                id="bulk-confirm-upload-btn"
                disabled={busy || actionableItems.length === 0}
                onClick={() => void handleConfirmBulkUpload()}
                style={{ background: '#10b981', color: '#060b18', fontWeight: 700 }}
              >
                🚀 {t('admin.bulkConfirmUpload', { count: actionableItems.length })}
              </button>
            </div>
          </div>

          {/* Inline Row Editor Drawer */}
          {editingRowIndex !== null && rowDraft && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#060b18] border-2 border-[#00e5ff] space-y-4">
              <div className="admin-heading">
                <h3>
                  {t('admin.bulkEditRow')}: {rowDraft.name || rowDraft.id}
                </h3>
                <div className="admin-actions !m-0">
                  <button
                    type="button"
                    onClick={saveRowEditor}
                    style={{ background: '#00e5ff', color: '#060b18', fontWeight: 700 }}
                  >
                    ✓ {t('admin.bulkSaveRowChanges')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRowIndex(null);
                      setRowDraft(null);
                    }}
                  >
                    {t('admin.close')}
                  </button>
                </div>
              </div>

              {/* Language Switcher inside Row Editor */}
              <div className="admin-actions" role="tablist">
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
                    aria-selected={rowEditLang === code}
                    onClick={() => setRowEditLang(code)}
                    style={
                      rowEditLang === code
                        ? { background: '#00e5ff', color: '#060b18', fontWeight: 700 }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {rowEditLang === 'en' ? (
                <div className="admin-fields">
                  <label>
                    {t('admin.stableId')}
                    <input
                      dir="ltr"
                      value={rowDraft.id}
                      onChange={(e) => {
                        const id = e.target.value;
                        setRowDraft({ ...rowDraft, id, herbiqId: `HERBIQ:${id}` });
                      }}
                    />
                  </label>
                  <label>
                    {t('admin.qrId')}
                    <input
                      dir="ltr"
                      value={rowDraft.herbiqId}
                      onChange={(e) => setRowDraft({ ...rowDraft, herbiqId: e.target.value })}
                    />
                  </label>
                  {PROFILE_FIELDS.map(([key, label], index) => (
                    <label key={key}>
                      {label}
                      {index < 5 ? (
                        <input
                          value={rowDraft[key] || ''}
                          onChange={(e) => setRowDraft({ ...rowDraft, [key]: e.target.value })}
                        />
                      ) : (
                        <textarea
                          rows={2}
                          value={rowDraft[key] || ''}
                          onChange={(e) => setRowDraft({ ...rowDraft, [key]: e.target.value })}
                        />
                      )}
                    </label>
                  ))}
                  {(['issues', 'symptoms', 'prevention'] as const).map((key) => (
                    <label key={key}>
                      Plant health — {key}
                      <textarea
                        rows={2}
                        value={rowDraft.health[key]}
                        onChange={(e) =>
                          setRowDraft({
                            ...rowDraft,
                            health: { ...rowDraft.health, [key]: e.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div
                  className="admin-fields"
                  dir={rowEditLang === 'ar' ? 'rtl' : 'ltr'}
                  lang={rowEditLang}
                >
                  {TRANSLATABLE_STRING_FIELDS.map(([key, label], index) => (
                    <label key={key}>
                      {label} ({rowEditLang.toUpperCase()})
                      {index < 2 ? (
                        <input
                          value={(activeRowTranslation[key] as string) || ''}
                          placeholder={rowDraft[key as keyof Plant] as string}
                          onChange={(e) =>
                            updateRowDraftTranslation(rowEditLang, key, e.target.value)
                          }
                        />
                      ) : (
                        <textarea
                          rows={2}
                          value={(activeRowTranslation[key] as string) || ''}
                          placeholder={(rowDraft[key as keyof Plant] as string) || ''}
                          onChange={(e) =>
                            updateRowDraftTranslation(rowEditLang, key, e.target.value)
                          }
                        />
                      )}
                    </label>
                  ))}
                  {(['issues', 'symptoms', 'prevention'] as const).map((key) => (
                    <label key={key}>
                      Translated health — {key} ({rowEditLang.toUpperCase()})
                      <textarea
                        rows={2}
                        value={activeRowTranslation.health?.[key] || ''}
                        placeholder={rowDraft.health[key]}
                        onChange={(e) =>
                          updateRowDraftHealthTranslation(rowEditLang, key, e.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-2">
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={rowDraft.arAvailable}
                    onChange={(e) =>
                      setRowDraft({ ...rowDraft, arAvailable: e.target.checked })
                    }
                  />
                  {t('admin.enableAr')}
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={rowPublished}
                    onChange={(e) => setRowPublished(e.target.checked)}
                  />
                  {t('admin.publishPlant')}
                </label>
              </div>
            </div>
          )}

          {/* Staged Rows List */}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="bg-[#060b18] text-slate-300 border-b border-slate-700">
                  <th className="p-3">{t('admin.bulkColSelect')}</th>
                  <th className="p-3">{t('admin.bulkColPhoto')}</th>
                  <th className="p-3">{t('admin.bulkColPlant')}</th>
                  <th className="p-3">{t('admin.bulkColAssets')}</th>
                  <th className="p-3">{t('admin.bulkColStatus')}</th>
                  <th className="p-3">{t('admin.bulkColActions')}</th>
                </tr>
              </thead>
              <tbody>
                {stagedItems.map((item) => {
                  const p = item.plant;
                  const hasMl = Boolean(p.malayalamName && p.translations?.ml?.description);
                  const hasAr = Boolean(p.translations?.ar?.name && p.translations?.ar?.description);
                  const willSkip = item.isExistingInDb && duplicatePolicy === 'skip';
                  const hasError = item.validationErrors.length > 0;

                  return (
                    <tr
                      key={item.rowIndex}
                      className="border-b border-slate-800 bg-[#0b142b]/60 hover:bg-[#060b18]/60"
                    >
                      <td className="p-3 align-top">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          aria-label={`Select ${p.name || p.id}`}
                          onChange={(e) =>
                            updateStagedItem(item.rowIndex, (old) => ({
                              ...old,
                              selected: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="p-3 align-top">
                        {item.imagePreviewUrl ? (
                          <img
                            src={item.imagePreviewUrl}
                            alt={p.name}
                            className="w-14 h-14 object-cover rounded-lg border border-slate-600"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-slate-900 border border-red-500/50 flex items-center justify-center text-[10px] text-red-300 text-center p-1">
                            No Photo
                          </div>
                        )}
                      </td>
                      <td className="p-3 align-top space-y-1">
                        <div className="font-bold text-sm text-white">{p.name || '—'}</div>
                        <div className="text-amber-300" lang="ml">
                          {p.malayalamName || '—'}
                        </div>
                        {p.translations?.ar?.name && (
                          <div className="text-emerald-300" lang="ar" dir="rtl">
                            {p.translations.ar.name}
                          </div>
                        )}
                        <div className="text-slate-400">
                          <code dir="ltr">{p.id}</code> · <em dir="ltr">{p.scientificName}</em>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px]">
                            EN ✓
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              hasMl
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            ML {hasMl ? '✓' : '•'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              hasAr
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            AR {hasAr ? '✓' : '•'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 align-top space-y-1.5">
                        <div>
                          {item.matchedImageFile ? (
                            <span className="text-emerald-300 block">
                              🖼 ✓ <bdi dir="ltr">{item.matchedImageFile.name}</bdi>
                            </span>
                          ) : p.image ? (
                            <span className="text-cyan-300 block truncate max-w-[180px]" dir="ltr">
                              🖼 URL: {p.image}
                            </span>
                          ) : (
                            <span className="text-red-300 block">
                              🖼 ✗ {item.imageFileRef || 'Missing photo'}
                            </span>
                          )}
                        </div>
                        <div>
                          {item.matchedModelFile ? (
                            <span className="text-emerald-300 block">
                              🧊 ✓ <bdi dir="ltr">{item.matchedModelFile.name}</bdi> (3D/AR)
                            </span>
                          ) : p.model3D ? (
                            <span className="text-cyan-300 block truncate max-w-[180px]" dir="ltr">
                              🧊 3D: {p.model3D}
                            </span>
                          ) : (
                            <span className="text-slate-400 block">🧊 No 3D .glb</span>
                          )}
                        </div>
                        <div>
                          {item.matchedPdfFile ? (
                            <span className="text-emerald-300 block">
                              📄 ✓ <bdi dir="ltr">{item.matchedPdfFile.name}</bdi> (PDF)
                            </span>
                          ) : p.pdfUrl ? (
                            <span className="text-cyan-300 block truncate max-w-[180px]" dir="ltr">
                              📄 PDF: {p.pdfUrl}
                            </span>
                          ) : (
                            <span className="text-slate-400 block">📄 Auto PDF Sheet</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        {hasError ? (
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 rounded bg-red-950 text-red-200 border border-red-500/40 font-semibold">
                              ⚠ {t('admin.bulkStatusNeedsFix')}
                            </span>
                            <ul className="text-[11px] text-red-300 list-disc ps-4">
                              {item.validationErrors.map((errMsg, idx) => (
                                <li key={idx}>{errMsg}</li>
                              ))}
                            </ul>
                          </div>
                        ) : willSkip ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600">
                            ⏭ {t('admin.bulkStatusSkip')}
                          </span>
                        ) : item.isExistingInDb ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-cyan-950 text-cyan-200 border border-cyan-500/40 font-semibold">
                            ↻ {t('admin.bulkStatusReadyUpdate')}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-500/40 font-semibold">
                            ✓ {t('admin.bulkStatusReadyNew')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openRowEditor(item)}
                            className="!py-1.5 !px-2.5 !min-h-0 text-xs"
                          >
                            ✏ {t('admin.bulkEditRow')}
                          </button>

                          <label className="!m-0 inline-flex items-center cursor-pointer px-2.5 py-1.5 rounded-lg border border-cyan-400 bg-[#102333] text-white text-xs">
                            🖼 {t('admin.bulkChoosePhoto')}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                handleAttachRowPhoto(item.rowIndex, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>

                          <label className="!m-0 inline-flex items-center cursor-pointer px-2.5 py-1.5 rounded-lg border border-emerald-400 bg-[#102333] text-white text-xs">
                            🧊 {t('admin.bulkChooseModel')}
                            <input
                              type="file"
                              accept=".glb,model/gltf-binary"
                              className="hidden"
                              onChange={(e) => {
                                handleAttachRowModel(item.rowIndex, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>

                          <label className="!m-0 inline-flex items-center cursor-pointer px-2.5 py-1.5 rounded-lg border border-amber-400 bg-[#102333] text-white text-xs">
                            📄 PDF
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                handleAttachRowPdf(item.rowIndex, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
