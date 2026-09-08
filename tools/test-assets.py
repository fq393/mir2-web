#!/usr/bin/env python3
"""Check the entire source map, chunk coverage, every rendered frame and pins."""
import importlib.util,json,struct,hashlib,tempfile
from pathlib import Path
from PIL import Image, ImageChops
ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
c=module('converter',ROOT/'tools/convert-assets.py');fetcher=module('fetcher',ROOT/'tools/fetch-assets.py')
m=json.loads((c.OUT/'manifest.json').read_text());raw=(c.RAW/'Map_0.map').read_bytes();collision=json.loads((c.OUT/m['map']['collisionFile']).read_text())
assert m['schemaVersion']==2 and (m['map']['width'],m['map']['height'])==(700,700)
assert len(m['map']['chunks'])==484 and len(collision['rows'])==700
seen=set();blocked=0;rendered=0
for entry in m['map']['chunks']:
 chunk=json.loads((c.OUT/entry['file']).read_text());cells=chunk['cells'];assert len(cells)==entry['width']*entry['height']
 needed=set()
 for cell in cells:
  x,y=cell['x'],cell['y'];assert (x,y) not in seen;seen.add((x,y));assert entry['x']<=x<entry['x']+entry['width'] and entry['y']<=y<entry['y']+entry['height']
  o=8+(x*700+y)*26;bl,bi,ml,mi,fl,fi=struct.unpack_from('<hihhhh',raw,o)
  for name,lib,index in [('back',bl,(bi&0x1fffffff)-1),('middle',ml,mi-1),('front',fl,(fi&0x7fff)-1)]:
   if lib>=0 and index>=0:assert cell[name]['library']==lib and cell[name]['index']==index
  back=struct.unpack_from('<I',raw,o+2)[0];front=struct.unpack_from('<H',raw,o+12)[0]
  assert cell['blocked']==bool(back&0x20000000 or front&0x8000)
  assert collision['rows'][y][x]==('1' if cell['blocked'] else '0');blocked+=cell['blocked']
  for name in ('back','middle','front'):
   a=cell.get(name)
   if not a or not a.get('render'):continue
   rendered+=1;assert a['key'] in m['frames'];f=m['frames'][a['key']]
   for k in (a['key'],*a.get('animationKeys',[])):
    if k in m['frames']:needed.add(m['frames'][k]['atlas'])
    else:assert k in m['emptyFrames']
   if name=='back':assert x%2==y%2==0
   assert a['drawY']==(0 if a['floor'] else 32-f['h'])+(f['offsetY'] if a.get('blend') and 2723<=a['index']<=2732 else 0)
 assert sorted(needed)==entry['atlases']
assert len(seen)==490000 and 0<blocked<490000
assert collision['rows'][615][288]=='0'
# Check every packed frame against the documented deterministic shadow transform.
# Process one atlas at a time to keep peak memory bounded.
libs={};checked=0;changed=0
for ai,entry in enumerate(m['atlases']):
 atlas=Image.open(c.OUT/entry['file']).convert('RGBA')
 for k,f in m['frames'].items():
  if f['atlas']!=ai:continue
  lib=f['library']
  if lib not in libs:libs={lib:c.Library(c.rawpath(c.LIBRARIES[lib]))}
  source,meta=libs[lib].frame(f['index']);expected=c.smooth_shadow(source,lib)
  crop=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
  assert crop.tobytes()==expected.tobytes(),k
  changed+=source.tobytes()!=expected.tobytes();checked+=1
  if lib in ('monster4','monster5'):
   mask=ImageChops.lighter(c.shadow_mask(source),c.shadow_mask(source,(16,8,8)))
   protected=ImageChops.multiply(source.getchannel('A').point(lambda p:255 if p else 0),ImageChops.invert(mask))
   difference=ImageChops.difference(source,expected)
   assert all(ImageChops.multiply(ch,protected).getbbox() is None for ch in difference.split()),f'Body pixel changed: {k}'
   exact=c.shadow_mask(source,(16,8,8))
   if exact.getbbox():
    assert ImageChops.multiply(expected.getchannel('A'),exact).tobytes()!=ImageChops.multiply(source.getchannel('A'),exact).tobytes(),f'Shadow unchanged: {k}'
  x,y,w,h=f['x'],f['y'],f['w'],f['h']
  for actual,edge in [(atlas.crop((x,y-1,x+w,y)),expected.crop((0,0,w,1))),(atlas.crop((x,y+h,x+w,y+h+1)),expected.crop((0,h-1,w,h))),(atlas.crop((x-1,y,x,y+h)),expected.crop((0,0,1,h))),(atlas.crop((x+w,y,x+w+1,y+h)),expected.crop((w-1,0,w,h)))]:assert actual.tobytes()==edge.tobytes()
  assert f['offsetX']==meta['offsetX'] and f['offsetY']==meta['offsetY']
