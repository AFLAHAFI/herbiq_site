import { publicBackend } from './backend';
import { replacePublicCatalog } from '../data/plants';
import type { Plant } from '../types';
let sequence = 0;
export async function refreshCatalog() {
 if (!publicBackend) return;
 const ticket = ++sequence;
 const {data,error} = await publicBackend.from('herbiq_plants').select('profile').eq('published',true).order('id').abortSignal(AbortSignal.timeout(15000));
 if (ticket !== sequence) return;
 if (error) { replacePublicCatalog([]); throw error; }
 replacePublicCatalog((data || []).map(row => row.profile as Plant));
}
