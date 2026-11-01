import type { Plant } from '../types';
export const PROFILE_FIELDS = [
 ['name','English name'], ['malayalamName','Malayalam name'], ['scientificName','Scientific name'], ['family','Family'], ['category','Category'],
 ['description','Description'], ['traditionalUses','Traditional uses'], ['medicinalBenefits','Traditional benefits'], ['plantPartsTraditionallyUsed','Parts used'], ['traditionalUsage','Traditional usage'], ['habitat','Habitat'], ['identification','Identification'], ['culturalImportance','Cultural importance']
] as const;
export function safeAssetUrl(value: string) {
 if (!value) return true;
 if (/^\/assets\/[a-zA-Z0-9/_ .-]+$/.test(value) && !value.includes('..')) return true;
 try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
export function validatePlant(p: Plant) {
 if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id) || p.id.length > 80) throw new Error('Plant ID must use lowercase letters, numbers and single hyphens (maximum 80 characters).');
 if (!/^HERBIQ:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.herbiqId) || p.herbiqId.length > 100) throw new Error('QR ID must use HERBIQ: followed by a lowercase plant code.');
 for (const [field,label] of PROFILE_FIELDS) {
  const value = p[field] || '';
  if (field !== 'culturalImportance' && !value.trim()) throw new Error(`${label} is required.`);
  if (value.length > 5000) throw new Error(`${label} exceeds 5,000 characters.`);
 }
 if (!p.image || !safeAssetUrl(p.image)) throw new Error('Choose a photo or a valid HTTPS image URL.');
 if (!safeAssetUrl(p.model3D || '')) throw new Error('Model URL must be an /assets/ path or HTTPS URL.');
 if (p.arAvailable && !p.model3D) throw new Error('Add a GLB model URL before enabling 3D/AR.');
 if (!p.health || ['issues','symptoms','prevention'].some(k => typeof p.health[k] !== 'string' || !p.health[k].trim() || p.health[k].length > 5000)) throw new Error('Complete all plant health fields (maximum 5,000 characters each).');
 return p;
}
export function emptyPlant(): Plant { return {id:'',herbiqId:'HERBIQ:',name:'',malayalamName:'',scientificName:'',family:'',category:'Herb',description:'',traditionalUses:'',medicinalBenefits:'',plantPartsTraditionallyUsed:'',traditionalUsage:'',habitat:'',identification:'',image:'',arAvailable:false,model3D:'',health:{issues:'',symptoms:'',prevention:''}}; }
