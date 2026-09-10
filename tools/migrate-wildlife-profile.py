"""Append newly sourced species without overwriting existing admin tuning."""
import json,shutil,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1];path=root/'server/data/overrides/bichon-wildlife.json'
if path.exists():
 old=json.loads(path.read_text());base=json.loads((root/'server/content/bichon-wildlife.json').read_text())
 existing={r['key'] for r in old['monsters']};added=[r for r in base['monsters'] if r['key'] not in existing];names={r['name'] for r in added}
 if added:
  old['monsters']+=added;old['respawns'] += [r for r in base['respawns'] if r['name'] in names]
  for r in added:old['drops'][r['key']]=base['drops'][r['key']]
  # Source metadata follows the current baseline; tuned numeric rows remain byte-for-value.
  for key in ('notes','sources','status'):old[key]=base[key]
  backup=path.with_name(path.name+'.'+datetime.datetime.now().strftime('%Y%m%d%H%M%S')+'.bak');shutil.copy2(path,backup)
  tmp=path.with_suffix('.json.tmp');tmp.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
  print('Appended species: '+', '.join(sorted(names))+'; existing tuning preserved; backup '+backup.name)
 else:print('No missing species; unchanged')
else:print('No override; baseline used')
