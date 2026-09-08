#!/usr/bin/env python3
"""Restore byte-pinned original sound resources, without synthesizing missing sounds."""
import base64,hashlib,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def ego(code):
 p=subprocess.run(['ego-browser','nodejs'],input=code,text=True,capture_output=True,check=True);return json.loads([l for l in p.stdout.splitlines() if l.strip()][-1])
def main():
 directory=ROOT/'client/assets/resources/mir/audio';directory.mkdir(parents=True,exist_ok=True);sources=json.loads((ROOT/'tools/audio-inputs.json').read_text())['sources'];missing=[]
 for s in sources:
  p=directory/s['file']
  if p.exists():assert hashlib.sha256(p.read_bytes()).hexdigest()==s['sha256'],p
  elif s.get('local'):
   b=(ROOT/s['local']).read_bytes();assert len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'];p.write_bytes(b)
  else:missing.append(s)
 if not missing:print('Original audio inputs verified');return
 task=ego("cliLog((await useOrCreateTaskSpace('恢复比奇原版音效')).id)");prefix=f'await useOrCreateTaskSpace({task});'
 try:
  ego(prefix+"await openOrReuseTab('https://www.mirfiles.com/resources/mir2/crystal/patch/Sound/',{wait:true});cliLog(true)")
  for s in missing:
   expression="(async()=>{const r=await fetch("+json.dumps(s['url'])+");if(!r.ok)throw Error(r.status);const a=new Uint8Array(await r.arrayBuffer());let v='';for(let i=0;i<a.length;i+=8192)v+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(v)})()"
   b=base64.b64decode(ego(prefix+'cliLog(await js('+json.dumps(expression)+'))'));assert len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256'];(directory/s['file']).write_bytes(b)
  ego(prefix+'cliLog("All original WAV hashes verified")')
 finally:ego(f'cliLog(await completeTaskSpace({task},{{keep:false}}))')
if __name__=='__main__':main()
