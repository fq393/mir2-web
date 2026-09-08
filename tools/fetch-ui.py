#!/usr/bin/env python3
"""Fetch pinned native UI libraries using ego-browser's logged-in browser transport."""
import base64,hashlib,json,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def ego(code):
 p=subprocess.run(['ego-browser','nodejs'],input=code,text=True,capture_output=True,check=True)
 return json.loads([line for line in p.stdout.splitlines() if line.strip()][-1])
def verify(data,source):
 if len(data)!=source['bytes'] or hashlib.sha256(data).hexdigest()!=source['sha256']:raise ValueError('Native UI input changed: '+source['name'])
def main():
 config=json.loads((ROOT/'tools/ui-inputs.json').read_text());sources=config['sources'];missing=[]
 classic=config.get('classicSources',[])
 for source in sources:
  file=ROOT/'raw-assets'/('UI_'+source['name']+'.Lib')
  if file.exists():verify(file.read_bytes(),source)
  else:missing.append(source)
 missing_classic=[p for p in classic if not (ROOT/'raw-assets'/p['archive']).exists()]
 for pin in classic:
  archive=ROOT/'raw-assets'/pin['archive']
  if archive.exists():
   assert hashlib.sha256(archive.read_bytes()).hexdigest()==pin['sha256']
   folder=ROOT/'raw-assets'/pin['folder'];folder.mkdir(exist_ok=True);subprocess.run(['bsdtar','-xf',str(archive),'-C',str(folder)],check=True)
 if not missing and not missing_classic:print('Native UI inputs verified');return
 task=ego("const t=await useOrCreateTaskSpace('Mir2 原生UI素材');cliLog(t.id)")
 prefix=f'await useOrCreateTaskSpace({task});\n'
 try:
  ego(prefix+"await openOrReuseTab('https://www.mirfiles.com/resources/mir2/crystal/patch/Data/',{wait:true});cliLog(true)")
  for source in missing:
   url='https://www.mirfiles.com/resources/mir2/crystal/patch/'+source['path']
   expression="(async()=>{const r=await fetch("+json.dumps(url)+");if(r.status!==200)throw Error('HTTP '+r.status);const b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s)})()"
   data=base64.b64decode(ego(prefix+'cliLog(await js('+json.dumps(expression)+'))'),validate=True);verify(data,source)
   dest=ROOT/'raw-assets'/('UI_'+source['name']+'.Lib');temporary=dest.with_suffix('.tmp');temporary.write_bytes(data);temporary.replace(dest)
   print('Native UI saved and verified:',source['name'])
  for pin in missing_classic:
   expression="(async()=>{const r=await fetch("+json.dumps(pin['url'])+");if(!r.ok)throw Error(r.status);const a=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<a.length;i+=16384)s+=String.fromCharCode(...a.subarray(i,i+16384));return btoa(s)})()"
   data=base64.b64decode(ego(prefix+'cliLog(await js('+json.dumps(expression)+'))'));assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
   archive=ROOT/'raw-assets'/pin['archive'];archive.write_bytes(data);folder=ROOT/'raw-assets'/pin['folder'];folder.mkdir(exist_ok=True);subprocess.run(['bsdtar','-xf',str(archive),'-C',str(folder)],check=True)
 finally:ego(f'cliLog(await completeTaskSpace({task},{{keep:false}}))')
if __name__=='__main__':main()
