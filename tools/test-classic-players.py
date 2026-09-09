#!/usr/bin/env python3
import importlib.util,json,hashlib
from pathlib import Path
from PIL import Image
r=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('actors',r/'tools/convert-classic-players.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=json.loads((m.OUT/'classic-player.json').read_text());pin=json.loads((r/'tools/classic-player-inputs.json').read_text())
assert sorted(d['sources'],key=lambda v:v['path'])==sorted(pin['sources'],key=lambda v:v['path'])
for source in d['sources']:assert hashlib.sha256((r/source['path']).read_bytes()).hexdigest()==source['sha256']
atlases=[Image.open(r/'client/assets/resources/mir'/a['file']).convert('RGBA') for a in d['atlases']]
for library in ['Hum','Weapon','Hair']:
 indices={int(k.split(':')[-1]) for k in d['frames'] if k.split(':')[1]==library}
 path=next(p for p in m.SOURCE.iterdir() if p.name.lower()==library.lower()+'.wil');original=m.wil.read_library(path,indices)
 for i in indices:
  f=d['frames'][f'classicplayer:{library}:{i}'];image=atlases[f['atlas']].crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
  if i not in original:assert image.getbbox() is None;continue
  im,meta=original[i];assert image.tobytes()==im.tobytes();assert f['offsetX']==meta['offsetX'] and f['offsetY']==meta['offsetY']
for gender,suffix in [(0,''),(1,'f')]:
 for shape in [1,2,3,4,8,15,16,19]:
  for action,(start,count,stride) in m.ACTIONS.items():
   for direction,frames in enumerate(d['actors'][f'weapon{shape}'+suffix][action]):assert frames==[f'classicplayer:Weapon:{(shape*2+gender)*600+start+direction*stride+f}' for f in range(count)]
print(f'{len(d["frames"])} native actor frames pixel-exact; all exported equipment identities use HA indices')
