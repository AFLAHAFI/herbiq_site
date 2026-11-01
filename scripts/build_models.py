"""Original deterministic plant meshes and embedded PBR textures. Requires numpy and Pillow.
Computer-modeled approximations, not scans or validated botanical specimens.
"""
from pathlib import Path
import numpy as np, math, json, struct, io, random
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public/assets/models';OUT.mkdir(parents=True,exist_ok=True)
rng=random.Random(420)
def texture(kind):
 n=512; gen=np.random.default_rng(421); yy,xx=np.mgrid[:n,:n];noise=gen.normal(0,3,(n,n))
 if kind=='bark':base=np.array([99,80,48]);noise+=9*np.sin(xx*.35)+5*np.sin(xx*.081)
 elif kind=='aloe':base=np.array([59,112,70]);noise+=6*np.sin(xx/n*math.pi)
 else:base=np.array([49,105,35]);noise+=17*np.sin(xx/n*math.pi)+6*np.cos(yy/n*2)
 a=np.clip(base[None,None,:]+noise[:,:,None],0,255).astype('uint8');im=Image.fromarray(a);d=ImageDraw.Draw(im,'RGBA')
 if kind=='aloe':
  for _ in range(700):
   x,y=rng.randrange(n),rng.randrange(n);d.ellipse((x,y,x+3,y+6),fill=(199,215,154,80))
 elif kind!='bark':
  d.line((256,0,256,512),fill=(163,180,82,160),width=4)
  for y in range(15,500,27 if kind=='broad' else 38):
   for side in [-1,1]:d.line([(256,y),(256+side*80,y+36),(256+side*240,y+73)],fill=(155,176,80,100),width=2)
 bio=io.BytesIO();im.save(bio,format='PNG');return bio.getvalue()
textures=[texture(k) for k in ['leaf','broad','aloe','bark']]
materials=[{'name':k,'doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':i},'metallicFactor':0,'roughnessFactor':.72 if i!=2 else .48}} for i,k in enumerate(['Leaf','Broad leaf','Aloe leaf','Bark'])]
for name,color in [('Stem',[.19,.32,.075,1]),('Tulsi stem',[.27,.15,.20,1]),('Flower',[.63,.41,.65,1]),('Soil',[.12,.095,.06,1]),('Aloe teeth',[.7,.72,.47,1])]:materials.append({'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':.85}})
parts={}
def add(v,f,uv,mat):
 parts.setdefault(mat,[]).append((np.asarray(v,dtype='float32'),np.asarray(f,dtype='uint32'),np.asarray(uv,dtype='float32')))
def tube(points,radius,mat=4,end=.25,sides=8):
 pts=np.array(points);v=[];uv=[];f=[]
 for i,p in enumerate(pts):
  t=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]);t/=np.linalg.norm(t)
  axis=np.cross(t,[0,0,1] if abs(t[2])<.9 else [1,0,0]);axis/=np.linalg.norm(axis);other=np.cross(t,axis)
  rad=radius*(1-(1-end)*i/(len(pts)-1))
  for j in range(sides+1):
   a=j/sides*math.tau;v.append(p+rad*(math.cos(a)*axis+math.sin(a)*other));uv.append([j/sides,i/(len(pts)-1)])
 for i in range(len(pts)-1):
  for j in range(sides):
   a=i*(sides+1)+j;b=a+sides+1;f.extend([[a,b,a+1],[b,b+1,a+1]])
 add(v,f,uv,mat)
