#!/usr/bin/env python3
import hashlib,json,wave
from pathlib import Path
root=Path(__file__).resolve().parents[1];m=json.loads((root/'tools/audio-inputs.json').read_text());duration=0
for f in m['sources']:
 p=root/'client/assets/resources/mir/audio'/f['file'];b=p.read_bytes();assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
 assert (root/f['local']).read_bytes()==b, f['file']
 with wave.open(str(p)) as w:
  assert w.getnchannels() in (1,2) and w.getframerate()>0 and w.getnframes()>0;duration+=w.getnframes()/w.getframerate()
assert {'M31-0.wav','M31-1.wav','M31-2.wav','004-3.wav','005-3.wav'}<={s['file'] for s in m['sources']}
print(f'PASS: {len(m["sources"])} original WAV hashes and PCM headers, {duration:.2f}s total')

lst=m['originalSoundList'];assert hashlib.sha256((root/lst['local']).read_bytes()).hexdigest()==lst['sha256']
import re
mapping={int(a):b.lower() for a,b in re.findall(r'^\s*(\d+):\s+wav\\([^\r\n]+)',(root/lst['local']).read_text(encoding='gb18030'),re.M)}
files={f['file']:f for f in m['sources']}
for category in ['fireball','deer','scarecrow']:
 for alias,index in lst[category].items():assert mapping[index]==files[alias]['originalFilename'].lower()
print(f'All {len(m["sources"])} match local original bytes; 9 renamed event files match original sound.lst IDs')
