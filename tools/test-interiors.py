#!/usr/bin/env python3
"""Check every room pixel, collision cell and both ends of the sourced portals."""
import importlib.util,json,hashlib,struct,sys
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('rooms',ROOT/'tools/convert-interiors.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
map_id=sys.argv[1] if len(sys.argv)>1 else '0105'
m.MAP_ID=map_id;m.OUT=ROOT/f'client/assets/resources/mir/maps/{map_id}'
pin=json.loads((ROOT/('tools/interior-inputs.json' if map_id=='0105' else f'tools/interior-{map_id}-inputs.json')).read_text());m.PORTALS=[tuple(p) for p in pin['portals']];assert hashlib.sha256((ROOT/pin['exteriorSource']['local']).read_bytes()).hexdigest()==pin['exteriorSource']['sha256']
d=json.loads((m.OUT/'manifest.json').read_text());assert d['sources']==pin['mapSources'] and d['portals']==pin['portals'];w,h,cells=m.read_map(m.SOURCE/f'Map/{map_id}.map')
assert (len(cells),len(d['frames']))=={'0105':(783,217),'0141':(864,307),'0132':(528,136),'0106':(783,216),'0140':(340,116)}[map_id]
exported=json.loads((m.OUT/'cells.json').read_text())['cells']
assert len(exported)==len(cells)
for original,actual in zip(cells,exported):
 for key,value in original.items():
  if isinstance(value,dict):
   for field,entry in value.items():assert actual[key][field]==entry
  else:assert actual[key]==value
rows=json.loads((m.OUT/'collision.json').read_text())['rows']
for c in cells:assert (rows[c['y']][c['x']]=='1')==c['blocked']
for source in d['sources']:assert hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest()==source['sha256']
atlases=[Image.open(ROOT/'client/assets/resources/mir'/a['file']).convert('RGBA') for a in d['atlases']]
for lib in sorted({int(k.split(':')[1]) for k in d['frames']}):
 name={0:'Tiles',1:'SmTiles',2:'Objects'}.get(lib,f'Objects{lib-1}')
 subset={int(k.split(':')[-1]):f for k,f in d['frames'].items() if k.split(':')[1]==str(lib)}
 if not subset:continue
 path=next(p for p in (m.SOURCE/'Data').iterdir() if p.name.lower()==name.lower()+'.wil')
 for i,(im,meta) in m.wil.read_library(path,subset).items():
  f=subset[i];got=atlases[f['atlas']].crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
  assert got.tobytes()==im.tobytes();assert f['offsetX']==meta['offsetX'] and f['offsetY']==meta['offsetY']
main=(m.SOURCE/'Map/0.map').read_bytes()
def blocked(id,x,y):
 if id==map_id:return cells[y*w+x]['blocked']
 back,_,front=struct.unpack_from('<HHH',main,52+(x*700+y)*12)
 return bool((back|front)&32768)
for src,x,y,dest,tx,ty in m.PORTALS:
 assert not blocked(src,x,y),(src,x,y)
 assert not blocked(dest,tx,ty),(dest,tx,ty)
 assert not any(r[0]==dest and r[1:3]==(tx,ty) for r in m.PORTALS),'destination must not trigger an immediate return'
print(f'{map_id}: {len(d["frames"])} frames pixel-exact; {len(cells)} collision cells; {len(m.PORTALS)} portal endpoints valid and non-bouncing')
