import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Plant } from '../types';
import { qrDataUrl, qrPayload } from '../lib/qr';
import { useI18n } from '../i18n';

export function QRLabels({ plants, onClose }: { plants: Plant[]; onClose: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'id' | 'link'>('id');
  const [site, setSite] = useState(location.origin + location.pathname);
  const [labels, setLabels] = useState<{ plant: Plant; src: string }[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setError('');
    setLabels([]);
    Promise.all(plants.map(async (plant) => ({ plant, src: await qrDataUrl(qrPayload(plant, mode, site)) })))
      .then(async (rows) => {
        await Promise.all(
          rows.map(
            (row) =>
              new Promise<void>((resolve, reject) => {
                const im = new Image();
                im.onload = () => resolve();
                im.onerror = () => reject(new Error('QR image failed to load'));
                im.src = row.src;
              })
          )
        );
        await document.fonts.load('16px "Noto Sans Malayalam"', rows.map((r) => r.plant.malayalamName).join(' '));
        await document.fonts.ready;
        if (alive) {
          setLabels(rows);
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [plants, mode, site]);

  return createPortal(
    <section className="qr-print-sheet" role="dialog" aria-modal="true" aria-label={t('admin.qrDialogTitle')}>
      <div className="qr-toolbar">
        <h2>{t('admin.qrDialogTitle')}</h2>
        <button onClick={onClose}>{t('admin.close')}</button>
        <label>
          {t('admin.codeFormat')}{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="id">{t('admin.formatId')}</option>
            <option value="link">{t('admin.formatLink')}</option>
          </select>
        </label>
        {mode === 'link' && (
          <label>
            {t('admin.deployedUrl')}{' '}
            <input type="url" dir="ltr" value={site} onChange={(e) => setSite(e.target.value)} />
          </label>
        )}
        <p>
          {mode === 'id' ? t('admin.scanInsideHerbiq') : t('admin.scanNormalPhone')} {t('admin.printHint')}
        </p>
        <button disabled={!ready || !labels.length} onClick={() => window.print()}>
          {t('admin.printSavePdf')}
        </button>
        {!ready && !error && <p role="status">{t('admin.preparingLabels')}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="qr-label-grid">
        {labels.map(({ plant, src }) => (
          <article className="qr-label" key={plant.id}>
            <strong dir="ltr">HerbiQ · {plant.name}</strong>
            <span lang="ml">{plant.malayalamName}</span>
            {plant.translations?.ar?.name && (
              <span lang="ar" dir="rtl">
                {plant.translations.ar.name}
              </span>
            )}
            <em>
              <bdi dir="ltr">{plant.scientificName}</bdi>
            </em>
            <img width="180" height="180" src={src} alt={`QR code for ${plant.name}`} />
            <code dir="ltr">{plant.herbiqId}</code>
            <a className="qr-download" download={`${plant.id}-qr.png`} href={src}>
              {t('admin.downloadPng')}
            </a>
          </article>
        ))}
      </div>
    </section>,
    document.body
  );
}
