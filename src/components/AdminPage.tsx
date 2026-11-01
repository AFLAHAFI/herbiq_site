import React,{useEffect,useState} from 'react';
import {backend,errorText} from '../lib/backend';
import {listAdminPlants,savePlant,deletePlant,uploadPhoto,requireAdmin,type PlantRow} from '../lib/admin-api';
import {emptyPlant,PROFILE_FIELDS} from '../lib/plant-validation';
import type {Plant} from '../types';
import {QRLabels} from './QRLabels';
export function AdminPage({onChanged}:{onChanged:()=>Promise<void>}) {
 const [authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[rows,setRows]=useState<PlantRow[]>([]),[query,setQuery]=useState('');
 const [draft,setDraft]=useState<Plant|null>(null),[original,setOriginal]=useState<PlantRow|null>(null),[published,setPublished]=useState(false);
 const [selected,setSelected]=useState<string[]>([]),[labels,setLabels]=useState<Plant[]|null>(null);
 const load=async()=>{const next=await listAdminPlants();setRows(next);setSelected(s=>s.filter(id=>next.some(p=>p.id===id)));};
 useEffect(()=>{
  if(!backend){setChecking(false);return;}
  let alive=true;let generation=0;
  const verify=async()=>{const current=++generation;try{
   const {data,error}=await backend.auth.getSession();if(error)throw error;
   if(!data.session){if(alive&&current===generation){setAuthorized(false);setRows([]);setDraft(null);setLabels(null);setPassword('');}return;}
   await requireAdmin();const list=await listAdminPlants();
   if(alive&&current===generation){setRows(list);setAuthorized(true);}
  }catch(e){if(alive&&current===generation){setAuthorized(false);setRows([]);setDraft(null);setLabels(null);setError(errorText(e));}}
  finally{if(alive&&current===generation)setChecking(false);}};
  void verify();
  const {data}=backend.auth.onAuthStateChange(()=>{setTimeout(()=>{if(alive)void verify();},0);});
  return()=>{alive=false;data.subscription.unsubscribe();};
 },[]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const edit=(row?:PlantRow)=>{setOriginal(row||null);setDraft(row?structuredClone(row.profile):emptyPlant());setPublished(row?.published||false);setError('');setNotice('');};
 if(!backend)return <div className="admin-page"><h1>Admin setup required</h1><p>The dashboard needs your Supabase connection before login and shared editing can work.</p><p>Follow SETUP.md included with this project. No default admin password is provided.</p></div>;
 if(checking)return <p className="p-10" role="status">Checking session…</p>;
 const messages=<>{error&&<p role="alert" className="admin-error">{error}</p>}{notice&&<p role="status" className="admin-notice">{notice}</p>}</>;
 if(!authorized)return <div className="admin-page max-w-lg"><h1>HerbiQ Admin</h1><p>Sign in with an authorized administrator account.</p>{messages}<form onSubmit={e=>{e.preventDefault();void run(async()=>{const {error}=await backend.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('');await requireAdmin();await load();setAuthorized(true);});}}>
 <label>Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><button disabled={busy} onClick={()=>void run(async()=>{await backend.auth.signOut();setAuthorized(false);setRows([]);setNotice('Signed out.');})}>Clear session</button></div>;
 return <div className="admin-page"><div className="admin-heading"><div><h1>Plant management</h1><p>{rows.length} plants · {rows.filter(r=>r.published).length} published</p></div><button disabled={busy} onClick={()=>void run(async()=>{const {error}=await backend.auth.signOut();if(error)throw error;setAuthorized(false);setRows([]);setDraft(null);setLabels(null);})}>Sign out</button></div>
 {messages}
 {draft?<form onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=await savePlant(draft,published,original?.revision);setOriginal(saved);setDraft(structuredClone(saved.profile));await load();await onChanged();setNotice('Plant saved. Public catalog refreshed.');});}}>
 <div className="admin-heading"><h2>{original?'Edit plant':'Add plant'}</h2><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Back to list</button></div>
 <fieldset disabled={busy}><div className="admin-fields"><label>Stable plant ID<input required disabled={!!original} value={draft.id} onChange={e=>{const id=e.target.value;setDraft({...draft,id,herbiqId:`HERBIQ:${id}`});}}/><small>Lowercase, hyphen-separated. Cannot change after saving.</small></label>
 <label>QR ID<input required value={draft.herbiqId} onChange={e=>setDraft({...draft,herbiqId:e.target.value})}/><small>Changing this invalidates previously printed ID labels.</small></label>
 {PROFILE_FIELDS.map(([key,label],index)=><label key={key}>{label}{index<5?<input required value={draft[key]||''} maxLength={5000} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>:<textarea rows={3} required={key!=='culturalImportance'} maxLength={5000} value={draft[key]||''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>}</label>)}
 {(['issues','symptoms','prevention'] as const).map(key=><label key={key}>Plant health — {key}<textarea required rows={3} maxLength={5000} value={draft.health[key]} onChange={e=>setDraft({...draft,health:{...draft.health,[key]:e.target.value}})}/></label>)}
 <label>Photo URL<input required value={draft.image} onChange={e=>setDraft({...draft,image:e.target.value})}/></label>
 <label>Upload / replace photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{const image=await uploadPhoto(file);setDraft(d=>d?{...d,image}:d);setNotice('Photo uploaded. Save the plant to apply it.');});}}/><small>JPG, PNG or WebP, up to 10 MB. Optimized before upload.</small></label>
 <label>3D model URL (.glb)<input value={draft.model3D||''} onChange={e=>setDraft({...draft,model3D:e.target.value})}/></label></div>
 {draft.image&&<img className="admin-photo" src={draft.image} alt="Plant photo preview"/>}
 <label className="admin-check"><input type="checkbox" checked={draft.arAvailable} onChange={e=>setDraft({...draft,arAvailable:e.target.checked})}/>Enable 3D / AR (model URL required)</label>
 <label className="admin-check"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/>Publish this plant publicly</label>
 <button type="submit">{busy?'Saving…':'Save plant'}</button></fieldset></form>:<>
 <div className="admin-actions"><button disabled={busy} onClick={()=>edit()}>Add plant</button><button disabled={busy} onClick={()=>void run(load)}>Refresh</button><button disabled={!selected.length||busy} onClick={()=>setLabels(rows.filter(r=>selected.includes(r.id)).map(r=>r.profile))}>Print selected ({selected.length})</button></div>
 <label>Search plants<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, Malayalam name or QR ID"/></label>
 <label className="admin-check"><input type="checkbox" checked={!!rows.length&&selected.length===rows.length} onChange={e=>setSelected(e.target.checked?rows.map(r=>r.id):[])}/>Select all plants</label>
 <div className="admin-list">{rows.filter(r=>[r.profile.name,r.profile.malayalamName,r.qr_id].some(v=>v.toLowerCase().includes(query.toLowerCase()))).map(row=><article key={row.id} className="admin-row">
 <input aria-label={`Select ${row.profile.name}`} type="checkbox" checked={selected.includes(row.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,row.id]:s.filter(id=>id!==row.id))}/>
 <div><strong>{row.profile.name}</strong><p>{row.profile.malayalamName} · {row.qr_id}</p><span>{row.published?'Published':'Hidden'}</span></div>
 <div className="admin-actions"><button disabled={busy} onClick={()=>edit(row)}>Edit</button><button onClick={()=>setLabels([row.profile])}>QR label</button><button disabled={busy} onClick={()=>{if(confirm(`Delete ${row.profile.name}? Existing labels will no longer open this plant.`))void run(async()=>{await deletePlant(row);await load();await onChanged();setNotice('Plant deleted.');});}}>Delete</button></div></article>)}</div>
 {!rows.length&&<p>No plants yet. Run the supplied seed SQL to import your existing 27 plants, or add a plant.</p>}
 </>}
 {labels&&<QRLabels plants={labels} onClose={()=>setLabels(null)}/>}
 </div>;
}
