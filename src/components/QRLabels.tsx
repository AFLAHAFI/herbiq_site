import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Plant } from '../types';
import { qrDataUrl, qrPayload } from '../lib/qr';
export function QRLabels({plants,onClose}: {plants:Plant[];onClose:()=>void}) {
 const [mode,setMode] = useState<'id'|'link'>('id');
 const [site,setSite] = useState(location.origin+location.pathname);
 const [labels,setLabels] = useState<{plant:Plant;src:string}[]>([]);
 const [error,setError] = useState(''); const [ready,setReady]=useState(false);
 useEffect(()=>{let alive=true;setReady(false);setError('');setLabels([]);
  Promise.all(plants.map(async plant=>({plant,src:await qrDataUrl(qrPayload(plant,mode,site))}))).then(async rows=>{
   await Promise.all(rows.map(row=>new Promise<void>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve();im.onerror=()=>reject(new Error('QR image failed to load'));im.src=row.src;})));
   await document.fonts.load('16px "Noto Sans Malayalam"', rows.map(r=>r.plant.malayalamName).join(' '));
   await document.fonts.ready;
   if(alive){setLabels(rows);setReady(true);}
  }).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false;};
 },[plants,mode,site]);
 return createPortal(<section className="qr-print-sheet" role="dialog" aria-modal="true" aria-label="Print plant labels">
  <div className="qr-toolbar"><h2>Plant QR labels</h2><button onClick={onClose}>Close</button>
   <label>Code format <select value={mode} onChange={e=>setMode(e.target.value as any)}><option value="id">HERBIQ ID — website scanner</option><option value="link">Website link — normal phone camera</option></select></label>
   {mode==='link'&&<label>Deployed website URL <input type="url" value={site} onChange={e=>setSite(e.target.value)}/></label>}
   <p>{mode==='id'?'Scan these labels inside HerbiQ.':'Scan with a normal phone camera to open the plant page.'} Use A4 paper, 100% scale, and disable browser print headers/footers.</p>
   <button disabled={!ready||!labels.length} onClick={()=>window.print()}>Print / Save as PDF</button>{!ready&&!error&&<p role="status">Preparing labels…</p>}{error&&<p role="alert">{error}</p>}
  </div>
  <div className="qr-label-grid">{labels.map(({plant,src})=><article className="qr-label" key={plant.id}>
   <strong>HerbiQ · {plant.name}</strong><span lang="ml">{plant.malayalamName}</span><em>{plant.scientificName}</em>
   <img width="180" height="180" src={src} alt={`QR code for ${plant.name}`}/><code>{plant.herbiqId}</code>
   <a className="qr-download" download={`${plant.id}-qr.png`} href={src}>Download PNG</a>
  </article>)}</div>
 </section>,document.body);
}
