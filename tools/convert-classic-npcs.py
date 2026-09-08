#!/usr/bin/env python3
"""Original NPC 2/4/5/6/11: Delphi MA35, image*60 + direction*10 + frame."""
import hashlib,importlib.util,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('wil',ROOT/'tools/inspect-classic-ui.py');wil=importlib.util.module_from_spec(spec);spec.loader.exec_module(wil)
OUT=ROOT/'client/assets/resources/mir/actors';PIN=ROOT/'tools/classic-npc-inputs.json'
def build():
 pin=json.loads(PIN.read_text())
 for s in pin['sources']:
  if hashlib.sha256((ROOT/s['path']).read_bytes()).hexdigest()!=s['sha256']:raise ValueError('NPC library hash mismatch')
 actors={f'npc{i}':dict(stand=[[f'classicnpc:{i*60+d*10+f}' for f in range(4)] for d in range(3)],actionFrameMs=dict(stand=200)) for i in [2,4,5,6,11]}
 indices={int(k.split(':')[-1]) for a in actors.values() for direction in a['stand'] for k in direction}
 images=wil.read_library(ROOT/pin['sources'][0]['path'],indices)
 if set(images)!=indices:raise ValueError('NPC animation frame missing')
 canvas=Image.new('RGBA',(1024,1024));frames={};x=y=row=0
 for i,(im,meta) in sorted(images.items()):
  w,h=im.size
  if x+w+2>1024:x=0;y+=row;row=0
  if y+h+2>1024:raise ValueError('NPC atlas overflow')
  canvas.paste(im,(x+1,y+1));frames[f'classicnpc:{i}']=dict(atlas=0,x=x+1,y=y+1,**meta);x+=w+2;row=max(row,h+2)
 height=1<<(y+row-1).bit_length();OUT.mkdir(parents=True,exist_ok=True);canvas.crop((0,0,1024,height)).save(OUT/'classic-npc.png')
 (OUT/'classic-npc.json').write_text(json.dumps(dict(frames=frames,actors=actors,atlases=[dict(file='actors/classic-npc.png',width=1024,height=height)],sources=pin),ensure_ascii=False,separators=(',',':'))+'\n')
 print(f'Exported {len(frames)} original NPC frames, {len(actors)} appearances x 3 directions x 4 stand frames')
if __name__=='__main__':build()
