#!/usr/bin/env python3
"""Evidence/asset regressions. Raw DBs remain read-only and are never bulk imported."""
import hashlib,importlib.util,json
from pathlib import Path
from PIL import Image
from pypxlib import Table
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'server/content/jewellery.json').read_text())
for s in data['sources']:assert hashlib.sha256((ROOT/s['path']).read_bytes()).hexdigest()==s['sha256']
def read_db(path):
 table=Table(str(ROOT/path),encoding='gb18030')
 try:return [{k:getattr(table[i],k) for k in table.fields} for i in range(len(table))]
 finally:table.close()
a=read_db(data['sources'][0]['path']);b=read_db(data['sources'][1]['path'])
ui=json.loads((ROOT/'client/assets/resources/mir/ui.json').read_text())
for i in data['items']:
 for rows in [a,b]:
  r=next(r for r in rows if r['Name']==i['name'])
  for k,f in [('image','Looks'),('durability','DuraMax'),('weight','Weight'),('level','NeedLevel'),('price','Price')]:assert i[k]==r[f],(i['name'],k)
 r=next(r for r in a if r['Name']==i['name'])
 expected={k:r[f] for k,f in [('MinAC','Ac'),('MaxAC','Ac2'),('MinMAC','Mac'),('MaxMAC','Mac2'),('MinDC','Dc'),('MaxDC','Dc2'),('MinMC','Mc'),('MaxMC','Mc2'),('MinSC','Sc'),('MaxSC','Sc2'),('Accuracy','HitPoint'),('Agility','SpeedPoint')] if r[f]}
 assert i['stats']==expected,(i['name'],'stats')
 assert 'ui:Items:'+str(i['image']) in ui['frames']
 assert not {'Bind','StartItem','Power','Luck'}&set(i)
assert len(data['items'])==11
assert not set(data['excluded'])&{i['name'] for i in data['items']}
assert [(m['image'],m['x'],m['y']) for m in data['merchants']]==[(4,18,6),(5,12,12),(6,6,18)]
assert set(n for m in data['merchants'] for n in m['goods'])=={i['name'] for i in data['items']}
spec=importlib.util.spec_from_file_location('npc',ROOT/'tools/convert-classic-npcs.py');npc=importlib.util.module_from_spec(spec);spec.loader.exec_module(npc)
pin=json.loads(npc.PIN.read_text());manifest=json.loads((npc.OUT/'classic-npc.json').read_text());assert manifest['sources']==pin
for s in pin['sources']:assert hashlib.sha256((ROOT/s['path']).read_bytes()).hexdigest()==s['sha256']
originals=npc.wil.read_library(ROOT/pin['sources'][0]['path'],{int(k.split(':')[-1]) for k in manifest['frames']})
atlas=Image.open(npc.OUT/'classic-npc.png')
for key,f in manifest['frames'].items():
 im,meta=originals[int(key.split(':')[-1])];got=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
 assert im.tobytes()==got.tobytes() and all(f[k]==meta[k] for k in ['w','h','offsetX','offsetY'])
for i in [2,4,5,6,7,9,11]:
 actor=manifest['actors'][f'npc{i}'];assert actor['actionFrameMs']['stand']==200
 assert actor['stand']==[[f'classicnpc:{i*60+d*10+f}' for f in range(4)] for d in range(3)]
print(f'11 cross-checked jewellery goods; {len(manifest["actors"])} original NPC appearances; {len(manifest["frames"])} frames pixel/offset exact')
