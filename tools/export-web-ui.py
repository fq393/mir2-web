#!/usr/bin/env python3
"""Exact WIL images for browser text-input surfaces; no redraw or resampling."""
import importlib.util,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('classic',ROOT/'tools/inspect-classic-ui.py');classic=importlib.util.module_from_spec(spec);spec.loader.exec_module(classic)
p=json.loads((ROOT/'tools/client-176-inputs.json').read_text());source=next(v for v in p['sources'] if v['name']=='ClassicPrguse');folder=ROOT/'raw-assets'/p['folder']
for pin in source['files']:
 data=(folder/pin['name']).read_bytes();assert hashlib.sha256(data).hexdigest()==pin['sha256']
out=ROOT/'client/assets/resources/mir/webui';out.mkdir(exist_ok=True);frames={}
for i,(im,meta) in classic.read_library(folder/source['file'],[50,52,60,61,62,63,64,65,68,69,73,74,75,76,77,78,120,122,123,124,125]).items():
 im.save(out/f'{i}.png');frames[str(i)]=meta
(out/'frames.json').write_text(json.dumps(frames));print(frames)

mini=json.loads((ROOT/'tools/minimap-inputs.json').read_text())
for pin in mini['files']:
 assert hashlib.sha256((ROOT/pin['path']).read_bytes()).hexdigest()==pin['sha256']
source=ROOT/mini['files'][0]['path'];im,_=classic.read_library(source,[mini['frame']])[mini['frame']];im.save(out/'bichon-map.png')
b=source.read_bytes();colors={str(i):'#%02x%02x%02x'%(b[60+(i-1)*4+2],b[60+(i-1)*4+1],b[60+(i-1)*4]) for i in [218,249,255]}
(out/'minimap-colors.json').write_text(json.dumps(colors))
