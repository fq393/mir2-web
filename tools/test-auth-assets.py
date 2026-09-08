#!/usr/bin/env python3
"""Independent per-cell comparison against pinned WIL frames, including transparent pixels."""
import importlib.util,json,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('classic',ROOT/'tools/inspect-classic-ui.py');classic=importlib.util.module_from_spec(spec);spec.loader.exec_module(classic)
pins=json.loads((ROOT/'tools/auth-assets-inputs.json').read_text());out=ROOT/'.runtime/auth-web'
for p in pins['files']:assert hashlib.sha256((ROOT/p['path']).read_bytes()).hexdigest()==p['sha256']
f=classic.read_library(ROOT/pins['files'][0]['path']);assert Image.open(out/'login.png').tobytes()==f[22][0].tobytes()
door=Image.open(out/'door.png')
for j in range(10):assert door.crop((j%5*496,j//5*361,j%5*496+496,j//5*361+361)).tobytes()==f[23+j][0].tobytes()
manifest=json.loads((out/'manifest.json').read_text())
for name,meta in manifest['portraits'].items():
 sheet=Image.open(out/(name+'.png'));w,h=meta['w'],meta['h']
 for j,i in enumerate(meta['indices']):
  expected=Image.new('RGBA',(w,h));expected.paste(f[i][0],(0,0))
  assert sheet.crop((j%4*w,j//4*h,j%4*w+w,j//4*h+h)).tobytes()==expected.tobytes(),(name,i)
for p,name in zip(pins['files'][2:],['login.wav','select.wav','door.wav']):assert hashlib.sha256((out/name).read_bytes()).hexdigest()==p['sha256']
print('113 native image frames and 3 original WAVs verified byte-for-byte')
# Selection deletion uses the original Prguse frames, including down states.
uiPins=json.loads((ROOT/'tools/client-176-inputs.json').read_text())
uiSource=next(s for s in uiPins['sources'] if s['name']=='ClassicPrguse')
for pin in uiSource['files']:assert hashlib.sha256((ROOT/'raw-assets'/uiPins['folder']/pin['name']).read_bytes()).hexdigest()==pin['sha256']
for index,(expected,_) in classic.read_library(ROOT/'raw-assets'/uiPins['folder']/uiSource['file'],[70,360,363,364,365,366,367,368]).items():
 actual=Image.open(ROOT/'build/web/webui'/f'{index}.png')
 assert actual.size==expected.size and actual.tobytes()==expected.tobytes(),index
print('8 original deletion/confirmation frames verified byte-for-byte')
