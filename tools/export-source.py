"""Export a reviewable source-only tree without touching the development Git history."""
from pathlib import Path
import subprocess, shutil, json, re
root=Path(__file__).resolve().parents[1]
out=root/'.runtime/github-source';out.mkdir(parents=True,exist_ok=True)
paths=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0')
allowed={'.ts','.cs','.csproj','.py','.mjs','.js','.json','.md','.txt','.sh','.command','.meta','.scene','.prefab','.html','.css','.yml','.yaml'}
selected=[]
for value in sorted(set(paths)):
 p=Path(value)
 if not value or not (root/p).is_file():continue
 if p.parts[0] not in {'client','server','tools','docs','tasks','README.md','package.json','package-lock.json','.gitignore','启动传奇.command'}:continue
 if value.startswith(('client/assets/resources/','docs/qa/','server/engine/generated/')):continue
 if p.suffix not in allowed and value!='.gitignore':continue
 if (root/p).stat().st_size>2_000_000:raise SystemExit('Unexpected large source: '+value)
 data=(root/p).read_bytes()
 if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}',data):raise SystemExit('Potential credential: '+value)
 selected.append(value)
# Delete only files exported by this tool in the previous run.
manifest=out/'.source-export.json'
previous=json.loads(manifest.read_text()) if manifest.exists() else []
for value in set(previous)-set(selected):
 p=out/value
 if p.is_file():p.unlink()
for value in selected:
 target=out/value;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/value,target)
manifest.write_text(json.dumps(selected,ensure_ascii=False,indent=2))
with (out/'.gitignore').open('a') as f:f.write('\n.source-export.json\nclient/assets/resources/mir/\ndocs/qa/\n')
print(json.dumps({'files':len(selected),'bytes':sum((out/p).stat().st_size for p in selected),'output':str(out)},ensure_ascii=False))
