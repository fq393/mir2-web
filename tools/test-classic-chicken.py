import importlib.util,json
from pathlib import Path
from PIL import Image,ImageChops
R=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('wil',R/'tools/inspect-classic-ui.py');wil=importlib.util.module_from_spec(spec);spec.loader.exec_module(wil)
m=json.loads((R/'client/assets/resources/mir/actors/classic-chicken.json').read_text());frames=m['frames'];original=wil.read_library(R/m['sources']['sources'][0]['path'],{int(k.split(':')[1]) for k in frames});atlas=Image.open(R/'client/assets/resources/mir/actors/classic-chicken.png').convert('RGBA')
for key,f in frames.items():
 im,meta=original[int(key.split(':')[1])];actual=atlas.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']));assert ImageChops.difference(im,actual).getbbox() is None,key
 assert f['offsetX']==meta['offsetX'] and f['offsetY']==meta['offsetY']
assert len(frames)==232 and len(m['actors']['monster3']['stand'])==8
print('PASS 232 original chicken frames, offsets and eight-direction identity')
