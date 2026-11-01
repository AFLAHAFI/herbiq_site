import React,{useEffect,useRef,useState} from 'react';
import '@google/model-viewer';
import type {Plant} from '../types';
export const Plant3DViewer: React.FC<{plant:Plant}> = ({plant}) => {
 const ref=useRef<any>(null);const [loading,setLoading]=useState(true),[error,setError]=useState(''),[ar,setAR]=useState(false),[rotate,setRotate]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const viewer=ref.current;if(!viewer)return;setLoading(true);setError('');setAR(false);
  const loaded=()=>{setLoading(false);setAR(Boolean(viewer.canActivateAR));};
  const failed=()=>{setLoading(false);setError('This 3D model could not load. Check your connection or try again.');};
  const status=(e:any)=>{if(e.detail.status==='failed')setError('AR could not start. Try the normal 3D view, or check camera permission and device support.');};
  viewer.addEventListener('load',loaded);viewer.addEventListener('error',failed);viewer.addEventListener('ar-status',status);
  const timeout=setTimeout(()=>{if(!viewer.loaded)failed();},45000);
  if(viewer.loaded)loaded();
  return()=>{clearTimeout(timeout);viewer.removeEventListener('load',loaded);viewer.removeEventListener('error',failed);viewer.removeEventListener('ar-status',status);};
 },[plant.id,plant.model3D,retry]);
 const launch=async()=>{try{setError('');await ref.current?.activateAR();}catch{setError('AR could not start on this device. You can continue in the 3D viewer.');}};
 if(!plant.model3D)return <p className="p-8">No 3D model is available for this plant.</p>;
 return <div className="model-panel">
  <div className="model-stage">
   {React.createElement('model-viewer',{
    key:`${plant.id}-${retry}`,ref,src:plant.model3D,alt:`Detailed 3D model of ${plant.name}`,
    'camera-controls':'','touch-action':'pan-y',ar:'','ar-modes':'webxr scene-viewer quick-look','ar-placement':'floor',
    'auto-rotate':rotate?'':undefined,'rotation-per-second':'12deg','shadow-intensity':'1','shadow-softness':'.8',exposure:'1',
    'environment-image':'neutral','camera-orbit':'35deg 70deg auto','min-camera-orbit':'auto 10deg auto','max-camera-orbit':'auto 100deg auto',
    'interaction-prompt':'none','loading':'eager',style:{width:'100%',height:'100%'}
   },<button slot="ar-button" className="model-native-ar">View in your space</button>)}
   {loading&&<div role="status" className="model-loading">Loading {plant.name}…</div>}
  </div>
  <div className="model-actions"><button onClick={()=>setRotate(v=>!v)}>{rotate?'Pause rotation':'Auto rotate'}</button><button onClick={()=>{if(ref.current){ref.current.cameraOrbit='35deg 70deg auto';ref.current.fieldOfView='auto';ref.current.jumpCameraToGoal();}}}>Reset view</button><button disabled={!ar||loading} onClick={()=>void launch()}>Place with camera</button></div>
  {error&&<p role="alert" className="admin-error">{error} <button className="underline" onClick={()=>setRetry(v=>v+1)}>Retry model</button></p>}
  {!ar&&!loading&&<p className="px-4 pb-3 text-sm text-slate-300">Camera placement is unavailable here. Drag to rotate and pinch or scroll to zoom.</p>}
  <p className="px-4 pb-4 text-xs text-slate-400">Original computer-made plant model. Not a scan or a botanically verified specimen.</p>
 </div>;
}
