#!/usr/bin/env python3
"""Exact native login/selection pixels and WAV bytes; no redraw or resampling."""
import hashlib, importlib.util, json, shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('classic',ROOT/'tools/inspect-classic-ui.py');classic=importlib.util.module_from_spec(spec);spec.loader.exec_module(classic)
def export():
 pins=json.loads((ROOT/'tools/auth-assets-inputs.json').read_text())
 for pin in pins['files']:
  assert hashlib.sha256((ROOT/pin['path']).read_bytes()).hexdigest()==pin['sha256'],pin['path']
 source=ROOT/pins['files'][0]['path'];out=ROOT/'.runtime/auth-web';out.mkdir(parents=True,exist_ok=True)
 frames=classic.read_library(source);frames[22][0].save(out/'login.png')
 door=Image.new('RGBA',(496*5,361*2))
 for j in range(10):door.paste(frames[23+j][0],(j%5*496,j//5*361))
 door.save(out/'door.png');portraits={}
 for role in range(3):
  for gender in range(2):
   base=40+role*40+gender*120;indices=list(range(base,base+16))+[base+20]
   w=max(frames[i][0].width for i in indices);h=max(frames[i][0].height for i in indices)
   sheet=Image.new('RGBA',(w*4,h*5))
   for j,i in enumerate(indices):sheet.paste(frames[i][0],(j%4*w,j//4*h))
   name=f'portrait-{role}-{gender}';sheet.save(out/(name+'.png'));portraits[name]={'w':w,'h':h,'indices':indices}
 for pin,name in zip(pins['files'][2:],['login.wav','select.wav','door.wav']):shutil.copyfile(ROOT/pin['path'],out/name)
 (out/'manifest.json').write_text(json.dumps({'portraits':portraits,'door':{'count':10,'w':496,'h':361,'ms':230}}))
 return out
if __name__=='__main__':print(export())
