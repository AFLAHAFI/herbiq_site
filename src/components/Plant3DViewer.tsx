import React, { useEffect, useRef, useState } from 'react';
import '@google/model-viewer';
import type { Plant } from '../types';
import { useI18n } from '../i18n';

export const Plant3DViewer: React.FC<{ plant: Plant }> = ({ plant }) => {
  const { t } = useI18n();
  const ref = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ar, setAR] = useState(false);
  const [rotate, setRotate] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const viewer = ref.current;
    if (!viewer) return;
    setLoading(true);
    setError('');
    setAR(false);
    const loaded = () => {
      setLoading(false);
      setAR(Boolean(viewer.canActivateAR));
    };
    const failed = () => {
      setLoading(false);
      setError(t('ar.loadError'));
    };
    const status = (e: any) => {
      if (e.detail.status === 'failed') setError(t('ar.arStartError'));
    };
    viewer.addEventListener('load', loaded);
    viewer.addEventListener('error', failed);
    viewer.addEventListener('ar-status', status);
    const timeout = setTimeout(() => {
      if (!viewer.loaded) failed();
    }, 45000);
    if (viewer.loaded) loaded();
    return () => {
      clearTimeout(timeout);
      viewer.removeEventListener('load', loaded);
      viewer.removeEventListener('error', failed);
      viewer.removeEventListener('ar-status', status);
    };
  }, [plant.id, plant.model3D, retry, t]);

  const launch = async () => {
    try {
      setError('');
      await ref.current?.activateAR();
    } catch {
      setError(t('ar.arDeviceError'));
    }
  };

  if (!plant.model3D) return <p className="p-8">{t('ar.noModelForPlant')}</p>;

  return (
    <div className="model-panel text-start">
      <div className="model-stage">
        {React.createElement(
          'model-viewer',
          {
            key: `${plant.id}-${retry}`,
            ref,
            src: plant.model3D,
            alt: t('ar.modelAlt', { name: plant.name }),
            'camera-controls': '',
            'touch-action': 'pan-y',
            ar: '',
            'ar-modes': 'webxr scene-viewer quick-look',
            'ar-placement': 'floor',
            'auto-rotate': rotate ? '' : undefined,
            'rotation-per-second': '12deg',
            'shadow-intensity': '1',
            'shadow-softness': '.8',
            exposure: '1',
            'environment-image': 'neutral',
            'camera-orbit': '35deg 70deg auto',
            'min-camera-orbit': 'auto 10deg auto',
            'max-camera-orbit': 'auto 100deg auto',
            'interaction-prompt': 'none',
            loading: 'eager',
            style: { width: '100%', height: '100%' },
          },
          <button slot="ar-button" className="model-native-ar">
            {t('ar.viewInSpace')}
          </button>
        )}
        {loading && (
          <div role="status" className="model-loading">
            {t('ar.loadingModel', { name: plant.name })}
          </div>
        )}
      </div>
      <div className="model-actions">
        <button onClick={() => setRotate((v) => !v)}>
          {rotate ? t('ar.pauseRotation') : t('ar.autoRotate')}
        </button>
        <button
          onClick={() => {
            if (ref.current) {
              ref.current.cameraOrbit = '35deg 70deg auto';
              ref.current.fieldOfView = 'auto';
              ref.current.jumpCameraToGoal();
            }
          }}
        >
          {t('ar.resetView')}
        </button>
        <button disabled={!ar || loading} onClick={() => void launch()}>
          {t('ar.placeWithCamera')}
        </button>
      </div>
      {error && (
        <p role="alert" className="admin-error">
          {error}{' '}
          <button className="underline" onClick={() => setRetry((v) => v + 1)}>
            {t('ar.retryModel')}
          </button>
        </p>
      )}
      {!ar && !loading && (
        <p className="px-4 pb-3 text-sm text-slate-300">{t('ar.cameraPlacementUnavailable')}</p>
      )}
      <p className="px-4 pb-4 text-xs text-slate-400">{t('ar.disclosure')}</p>
    </div>
  );
};
