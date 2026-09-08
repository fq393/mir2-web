#!/usr/bin/env python3
"""Read the user-approved legacy 8-bit WIL UI without redrawing pixels."""
import struct
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
def read_library(path,indices=None):
 b=path.read_bytes();w=next(p for p in path.parent.iterdir() if p.stem.lower()==path.stem.lower() and p.suffix.lower()=='.wix').read_bytes()
 assert struct.unpack_from('<i',b,48)[0]==256 and struct.unpack_from('<i',b,56)[0]==0,'Only legacy 8-bit WIL supported'
 palette=[(0,0,0,0)]+[(b[60+(i-1)*4+2],b[60+(i-1)*4+1],b[60+(i-1)*4],255) for i in range(1,256)]
 result={}
 count=(len(w)-48)//4
 for i in range(count) if indices is None else indices:
  if not 0<=i<count:raise ValueError(f'{path.name}:{i} outside WIX index table')
  off=struct.unpack_from('<i',w,48+i*4)[0]
  if off<=0:continue
  if off+8>len(b):raise ValueError(f'{path.name}:{i} offset {off} outside WIL ({len(b)} bytes)')
  width,height,x,y=struct.unpack_from('<4h',b,off)
  if width<=0 or height<=0:continue
  if width>=4096 or height>=4096 or off+8+width*height>len(b):raise ValueError(f'{path.name}:{i} invalid frame dimensions or truncated pixels')
  im=Image.new('RGBA',(width,height));im.putdata([palette[v] for v in b[off+8:off+8+width*height]]);im=im.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  result[i]=(im,{'w':width,'h':height,'offsetX':x,'offsetY':y})
 return result
if __name__=='__main__':
 for name in ['Prguse','Prguse2']:
  frames=read_library(ROOT/'raw-assets/ui-14'/f'{name}.wil')
  for category,subset in [('panels',[(i,im) for i,(im,m) in frames.items() if im.width>=180 and im.height>=100]),('buttons',[(i,im) for i,(im,m) in frames.items() if im.width<180 or im.height<100])]:
   sheet=Image.new('RGB',(1200,((len(subset)+5)//6)*150),(30,30,30));d=ImageDraw.Draw(sheet)
   for j,(i,im) in enumerate(subset):
    x=j%6*200;y=j//6*150;d.text((x,y),f'{name}:{i} {im.width}x{im.height}',fill='white');small=im.copy();small.thumbnail((195,125));sheet.paste(small,(x,y+20),small)
   sheet.save(ROOT/'artifacts'/f'classic-{name}-{category}.png')
  print(name,len(frames))
