#!/usr/bin/env python3
"""Export the original 0105 room; no map painting or invented door coordinates."""
import hashlib, importlib.util, json, struct, sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('wil',ROOT/'tools/inspect-classic-ui.py')
wil=importlib.util.module_from_spec(spec);spec.loader.exec_module(wil)
SOURCE=ROOT/'raw-assets/client-176/传奇私服1.76客户'
MAP_ID='0105'
OUT=ROOT/f'client/assets/resources/mir/maps/{MAP_ID}'
PORTALS=[('0',295,284,'0105',8,24),('0',295,285,'0105',9,23),('0105',9,25,'0',295,286),('0105',9,24,'0',296,285),('0',305,275,'0105',20,12),('0',305,276,'0105',21,11),('0105',21,12,'0',306,276),('0105',21,13,'0',306,277)]

def read_map(path):
 b=path.read_bytes();w,h=struct.unpack_from('<hh',b)
 if w<=0 or h<=0 or len(b)!=52+w*h*12:raise ValueError('Invalid legacy map dimensions/length')
 cells=[]
 for y in range(h):
  for x in range(w):
   back,middle,front,door,dooroff,anim,tick,lib,light=struct.unpack_from('<HHHBBBBBB',b,52+(x*h+y)*12)
   c=dict(x=x,y=y,blocked=bool((back|front)&32768),doorIndex=door&127,doorOffset=dooroff,frontAnimationFrames=anim,frontAnimationTick=tick,light=light)
   for layer,library,index in [('back',0,(back&32767)-1),('middle',1,middle-1),('front',lib+2,(front&32767)-1)]:
    if index<0:continue
    ref=dict(library=library,index=index,key=f'room{MAP_ID}:{library}:{index}',render=layer!='back' or (x%2==0 and y%2==0))
    if layer=='front' and anim&127:ref['animationKeys']=[f'room{MAP_ID}:{library}:{index+i}' for i in range(anim&127)]
    c[layer]=ref
   cells.append(c)
 return w,h,cells

def build():
 OUT.mkdir(parents=True,exist_ok=True)
 pin=json.loads((ROOT/('tools/interior-inputs.json' if MAP_ID=='0105' else f'tools/interior-{MAP_ID}-inputs.json')).read_text())
 for source in pin['mapSources']:
  if hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest()!=source['sha256']:raise ValueError('Interior source hash mismatch: '+source['path'])
 if [list(p) for p in PORTALS]!=pin['portals']:raise ValueError('Portal pin mismatch')
 w,h,cells=read_map(SOURCE/f'Map/{MAP_ID}.map');wanted={}
 for c in cells:
  for layer in ['back','middle','front']:
   a=c.get(layer)
   if a and a['render']:
    for key in [a['key'],*a.get('animationKeys',[])]:wanted.setdefault(a['library'],set()).add(int(key.split(':')[-1]))
 images=[];sources=[]
 for lib,indices in wanted.items():
  name={0:'Tiles',1:'SmTiles',2:'Objects'}.get(lib,f'Objects{lib-1}')
  path=next(p for p in (SOURCE/'Data').iterdir() if p.name.lower()==name.lower()+'.wil')
  result=wil.read_library(path,indices)
  missing=indices-set(result)
  if missing:raise ValueError(f'Missing room frames {name}: {missing}')
  for ext in ['.wil','.wix']:
   p=next(p for p in path.parent.iterdir() if p.stem.lower()==name.lower() and p.suffix.lower()==ext)
   sources.append(dict(path=str(p.relative_to(ROOT)),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
  images.extend((f'room{MAP_ID}:{lib}:{i}',im,meta) for i,(im,meta) in result.items())
 atlas=Image.new('RGBA',(2048,2048));frames={};atlases=[];x=y=row=0
 def flush():
  nonlocal atlas,x,y,row
  height=1<<(max(1,y+row)-1).bit_length();file=f'maps/{MAP_ID}/atlas-{len(atlases)}.png'
  atlas.crop((0,0,2048,height)).save(ROOT/'client/assets/resources/mir'/file)
  atlases.append(dict(file=file,width=2048,height=height));atlas=Image.new('RGBA',(2048,2048));x=y=row=0
 for key,im,meta in sorted(images,key=lambda v:-v[1].height):
  iw,ih=im.size
  if x+iw+2>2048:x=0;y+=row;row=0
  if y+ih+2>2048:flush()
  # Duplicate the edge texels to prevent atlas bleeding under browser scaling.
  atlas.paste(im,(x+1,y+1))
  for dx,dy,box in [(0,1,(0,0,1,ih)),(iw+1,1,(iw-1,0,iw,ih)),(1,0,(0,0,iw,1)),(1,ih+1,(0,ih-1,iw,ih))]:atlas.paste(im.crop(box),(x+dx,y+dy))
  frames[key]=dict(atlas=len(atlases),x=x+1,y=y+1,**meta);x+=iw+2;row=max(row,ih+2)
 flush()
 for c in cells:
  for layer in ['back','middle','front']:
   a=c.get(layer)
   if not a or not a['render']:continue
   f=frames[a['key']];floor=layer=='back' or (f['w'],f['h']) in [(48,32),(96,64)]
   a.update(floor=floor,drawX=0,drawY=0 if floor else 32-f['h'],blend=layer=='front' and bool(c['frontAnimationFrames']&128))
 (OUT/'cells.json').write_text(json.dumps(dict(cells=cells),separators=(',',':'))+'\n')
 (OUT/'collision.json').write_text(json.dumps(dict(rows=[''.join('1' if cells[y*w+x]['blocked'] else '0' for x in range(w)) for y in range(h)]),separators=(',',':'))+'\n')
 source=SOURCE/f'Map/{MAP_ID}.map';sources.append(dict(path=str(source.relative_to(ROOT)),sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
 data=dict(map=dict(id=MAP_ID,name=pin.get('name','边界书店' if MAP_ID=='0132' else '首饰店'),width=w,height=h,originX=0,originY=0,spawn=pin.get('spawn',dict(x=8,y=24) if MAP_ID=='0105' else (dict(x=13,y=15) if MAP_ID=='0132' else dict(x=2,y=11))),collisionFile=f'maps/{MAP_ID}/collision.json',chunks=[dict(x=0,y=0,width=w,height=h,file=f'maps/{MAP_ID}/cells.json',atlases=list(range(len(atlases))))]),frames=frames,atlases=atlases,sources=sources,portals=PORTALS,portalSource=pin['portalSource'])
 (OUT/'manifest.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps(dict(map=MAP_ID,frames=len(frames),atlases=len(atlases),cells=len(cells))))
if __name__=='__main__':
 if len(sys.argv)>1:MAP_ID=sys.argv[1]
 registry=json.loads((ROOT/'server/content/world-maps.json').read_text())['maps']
 entry=next((m for m in registry if m['id']==MAP_ID and m.get('pin')),None)
 if not entry:raise ValueError('Unsupported pinned interior')
 pin=json.loads((ROOT/entry['pin']).read_text())
 PORTALS=[tuple(p) for p in pin['portals']]
 OUT=ROOT/f'client/assets/resources/mir/maps/{MAP_ID}'
 build()
