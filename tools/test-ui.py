#!/usr/bin/env python3
"""Check every shipped UI pixel and offset against the user's pinned WIL/WIX pair."""
import hashlib,json,runpy
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];out=root/'client/assets/resources/mir';m=json.loads((out/'ui.json').read_text());pin=json.loads((root/'tools/client-176-inputs.json').read_text());assert m['client176']==pin
read=runpy.run_path(str(root/'tools/inspect-classic-ui.py'))['read_library'];originals={};atlases=[Image.open(out/a['file']).convert('RGBA') for a in m['atlases']]
for source in pin['sources']:
 for f in source['files']:
  b=(root/'raw-assets'/pin['folder']/f['name']).read_bytes();assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
 originals[source['name']]=read(root/'raw-assets'/pin['folder']/source['file'],source['indices'])
for key,f in m['frames'].items():
 _,name,index=key.split(':');im,meta=originals[name][int(index)];actual=atlases[f['atlas']].crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']));assert actual.tobytes()==im.tobytes(),key;assert all(f[k]==meta[k] for k in ['w','h','offsetX','offsetY']),key
assert all(k in m['frames'] for k in ['ui:ClassicPrguse:1','ui:ClassicPrguse:3','ui:ClassicPrguse:370','ui:ClassicPrguse:376','ui:Items:9','ui:Items:11','ui:Items:30','ui:Items:60','ui:Stateitem:30','ui:Stateitem:60'])
print(f"PASS {len(m['frames'])} shipped frames: original client WIL pixels, offsets and 12 file hashes")

hud=originals['ClassicPrguse'][1][0];rows=m['hudHitRows'];assert len(rows)==hud.height
for y,row in enumerate(rows):
 assert len(row)==hud.width
 for x,pixel in enumerate(row):assert (pixel=='1')==(hud.getpixel((x,y))[3]>0)
print('HUD hit mask matches all 800x251 original alpha pixels')
