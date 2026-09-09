#!/usr/bin/env python3
import importlib.util
from pathlib import Path
from PIL import Image
r=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('assets',r/'tools/convert-assets.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
# Adjacent atlas slices must have the same alpha as the unsliced checker.
im=Image.new('RGBA',(96,32));im.putdata([(0,0,0,255) if (x+y)%2 else (0,0,0,0) for y in range(32) for x in range(96)])
whole=m.smooth_shadow(im);left=m.smooth_shadow(im.crop((0,0,48,32)));right=m.smooth_shadow(im.crop((48,0,96,32)))
assert left.tobytes()==whole.crop((0,0,48,32)).tobytes()
assert right.tobytes()==whole.crop((48,0,96,32)).tobytes()
assert len(set(whole.getchannel('A').getdata()))==1
# Solid body details must not become transparent.
solid=Image.new('RGBA',(48,32),(0,0,0,255));assert m.smooth_shadow(solid).tobytes()==solid.tobytes()
print('Checker slice edges match unsliced shadow; opaque details preserved')
