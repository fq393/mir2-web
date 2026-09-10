#!/usr/bin/env python3
"""Appr 160 / MA11 from pinned Delphi Actor.pas, original Mon17 WIL."""
import hashlib,importlib.util,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('wil',ROOT/'tools/inspect-classic-ui.py');wil=importlib.util.module_from_spec(spec);spec.loader.exec_module(wil)
pin=json.loads((ROOT/'tools/classic-chicken-inputs.json').read_text())
for p in pin['sources']:
 assert hashlib.sha256((ROOT/p['path']).read_bytes()).hexdigest()==p['sha256']
actions={'stand':(0,4,10,200),'walk':(80,6,10,120),'attack':(160,6,10,100),'hit':(240,2,2,100),'die':(260,10,10,140),'skeleton':(340,1,1,100)}
actor={a:[[f'classicchicken:{start+d*stride+f}' for f in range(count)] for d in range(8)] for a,(start,count,stride,ms) in actions.items()}
actor['actionFrameMs']={a:v[3] for a,v in actions.items()};wanted={int(k.split(':')[1]) for a in actions for direction in actor[a] for k in direction}
images=wil.read_library(ROOT/pin['sources'][0]['path'],wanted)
assert set(images)==wanted, 'Missing original chicken frames'
canvas=Image.new('RGBA',(1024,1024));frames={};x=y=row=0
for i,(im,meta) in sorted(images.items()):
 w,h=im.size
 if x+w+2>1024:x=0;y+=row;row=0
 assert y+h+2<=1024
 canvas.paste(im,(x+1,y+1));frames[f'classicchicken:{i}']=dict(atlas=0,x=x+1,y=y+1,**meta);x+=w+2;row=max(row,h+2)
height=1<<(y+row-1).bit_length();out=ROOT/'client/assets/resources/mir/actors';canvas.crop((0,0,1024,height)).save(out/'classic-chicken.png')
(out/'classic-chicken.json').write_text(json.dumps(dict(frames=frames,actors={'monster3':actor},atlases=[dict(file='actors/classic-chicken.png',width=1024,height=height)],sources=pin),ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Original chicken: {len(frames)} frames')
