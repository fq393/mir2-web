#!/usr/bin/env python3
"""Require shipped harvest/skeleton frames, not just animation declarations."""
import importlib.util,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('convert',ROOT/'tools/convert-assets.py')
convert=importlib.util.module_from_spec(spec);spec.loader.exec_module(convert)
manifest=json.loads((convert.OUT/'manifest.json').read_text());atlases={};checked=0
for actor in ('armour0','armour1','weapon1','hair0','monster4'):
    action='skeleton' if actor=='monster4' else 'harvest'
    library=convert.Library(convert.rawpath(convert.LIBRARIES[actor]))
    rows=manifest['actors'][actor][action]
    assert len(rows)==8,(actor,'directions')
    for direction,row in enumerate(rows):
        assert len(row)==(1 if action=='skeleton' else 2),(actor,'frame count')
        for step,key in enumerate(row):
            expected=224+direction if action=='skeleton' else 344+direction*2+step
            assert key==f'{actor}:{expected}',key
            frame=manifest['frames'].get(key)
            assert frame is not None,f'Declared animation frame was not exported: {key}'
            image,meta=library.frame(expected);image=convert.smooth_shadow(image,actor)
            for field in ('offsetX','offsetY','w','h'):assert frame[field]==meta[field],(key,field)
            n=frame['atlas']
            if n not in atlases:atlases[n]=Image.open(convert.OUT/manifest['atlases'][n]['file']).convert('RGBA')
            crop=atlases[n].crop((frame['x'],frame['y'],frame['x']+frame['w'],frame['y']+frame['h']))
            assert crop.tobytes()==image.tobytes(),f'Source pixels differ: {key}'
            checked+=1
print(f'PASS {checked} native harvest/skeleton frames: exported pixels, offsets and eight directions')
