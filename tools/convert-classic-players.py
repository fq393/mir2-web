#!/usr/bin/env python3
"""Native 600-frame HA actors; Shape*2+gender, never Crystal CWeapon numbering."""
import hashlib,importlib.util,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('wil',ROOT/'tools/inspect-classic-ui.py');wil=importlib.util.module_from_spec(spec);spec.loader.exec_module(wil)
SOURCE=ROOT/'raw-assets/client-176/传奇私服1.76客户/Data'
OUT=ROOT/'client/assets/resources/mir/actors'
ACTIONS={'stand':(0,4,8),'walk':(64,6,8),'run':(128,6,8),'attack':(200,6,8),'cast':(392,6,8),'harvest':(456,2,2),'hit':(472,3,8),'die':(536,4,8)}
def build():
 pin=json.loads((ROOT/'tools/classic-player-inputs.json').read_text())
 for source in pin['sources']:
  if hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest()!=source['sha256']:raise ValueError('Original actor source hash mismatch')
 actors={};images={};sources=[]
 for library,kind,shapes in [('Hum','armour',[0,1]),('Weapon','weapon',[1]),('Hair','hair',[0])]:
  path=next(p for p in SOURCE.iterdir() if p.name.lower()==library.lower()+'.wil')
  for p in SOURCE.iterdir():
   if p.stem.lower()==library.lower() and p.suffix.lower() in ['.wil','.wix']:sources.append({'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
  wanted=set()
  for shape in shapes:
   for gender in [0,1]:
    actor={};base=(shape*2+gender)*600
    for action,(start,count,stride) in ACTIONS.items():
     actor[action]=[[f'classicplayer:{library}:{base+start+d*stride+f}' for f in range(count)] for d in range(8)]
     wanted.update(base+start+d*stride+f for d in range(8) for f in range(count))
    actor['actionFrameMs']={'stand':200,'walk':100,'run':100,'attack':100,'cast':100,'harvest':300,'hit':100,'die':100}
    actors[f'{kind}{shape}'+('f' if gender else '')]=actor
  decoded=wil.read_library(path,wanted)
  # Empty overlay frames are meaningful (occluded hair/weapon), never substitute another frame.
  for i in wanted:images[f'classicplayer:{library}:{i}']=decoded.get(i,(Image.new('RGBA',(1,1)),dict(w=1,h=1,offsetX=0,offsetY=0)))
 canvas=Image.new('RGBA',(2048,2048));frames={};atlases=[];x=y=row=0
 OUT.mkdir(parents=True,exist_ok=True)
 def flush():
  nonlocal canvas,x,y,row
  height=1<<(max(1,y+row)-1).bit_length();file=f'actors/classic-player-{len(atlases)}.png'
  canvas.crop((0,0,2048,height)).save(ROOT/'client/assets/resources/mir'/file);atlases.append(dict(file=file,width=2048,height=height));canvas=Image.new('RGBA',(2048,2048));x=y=row=0
 for key,(im,meta) in sorted(images.items(),key=lambda v:-v[1][0].height):
  w,h=im.size
  if x+w+2>2048:x=0;y+=row;row=0
  if y+h+2>2048:flush()
  canvas.paste(im,(x+1,y+1));frames[key]=dict(atlas=len(atlases),x=x+1,y=y+1,**meta);x+=w+2;row=max(row,h+2)
 flush()
 result=dict(actors=actors,frames=frames,atlases=atlases,sources=sources,reference='MirServer-Delphi/MirClient/Actor.pas HA; EM2Engine/ObjBase.pas GetFeature')
 (OUT/'classic-player.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
 print(f'Original player: {len(actors)} identities, {len(frames)} frames, {len(atlases)} atlases')
if __name__=='__main__':build()
