import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import validator from 'gltf-validator';import {PNG} from 'pngjs';import jsQR from 'jsqr';
import {PLANTS} from '../src/data/plants';import {qrDataUrl,qrPayload} from '../src/lib/qr';import {validatePlant} from '../src/lib/plant-validation';
test('all five GLBs are self-contained, valid textured 3D meshes',async()=>{
 const models=PLANTS.filter(p=>p.arAvailable);assert.equal(models.length,5);
 for(const plant of models){const bytes=readFileSync('public'+plant.model3D);const report=await validator.validateBytes(new Uint8Array(bytes),{uri:plant.model3D});
 assert.equal(report.issues.numErrors,0,`${plant.id}: ${JSON.stringify(report.issues.messages.slice(0,4))}`);
 const len=bytes.readUInt32LE(12);const gltf=JSON.parse(bytes.subarray(20,20+len).toString());assert.ok(gltf.images.length);assert.ok(gltf.meshes.length);assert.ok(gltf.images.every(i=>i.bufferView!==undefined));}
});
test('every QR image decodes to the exact HerbiQ ID; website QR links are valid',async()=>{
 for(const p of PLANTS){const data=await qrDataUrl(qrPayload(p,'id',''));const png=PNG.sync.read(Buffer.from(data.split(',')[1],'base64'));assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data,p.herbiqId);}
 const p=PLANTS[0],payload=qrPayload(p,'link','https://example.org/herbiq/');assert.equal(new URLSearchParams(new URL(payload).hash.slice(1)).get('plant'),p.id);
 assert.throws(()=>qrPayload(p,'link','javascript:alert(1)'));assert.throws(()=>qrPayload(p,'link','http://example.org'));
});
test('plant validation rejects unsafe/incomplete records',()=>{
 for(const p of PLANTS)assert.equal(validatePlant(p),p);
 assert.throws(()=>validatePlant({...PLANTS[0],image:'javascript:alert(1)'}));
 assert.throws(()=>validatePlant({...PLANTS[0],image:'/assets/../secret'}));
 assert.throws(()=>validatePlant({...PLANTS[0],arAvailable:true,model3D:''}));
 assert.throws(()=>validatePlant({...PLANTS[0],herbiqId:'not valid'}));
});