for key in ('npc0','monster4','monster5'):
 actor=m['actors'][key];custom=c.Library(c.rawpath(c.LIBRARIES[key])).frame_set()
 assert actor['sourceFrameSet']=={str(k):v for k,v in custom.items()}
 for action,ident in c.ACTION_IDS.items():
  if action not in actor:continue
  f=custom[ident];assert actor['actionFrameMs'][action]==f['interval']
  for d,row in enumerate(actor[action]):
   indices=list(range(f['count']))
   if f['reverse']:indices.reverse()
   assert row==[f"{key}:{f['start']+d*(f['count']+f['skip'])+i}" for i in indices]
for actor in m['actors'].values():
 for action in ('stand','walk','attack','cast','hit','die'):
  if action not in actor:continue
  assert len(actor[action])==8
  for row in actor[action]:
   for k in row:assert k in m['frames'] or k in m['emptyFrames'],k
 for index in actor['atlases']:assert 0<=index<len(m['atlases'])
for source in fetcher.INPUTS:fetcher.verify_bytes((c.RAW/source.get('localFile',source['path'].replace('/','_'))).read_bytes(),source)
# A synthetic green/black checker becomes continuous shadow, while an opaque
# coloured pixel and an isolated near-black detail retain their exact colour.
fixture=Image.new('RGBA',(16,16));p=fixture.load()
for y in range(3,13):
 for x in range(3,13):
  if (x+y)%2==0:p[x,y]=(0,4,0,255)
p[0,0]=(50,90,120,255);p[15,15]=(0,4,0,255)
fixed=c.smooth_shadow(fixture)
assert fixed.getpixel((0,0))==p[0,0] and fixed.getpixel((15,15))==p[15,15]
assert all(100<=fixed.getpixel((x,y))[3]<=155 for y in range(5,11) for x in range(5,11))
# The monster palette exception must never affect other libraries.
palette=Image.new('RGBA',(16,16));pp=palette.load()
for y in range(3,13):
 for x in range(3,13):
  if (x+y)%2==0:pp[x,y]=(16,8,8,255)
assert c.smooth_shadow(palette,'armour1').tobytes()==palette.tobytes()
for key in ('monster4','monster5'):
 smoothed=c.smooth_shadow(palette,key)
 assert all(smoothed.getpixel((x,y))[:3]==(16,8,8) and 100<=smoothed.getpixel((x,y))[3]<=155 for y in range(5,11) for x in range(5,11))
def rejects(fn):
 try:fn()
 except ValueError:return
 raise AssertionError('Expected rejection')
with tempfile.TemporaryDirectory() as tmp:
 temp=Path(tmp);mapfile=temp/'bad.map'
 for payload in (b'',b'\x01\x00C#',b'\x01\x00C#'+struct.pack('<hh',0,2),b'\x01\x00C#'+struct.pack('<hh',2,2)+b'\x00'*25):
  mapfile.write_bytes(payload);rejects(lambda:c.read_map(mapfile))
 _,_,get=c.read_map(c.RAW/'Map_0.map');rejects(lambda:get(0,700))
 payload=b'pinned bytes';pin=dict(path='fixture',bytes=len(payload),sha256=hashlib.sha256(payload).hexdigest(),httpStatus=206,contentRange='bytes 0-11/30')
 dest=temp/'input.bin';dest.write_bytes(b'original')
 rejects(lambda:fetcher.save_verified(dest,b'bad',pin,206,'bytes 0-11/30'));rejects(lambda:fetcher.save_verified(dest,payload,pin,200,None));assert dest.read_bytes()==b'original'
 fetcher.save_verified(dest,payload,pin,206,'bytes 0-11/30');assert dest.read_bytes()==payload
print(f'PASS: 490000 source collision cells, 484 disjoint chunks, {rendered} render references, {checked} verified atlas frames, {changed} smoothed shadows, all input hashes/status/ranges and actor actions')
