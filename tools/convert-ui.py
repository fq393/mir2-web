#!/usr/bin/env python3
"""Extract original user-supplied legacy WIL UI sprites without redrawing them."""
import hashlib,importlib.util,json
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'client/assets/resources/mir'
images=[]
classic_spec=importlib.util.spec_from_file_location('classic',ROOT/'tools/inspect-classic-ui.py');classic=importlib.util.module_from_spec(classic_spec);classic_spec.loader.exec_module(classic)
client176=json.loads((ROOT/'tools/client-176-inputs.json').read_text())
for source in client176['sources']:
 for pin in source['files']:
  b=(ROOT/'raw-assets'/client176['folder']/pin['name']).read_bytes()
  assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],pin['name']
 for i,(img,meta) in classic.read_library(ROOT/'raw-assets'/client176['folder']/source['file'],source['indices']).items():
  if img.width>1:images.append((f"ui:{source['name']}:{i}",img,meta))
frames={};atlases=[];canvas=Image.new('RGBA',(2048,2048));x=y=row=0
for key,img,meta in sorted(images,key=lambda a:-a[1].height):
 w,h=img.size
 if x+w+2>2048:x=0;y+=row;row=0
 if y+h+2>2048:
  file=f'ui-atlas-{len(atlases)}.png';canvas.save(OUT/file,optimize=True);atlases.append({'file':file,'width':2048,'height':2048});canvas=Image.new('RGBA',(2048,2048));x=y=row=0
 canvas.paste(img,(x+1,y+1))
 canvas.paste(img.crop((0,0,w,1)),(x+1,y));canvas.paste(img.crop((0,h-1,w,h)),(x+1,y+h+1));canvas.paste(img.crop((0,0,1,h)),(x,y+1));canvas.paste(img.crop((w-1,0,w,h)),(x+w+1,y+1))
 frames[key]={'atlas':len(atlases),'x':x+1,'y':y+1,**meta};x+=w+2;row=max(row,h+2)
file=f'ui-atlas-{len(atlases)}.png';canvas.save(OUT/file,optimize=True);atlases.append({'file':file,'width':2048,'height':2048})
hud=next(img for key,img,_ in images if key=='ui:ClassicPrguse:1');alpha=hud.getchannel('A');hudRows=[''.join('1' if alpha.getpixel((x,y)) else '0' for x in range(hud.width)) for y in range(hud.height)]
(OUT/'ui.json').write_text(json.dumps({'atlases':atlases,'frames':frames,'client176':client176,'hudHitRows':hudRows},separators=(',',':')))
# Developer contact sheets; never shipped as game UI.
for name in [s['name'] for s in client176['sources']]:
 selected=[(k,img) for k,img,_ in images if k.startswith('ui:'+name+':')]
 if name in ('Items','MagIcon'): 
  sheet=Image.new('RGB',(800,((len(selected)+11)//12)*70),(38,35,30));d=ImageDraw.Draw(sheet)
  for j,(k,img) in enumerate(selected):
   a,b=j%12*66,j//12*70;sheet.paste(img,(a,b+18),img);d.text((a,b),k.split(':')[-1],fill='white')
 else:
  widths=[i.width for _,i in selected];heights=[i.height for _,i in selected];sheet=Image.new('RGB',(max(1300,max(widths)),sum(heights)+24*len(selected)),(35,35,35));d=ImageDraw.Draw(sheet);yy=0
  for k,img in selected:d.text((0,yy),k,fill='white');sheet.paste(img,(0,yy+20),img);yy+=img.height+24
 sheet.save(ROOT/'artifacts'/f'ui-{name}.png')
print(json.dumps({'frames':len(frames),'atlases':len(atlases),'important':{k:[v['w'],v['h']] for k,v in frames.items() if k in ['ui:Prguse:2','ui:Prguse:995','ui:Prguse:1000','ui:Title:196','ui:Title:504','ui:Prguse:340']}}))
