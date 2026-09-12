"""Publish the same reviewed registry used by the server; do not discover/enable rooms."""
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1]
source=root/'server/content/world-maps.json';maps=json.loads(source.read_text())['maps']
ids=[m['id'] for m in maps]
assert len(set(ids))==len(ids) and ids.count('0')==1,'Duplicate or missing base map'
for m in maps:
 if m['id']=='0':continue
 manifest=root/f"client/assets/resources/mir/maps/{m['id']}/manifest.json"
 assert manifest.exists(),f"Registered map lacks frontend resources: {m['id']}"
 assert json.loads(manifest.read_text())['map']['id']==m['id'],'Manifest identity mismatch'
 assert (root/m['pin']).is_file(),'Registered map lacks provenance'
shutil.copyfile(source,root/'client/assets/resources/mir/world-maps.json')
print('Published map registry: '+', '.join(ids))
