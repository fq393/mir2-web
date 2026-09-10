"""Export only pinned Crystal Healing 200..209/370..379 without rewriting world assets."""
import importlib.util,json,hashlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('assets',ROOT/'tools/convert-assets.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
for pin in json.loads((ROOT/'tools/asset-inputs.json').read_text())['sources']:
 if pin['path']=='Data/Magic.Lib':assert hashlib.sha256((ROOT/'raw-assets'/pin['localFile']).read_bytes()).hexdigest()==pin['sha256']
lib=a.Library(a.rawpath('Data/Magic.Lib'));atlas=Image.new('RGBA',(2048,2048));frames={};x=y=row=0
for i in list(range(200,210))+list(range(370,380)):
 im,meta=lib.frame(i);w,h=im.size
 if x+w+2>2048:x=0;y+=row;row=0
 assert y+h+2<=2048
 atlas.paste(im,(x+1,y+1));frames[f'healing:{i}']=dict(atlas=0,x=x+1,y=y+1,**meta);x+=w+2;row=max(row,h+2)
height=1<<(y+row-1).bit_length();out=ROOT/'client/assets/resources/mir/actors';atlas.crop((0,0,2048,height)).save(out/'healing.png')
(out/'healing.json').write_text(json.dumps(dict(frames=frames,atlases=[dict(file='actors/healing.png',width=2048,height=height)])))
# Verify the saved atlas, including transparent pixels and the original anchor offsets.
with Image.open(out/'healing.png') as saved:
 for key,meta in frames.items():
  original,source=lib.frame(int(key.split(':')[1]));w,h=original.size
  assert saved.crop((meta['x'],meta['y'],meta['x']+w,meta['y']+h)).tobytes()==original.tobytes(),key
  assert all(meta[k]==v for k,v in source.items()),key
print('Exported and verified 20 original healing frames: pixels and offsets')
