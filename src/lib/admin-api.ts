import { backend } from './backend';
import { validatePlant } from './plant-validation';
import type { Plant } from '../types';
export interface PlantRow { id: string; qr_id: string; published: boolean; profile: Plant; revision: number; updated_at: string; }
export async function requireAdmin() {
 if (!backend) throw new Error('Connect Supabase first. See SETUP.md.');
 const {data,error} = await backend.rpc('herbiq_is_admin');
 if (error) throw error;
 if (data !== true) throw new Error('This account is not an authorized HerbiQ administrator.');
}
export async function listAdminPlants(): Promise<PlantRow[]> {
 await requireAdmin(); const {data,error} = await backend!.from('herbiq_plants').select('*').order('id');
 if (error) throw error; return data || [];
}
export async function savePlant(plant: Plant, published: boolean, revision?: number) {
 validatePlant(plant); await requireAdmin();
 const value = {id:plant.id, qr_id:plant.herbiqId, published, profile:plant};
 const query = revision === undefined ? backend!.from('herbiq_plants').insert(value) : backend!.from('herbiq_plants').update(value).eq('id',plant.id).eq('revision',revision);
 const {data,error} = await query.select().maybeSingle();
 if (error) throw error;
 if (!data) throw new Error('This plant changed in another session. Reload the list before editing again.');
 return data as PlantRow;
}
export async function deletePlant(row: PlantRow) {
 await requireAdmin();
 const {data,error} = await backend!.from('herbiq_plants').delete().eq('id',row.id).eq('revision',row.revision).select('id');
 if (error) throw error;
 if (!data?.length) throw new Error('This plant changed in another session. Reload before deleting.');
}
export async function uploadPhoto(file: File): Promise<string> {
 await requireAdmin();
 if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Use a JPG, PNG or WebP photo smaller than 10 MB.');
 const bitmap = await createImageBitmap(file);
 let blob: Blob;
 try {
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 50000000) throw new Error('Photo dimensions are too large. Resize the photo first.');
  const factor = Math.min(1,1600 / Math.max(bitmap.width,bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width*factor); canvas.height=Math.round(bitmap.height*factor);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Photo conversion is unavailable.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Unable to process photo.')), 'image/jpeg', .88));
 } finally { bitmap.close(); }
 const path = `plants/${crypto.randomUUID()}.jpg`;
 const {error} = await backend!.storage.from('herbiq-images').upload(path,blob,{contentType:'image/jpeg',upsert:false});
 if (error) throw error;
 return backend!.storage.from('herbiq-images').getPublicUrl(path).data.publicUrl;
}