def stem(a,b,r,mat=4):tube([a,b],r,mat)
def leaf(base,length,width,az,tilt,mat=0,serrated=False,thick=False):
 base=np.array(base);rad=np.array([math.cos(az),0,math.sin(az)]);side=np.array([-math.sin(az),0,math.cos(az)]);up=np.array([0,1,0]);v=[];uv=[];faces=[];nt=4 if mat==6 else 16;nw=2 if mat==6 else 4
 for layer in ([1,-1] if thick else [1]):
  off=len(v)
  for i in range(nt+1):
   t=i/nt; w=width*(math.sin(math.pi*t)**(.65 if not thick else .45))*.5
   if serrated:w*=1+.065*math.sin(t*math.pi*32)
   if thick:w=width*.5*(1-t)**.7
   center=base+rad*(length*t*math.cos(tilt)+length*.18*t*t)+up*(length*t*math.sin(tilt)-length*.3*t*t)
   for j in range(nw+1):
    u=j/nw*2-1;curve=(1-u*u)*width*(.15 if not thick else .35)*(1-t)*layer
    v.append(center+side*w*u+up*curve);uv.append([j/nw,t])
  for i in range(nt):
   for j in range(nw):
    a=off+i*(nw+1)+j;b=a+nw+1;f=[[a,a+1,b],[a+1,b+1,b]]
    faces.extend(f if layer==1 else [tri[::-1] for tri in f])
 add(v,faces,uv,mat)
 if thick:
  for t in np.linspace(.1,.9,13):
   center=base+rad*(length*t*math.cos(tilt)+length*.18*t*t)+up*(length*t*math.sin(tilt)-length*.3*t*t)
   for sign in [-1,1]:
    a=center+side*sign*width*.5*(1-t)**.7;stem(a,a+side*sign*.007+up*.004,.002,8)
 elif mat!=6:
  # raised central vein
  pts=[base+rad*(length*t*math.cos(tilt)+length*.18*t*t)+up*(length*t*math.sin(tilt)-length*.3*t*t+width*.15*(1-t)+.0006) for t in np.linspace(0,.95,12)]
  tube(pts,.00075,4,end=.15,sides=5)
def soil(radius):
 v=[[0,0,0]]+[[radius*math.cos(i*math.tau/48),0,radius*math.sin(i*math.tau/48)] for i in range(49)]
 add(v,[[0,i+2,i+1] for i in range(48)],[[.5,.5]]+[[.5+.5*math.cos(i*math.tau/48),.5+.5*math.sin(i*math.tau/48)] for i in range(49)],7)
 tube([[0,-.014,0],[0,0,0]],radius,7,end=1,sides=48)
 for _ in range(35):
  a=rng.random()*math.tau;r=radius*math.sqrt(rng.random());p=np.array([r*math.cos(a),.001,r*math.sin(a)]);stem(p,p+[0,.002,0],.003,7)
def tulsi():
 soil(.085);stem([0,0,0],[0,.50,0],.0055,5)
 for tier in range(6):
  h=.085+tier*.056
  for side in [0,1]:
   az=tier*1.5+side*math.pi;end=np.array([.065*math.cos(az),h+.065,.065*math.sin(az)])
   stem([0,h,0],end,.0025,5)
   for j in range(3):
    p=np.array([0,h,0])+(end-[0,h,0])*(.4+j*.3)
    for sg in [-1,1]:leaf(p,.072*(1-tier*.035),.045,az+sg*.8,.25,serrated=True)
   flower(end+np.array([0,.02,0]),.075)
 flower(np.array([0,.48,0]),.10)
def flower(base,height):
 stem(base,base+[0,height,0],.0013,5)
 for i in range(7):
  p=base+[0,height*i/7,0]
  for j in range(5):
   az=j*math.tau/5+i*.6;leaf(p,.007,.006,az,.2,6)
def neem():
 soil(.11);tube([[0,0,0],[.004,.25,.002],[-.004,.52,0],[.006,.86,0]],.013,3,end=.22)
 for k in range(10):
  az=k*2.4;h=.22+k*.058;base=np.array([0,h,0]);end=base+np.array([.16*math.cos(az),.09,.16*math.sin(az)])
  stem(base,end,.004,3)
  for branch in [-1,0,1]:
   direction=az+branch*.7;start=base+(end-base)*(.62 if branch else 1);rad=np.array([math.cos(direction),0,math.sin(direction)])
   tip=start+rad*.22+[0,.055,0];stem(start,tip,.0014)
   for j in range(6):
    p=start+(tip-start)*(j+1)/7
    for sg in [-1,1]:leaf(p,.065*(1-.055*j),.019,direction+sg*1.1,.25,serrated=True)
   leaf(tip,.055,.016,direction,.30,serrated=True)
