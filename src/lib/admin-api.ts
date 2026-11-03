import { backend } from './backend';
import { validatePlant } from './plant-validation';
import type { Plant, PlantTranslations } from '../types';

export interface PlantRow {
  id: string;
  qr_id: string;
  published: boolean;
  profile: Plant;
  translations?: PlantTranslations;
  revision: number;
  updated_at: string;
}

function normalizePlantRow(row: PlantRow): PlantRow {
  const mergedTranslations: PlantTranslations = {
    ...(row.profile?.translations || {}),
    ...(row.translations || {}),
  };
  return {
    ...row,
    translations: mergedTranslations,
    profile: {
      ...row.profile,
      translations: mergedTranslations,
    },
  };
}

export async function requireAdmin() {
  if (!backend) throw new Error('Connect Supabase first. See SETUP.md.');
  const { data, error } = await backend.rpc('herbiq_is_admin');
  if (error) throw error;
  if (data !== true) throw new Error('This account is not an authorized HerbiQ administrator.');
}

export async function listAdminPlants(): Promise<PlantRow[]> {
  await requireAdmin();
  const { data, error } = await backend!.from('herbiq_plants').select('*').order('id');
  if (error) throw error;
  return (data || []).map((row) => normalizePlantRow(row as PlantRow));
}

export async function savePlant(plant: Plant, published: boolean, revision?: number) {
  validatePlant(plant);
  await requireAdmin();
  const translations: PlantTranslations = plant.translations || {};
  const profileWithTranslations: Plant = { ...plant, translations };
  const valueWithCol = {
    id: plant.id,
    qr_id: plant.herbiqId,
    published,
    profile: profileWithTranslations,
    translations,
  };

  const runSave = async (payload: Record<string, unknown>) => {
    const query =
      revision === undefined
        ? backend!.from('herbiq_plants').insert(payload)
        : backend!.from('herbiq_plants').update(payload).eq('id', plant.id).eq('revision', revision);
    return query.select().maybeSingle();
  };

  let { data, error } = await runSave(valueWithCol);
  if (error && String(error.message || '').includes('translations')) {
    const valueWithoutCol = {
      id: plant.id,
      qr_id: plant.herbiqId,
      published,
      profile: profileWithTranslations,
    };
    const fallback = await runSave(valueWithoutCol);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  if (!data) throw new Error('This plant changed in another session. Reload the list before editing again.');
  return normalizePlantRow(data as PlantRow);
}

export async function deletePlant(row: PlantRow) {
  await requireAdmin();
  const { data, error } = await backend!
    .from('herbiq_plants')
    .delete()
    .eq('id', row.id)
    .eq('revision', row.revision)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This plant changed in another session. Reload before deleting.');
}

export async function uploadPhoto(file: File): Promise<string> {
  await requireAdmin();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)
    throw new Error('Use a JPG, PNG or WebP photo smaller than 10 MB.');
  const bitmap = await createImageBitmap(file);
  let blob: Blob;
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50000000)
      throw new Error('Photo dimensions are too large. Resize the photo first.');
    const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * factor);
    canvas.height = Math.round(bitmap.height * factor);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo conversion is unavailable.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Unable to process photo.'))), 'image/jpeg', 0.88)
    );
  } finally {
    bitmap.close();
  }
  const path = `plants/${crypto.randomUUID()}.jpg`;
  const { error } = await backend!.storage
    .from('herbiq-images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return backend!.storage.from('herbiq-images').getPublicUrl(path).data.publicUrl;
}

export function validateGlbBuffer(buffer: ArrayBuffer): void {
  if (!buffer || buffer.byteLength < 20) {
    throw new Error('Invalid 3D model: file is too small to be a valid .glb model.');
  }
  if (buffer.byteLength > 25 * 1024 * 1024) {
    throw new Error('3D model (.glb) must be smaller than 25 MB.');
  }
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  // 0x46546C67 === ASCII "glTF" in little-endian
  if (magic !== 0x46546c67 || version !== 2) {
    throw new Error('Invalid 3D model format: please upload a valid binary glTF 2.0 (.glb) file.');
  }
}

export async function uploadModel3D(file: File): Promise<string> {
  await requireAdmin();
  if (!file.name.toLowerCase().endsWith('.glb')) {
    throw new Error('Only .glb 3D model files are supported.');
  }
  const buffer = await file.arrayBuffer();
  validateGlbBuffer(buffer);

  const path = `models/${crypto.randomUUID()}.glb`;
  const primaryBlob = new Blob([buffer], { type: 'model/gltf-binary' });

  let { error } = await backend!.storage
    .from('herbiq-images')
    .upload(path, primaryBlob, { contentType: 'model/gltf-binary', upsert: false });

  // Graceful fallback if 004_storage_models.sql has not yet been applied on the remote bucket
  if (error && /mime|type|not supported/i.test(String(error.message || ''))) {
    const fallbackBlob = new Blob([buffer], { type: 'image/webp' });
    const retry = await backend!.storage
      .from('herbiq-images')
      .upload(path, fallbackBlob, { contentType: 'image/webp', upsert: false });
    error = retry.error;
  }

  if (error) throw error;
  return backend!.storage.from('herbiq-images').getPublicUrl(path).data.publicUrl;
}
