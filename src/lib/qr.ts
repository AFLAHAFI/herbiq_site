import QRCode from 'qrcode';
import type { Plant } from '../types';
export function qrPayload(plant: Plant, mode: 'id'|'link', siteUrl: string) {
 if (mode === 'id') return plant.herbiqId;
 const url = new URL(siteUrl);
 if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Use the HTTPS address of your deployed website.');
 url.hash = new URLSearchParams({page:'plants',plant:plant.id}).toString(); return url.href;
}
export async function qrDataUrl(payload: string) { return QRCode.toDataURL(payload,{width:600,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}}); }