def aloe():
 soil(.105)
 for ring,count in [(0,10),(1,8),(2,6),(3,3)]:
  for j in range(count):
   az=j*math.tau/count+ring*.8;length=.33-ring*.041+rng.uniform(-.016,.016);base=[.014*math.cos(az),ring*.008,.014*math.sin(az)]
   leaf(base,length,.067-ring*.008,az,.38+ring*.28,2,thick=True)
def turmeric():
 soil(.095)
 for j in range(9):
  az=j*2.399;h=.14+(j%3)*.07;base=np.array([.014*math.cos(az),0,.014*math.sin(az)]);tip=base+[.025*math.cos(az),h,.025*math.sin(az)]
  stem(base,tip,.006);leaf(tip,.38+(j%3)*.035,.14,az,.60+(j%3)*.18,1)
def ginger():
 soil(.09)
 for j in range(5):
  az=j*2.4;x=.032*math.cos(az);z=.032*math.sin(az);height=.47+j*.046
  tube([[x,0,z],[x*.8,height*.5,z*.8],[x+.024*math.cos(az),height,z+.024*math.sin(az)]],.006,4,end=.3)
  for k in range(9):
   h=.08+k*(height-.10)/9;a=az+(k%2)*math.pi;base=[x+.018*math.cos(az)*h/height,h,z+.018*math.sin(az)*h/height]
   leaf(base,.18-(k/9)*.06,.022,a,.15+k*.025,1)
def export(name):
 data=bytearray();views=[];accessors=[]
 def buffer(raw,target=None):
  while len(data)%4:data.append(0)
  idx=len(views);view={'buffer':0,'byteOffset':len(data),'byteLength':len(raw)}
  if target:view['target']=target
  views.append(view);data.extend(raw);return idx
 def accessor(a,typ,component,target):
  view=buffer(a.tobytes(),target);acc={'bufferView':view,'componentType':component,'count':len(a),'type':typ}
  if typ=='VEC3':acc.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
  accessors.append(acc);return len(accessors)-1
 images=[{'bufferView':buffer(t),'mimeType':'image/png'} for t in textures];primitives=[]
 for mat,items in parts.items():
  vs=[];fs=[];uvs=[];offset=0
  for v,f,uv in items:vs.append(v);fs.append(f+offset);uvs.append(uv);offset+=len(v)
  v=np.concatenate(vs).astype('<f4');f=np.concatenate(fs).astype('<u4');uv=np.concatenate(uvs).astype('<f4');norm=np.zeros_like(v)
  fn=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
  for i in range(3):np.add.at(norm,f[:,i],fn)
  lengths=np.linalg.norm(norm,axis=1);norm[lengths<1e-12]=[0,1,0]
  norm/=np.linalg.norm(norm,axis=1)[:,None];norm=norm.astype('<f4')
  primitives.append({'attributes':{'POSITION':accessor(v,'VEC3',5126,34962),'NORMAL':accessor(norm,'VEC3',5126,34962),'TEXCOORD_0':accessor(uv,'VEC2',5126,34962)},'indices':accessor(f.flatten(),'SCALAR',5125,34963),'material':mat})
 gltf={'asset':{'version':'2.0','generator':'HerbiQ original plant model generator','copyright':'Original HerbiQ computer-modeled asset; CC0-1.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':name}],'meshes':[{'primitives':primitives}], 'buffers':[{'byteLength':len(data)}],'bufferViews':views,'accessors':accessors,'materials':materials,'images':images,'textures':[{'source':i,'sampler':0} for i in range(4)],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}]}
 js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4);data+=b'\0'*((-len(data))%4)
 result=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(data))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(data),b'BIN\0')+data
 (OUT/(name+'.glb')).write_bytes(result);print(name, len(result),'bytes',sum(len(f) for items in parts.values() for v,f,uv in items),'triangles')
 # Preserve a compact geometry snapshot for local review only.
 np.savez('/tmp/herbiq-'+name+'.npz',v=np.concatenate([v for items in parts.values() for v,f,uv in items]))
for name,build in [('tulsi',tulsi),('neem',neem),('aloe-vera',aloe),('turmeric',turmeric),('ginger',ginger)]:
 parts.clear();build();export(name)
