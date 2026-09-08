#!/usr/bin/env python3
"""Fetch reproducible Crystal asset inputs in an isolated ego-browser task.
Requires ego-browser CLI. Source asset ownership/licensing remains with rights holders.
Raw downloads stay ignored; converted full-map chunks and provenance are checked in.
"""
import argparse, base64, hashlib, json, os, subprocess, tempfile, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='https://www.mirfiles.com/resources/mir2/crystal/patch/'
INPUTS=json.loads((ROOT/'tools/asset-inputs.json').read_text())['sources']

def verify_bytes(data, source):
    if len(data)!=source['bytes']:
        raise ValueError(f"{source['path']}: expected {source['bytes']} bytes, received {len(data)}")
    actual=hashlib.sha256(data).hexdigest()
    if actual!=source['sha256']:
        raise ValueError(f"{source['path']}: SHA-256 mismatch; pinned source changed or file is corrupt ({actual})")

def verify_response(status, content_range, source):
    if status!=source['httpStatus'] or content_range!=source['contentRange']:
        raise ValueError(f"{source['path']}: expected HTTP {source['httpStatus']} / {source['contentRange']!r}, received {status} / {content_range!r}")

def save_verified(dest, data, source, status, content_range):
    """Verify response and payload first, then atomically replace a same-directory file."""
    verify_response(status, content_range, source)
    verify_bytes(data, source)
    dest=Path(dest)
    dest.parent.mkdir(parents=True,exist_ok=True)
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(dir=dest.parent,prefix=dest.name+'.',suffix='.tmp',delete=False) as f:
            temporary=Path(f.name);f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(temporary,dest)
    finally:
        if temporary is not None:temporary.unlink(missing_ok=True)

def ego(code):
    p=subprocess.run(['zsh','-c',"ego-browser nodejs <<'CRYSTAL_EGO_SCRIPT'\n"+code+"\nCRYSTAL_EGO_SCRIPT\n"],text=True,capture_output=True,check=True)
    lines=[v for v in (p.stdout+p.stderr).splitlines() if v.strip()]
    return json.loads(lines[-1])

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--task-space',default='Crystal asset conversion');args=ap.parse_args()
    # Fail on corrupt existing inputs before opening a browser or overwriting anything.
    raw=ROOT/'raw-assets'
    missing=[]
    for source in INPUTS:
        dest=raw/source.get('localFile',source['path'].replace('/','_'))
        if dest.exists():
            verify_bytes(dest.read_bytes(),source);print('verified',dest.name)
        else:missing.append(source)
    if not missing:return
    task=ego('const t=await useOrCreateTaskSpace('+json.dumps(args.task_space)+');cliLog(JSON.stringify(t.id));')
    prefix=f'await useOrCreateTaskSpace({task});\n'
    raw=ROOT/'raw-assets';raw.mkdir(exist_ok=True)
    try:
        ego(prefix+'await openOrReuseTab('+json.dumps(BASE)+',{wait:true});cliLog(JSON.stringify(true));')
        for source in missing:
            name=source['path'];range_=source['byteRange']
            dest=raw/source.get('localFile',name.replace('/','_'))
            headers={'Range':'bytes='+range_} if range_ else {}
            expression="(()=>{window.crystalDownload={done:false};fetch("+json.dumps(BASE+name)+",{headers:"+json.dumps(headers)+"}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);const b=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));window.crystalDownload={done:true,b:btoa(s),bytes:b.length,status:r.status,contentRange:r.headers.get('content-range')}}).catch(e=>window.crystalDownload={done:true,error:String(e)});return true})()"
            ego(prefix+'cliLog(JSON.stringify(await js('+json.dumps(expression)+')));')
            for attempt in range(180):
                state=ego(prefix+'cliLog(JSON.stringify(await js("({done:crystalDownload.done,error:crystalDownload.error,status:crystalDownload.status,contentRange:crystalDownload.contentRange})")));')
                if state.get('error'):raise RuntimeError(state['error'])
                if state.get('done'):break
                time.sleep(2)
            else:raise TimeoutError(name)
            encoded=ego(prefix+'cliLog(JSON.stringify(await js("crystalDownload.b")));')
            save_verified(dest,base64.b64decode(encoded,validate=True),source,state['status'],state['contentRange'])
            print('saved and verified',dest.name,dest.stat().st_size)
    finally:
        # Dedicated cleanup invocation after output confirmed completion/failure.
        ego(prefix+f'cliLog(JSON.stringify(await completeTaskSpace({task},{{keep:false}})));')
if __name__=='__main__':main()
