import React, { useEffect, useState } from 'react';
import { getARAvailablePlants, getPlantById } from '../data/plants';
import { useI18n } from '../i18n';
import { Plant3DViewer } from './Plant3DViewer';
import { PlantImage } from './PlantImage';

export function ARExperiencePage({
  initialSelectedPlantId,
  onSelectPlant,
}: {
  initialSelectedPlantId?: string;
  onSelectPlant: (id: string) => void;
}) {
  const { t, localizePlant } = useI18n();
  const plants = getARAvailablePlants().filter((p) => p.model3D);
  const [id, setId] = useState(initialSelectedPlantId || plants[0]?.id || '');

  useEffect(() => {
    setId(initialSelectedPlantId || plants[0]?.id || '');
  }, [initialSelectedPlantId]);

  const rawPlant = getPlantById(id);
  if (!rawPlant?.arAvailable || !rawPlant.model3D) {
    return (
      <div className="p-10 text-center space-y-4">
        <h1 className="text-3xl">{t('ar.unavailableTitle')}</h1>
        <p>{t('ar.unavailableBody')}</p>
        {plants.length > 0 && (
          <button className="underline" onClick={() => setId(plants[0].id)}>
            {t('ar.browseAvailable')}
          </button>
        )}
      </div>
    );
  }

  const plant = localizePlant(rawPlant);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6 text-start">
      <div>
        <p className="text-cyan-300 text-sm">{t('ar.badge')}</p>
        <h1 className="text-4xl font-bold mt-2">{t('ar.heading')}</h1>
        <p className="text-slate-300 mt-3">{t('ar.subtitle', { count: plants.length })}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {plants.map((rawP) => {
          const p = localizePlant(rawP);
          return (
            <button
              id={`thumbnail-select-${p.id}`}
              key={p.id}
              onClick={() => setId(p.id)}
              aria-pressed={p.id === id}
              className={`text-start p-3 rounded-2xl flex items-center gap-3 border ${
                p.id === id ? 'border-cyan-300 bg-cyan-950' : 'border-slate-700 bg-slate-900'
              }`}
            >
              <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden">
                <PlantImage src={p.image} alt={p.name} />
              </div>
              <span className="min-w-0 text-sm break-words">{p.name}</span>
            </button>
          );
        })}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6 items-start">
        <Plant3DViewer key={plant.id} plant={plant} />
        <aside className="p-6 bg-slate-900 rounded-2xl space-y-4 text-start">
          <h2 className="text-3xl">{plant.name}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <p lang="ml" className="text-amber-300">
              {rawPlant.malayalamName}
            </p>
            {rawPlant.translations?.ar?.name && (
              <p lang="ar" dir="rtl" className="text-emerald-300">
                {rawPlant.translations.ar.name}
              </p>
            )}
          </div>
          <p className="italic text-cyan-300">
            <bdi dir="ltr">{plant.scientificName}</bdi>
          </p>
          <p className="text-slate-300">{plant.description}</p>
          <p className="text-sm text-slate-400">{t('ar.controlsHint')}</p>
          <button
            id="plant-info-full-btn"
            onClick={() => onSelectPlant(plant.id)}
            className="w-full p-3 border border-cyan-400 rounded-xl"
          >
            {t('ar.fullProfileBtn')}
          </button>
        </aside>
      </div>
    </div>
  );
}
