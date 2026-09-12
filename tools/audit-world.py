#!/usr/bin/env python3
"""Inventory candidate world data; never import gameplay flags or enable maps."""
import argparse, hashlib, json, re, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PIN='39e17246a32247a2c43c4cc481e97e88c692fa53'

def parse_maps(text):
    maps={};portals=[];unparsed=[]
    for line,raw in enumerate(text.splitlines(),1):
        value=raw.split(';',1)[0].strip()
        if not value:continue
        declaration=re.match(r'^\[([^\s\]]+)\s+([^\]]+)\](.*)$',value)
        if declaration:
            key,rest,flags=declaration.groups();parts=rest.split()
            maps.setdefault(key,[]).append(dict(line=line,name=parts[0],flags=flags.strip()))
            continue
        door=re.fullmatch(r'(\S+)\s+(-?\d+)[,\s]+(-?\d+)\s*->\s*(\S+)\s+(-?\d+)[,\s]+(-?\d+)(.*)',value)
        if door:
            a,x,y,b,tx,ty,extra=door.groups()
            portals.append(dict(source=a,x=int(x),y=int(y),target=b,tx=int(tx),ty=int(ty),line=line,extra=extra.strip()))
        else:unparsed.append(dict(line=line,text=value))
    return maps,portals,unparsed

def parse_npcs(text):
    rows=[];unparsed=[]
    for line,raw in enumerate(text.splitlines(),1):
        value=raw.split(';',1)[0].strip()
        if not value:continue
        p=value.split()
        if len(p)>=8 and all(p[i].isdigit() for i in [2,3,5,6,7]):
            rows.append(dict(script=p[0],map=p[1],x=int(p[2]),y=int(p[3]),name=p[4],image=int(p[6]),line=line))
        else:unparsed.append(dict(line=line,text=value))
    return rows,unparsed

def legacy_cell(path,x,y):
    # Only decode the independently verified legacy 52 + width*height*12 format.
    b=path.read_bytes();w,h=struct.unpack_from('<hh',b)
    if w<=0 or h<=0 or len(b)!=52+w*h*12:return 'unverified-format'
    if not (0<=x<w and 0<=y<h):return 'out-of-bounds'
    back,_,front=struct.unpack_from('<HHH',b,52+(x*h+y)*12)
    return 'blocked' if (back|front)&32768 else 'walkable'

def build(root):
    reference=root/'raw-assets/reference-server176'
    maps,portals,unknown=parse_maps((reference/'MapInfo.txt').read_text())
    npcs,npc_unknown=parse_npcs((reference/'MerChant.txt').read_text())
    files={p.stem.lower():p for p in (root/'raw-assets/client-176/传奇私服1.76客户/Map').glob('*') if p.suffix.lower()=='.map'}
    registry=json.loads((root/'server/content/world-maps.json').read_text())['maps']
    pins=[json.loads((root/m['pin']).read_text()) for m in registry if m.get('pin')]
    connected={m['id'] for m in registry}
    expected={tuple(p) for pin in pins for p in pin['portals']}
    original={(p['source'],p['x'],p['y'],p['target'],p['tx'],p['ty']) for p in portals}
    checks=[]
    for edge in sorted(expected):
        a,x,y,b,tx,ty=edge
        issues=[]
        if edge not in original:issues.append('absent-from-reference')
        for mid,cx,cy in [(a,x,y),(b,tx,ty)]:
            state=legacy_cell(files[mid.lower()],cx,cy) if mid.lower() in files else 'missing-map'
            if state!='walkable':issues.append(f'{mid}:{cx},{cy}:{state}')
        if any(q[:3]==(b,tx,ty) for q in expected):issues.append('arrival-is-another-door')
        checks.append(dict(edge=edge,issues=issues))
    drift=[]
    frontend=json.loads((root/'client/assets/resources/mir/world-maps.json').read_text())['maps']
    if frontend!=registry:drift.append(dict(issue='stale-client-registry'))
    for row in registry:
        if row['id']!='0' and not (root/f"client/assets/resources/mir/maps/{row['id']}/manifest.json").exists():
            drift.append(dict(issue='missing-client-manifest',map=row['id']))
    seed=(root/'server/DemoSeed.cs').read_text()
    if 'WorldMaps.Seed(envir,root)' not in seed:drift.append(dict(issue='server-registry-not-connected'))
    ids=set(maps)|{p['source'] for p in portals}|{p['target'] for p in portals}|{n['map'] for n in npcs}
    records=[]
    for mid in sorted(ids):
        # Alias declarations remain explicitly unresolved; never guess a file mapping.
        asset=files.get(mid.lower());linked=mid in connected
        records.append(dict(id=mid,names=maps.get(mid,[]),resourceFound=asset is not None,
            converted=mid=='0' or (root/f'client/assets/resources/mir/maps/{mid}/manifest.json').exists(),
            configured=linked,playtestStatus='see-existing-evidence' if linked else 'not-accepted',
            npcCount=sum(n['map']==mid for n in npcs),outgoing=sum(p['source']==mid for p in portals)))
    return dict(source=dict(commit=PIN,warning='Candidate inventory includes custom/later content; not an official 1.76 whitelist.',sha256={n:hashlib.sha256((reference/n).read_bytes()).hexdigest() for n in ['MapInfo.txt','MerChant.txt']}),
        summary=dict(mapIds=len(records),resourcesFound=sum(r['resourceFound'] for r in records),configured=len(connected),portals=len(portals),npcRows=len(npcs),activeDoorChecks=len(checks),activeDoorFailures=sum(bool(c['issues']) for c in checks)+len(drift)),
        maps=records,portals=portals,npcs=npcs,unparsedMaps=unknown,unparsedNPCs=npc_unknown,activeDoors=checks,serverDrift=drift)

def markdown(data):
    s=data['summary'];rows=['# 世界资源与门点盘点（自动生成）','',
        '运行 `python3 tools/audit-world.py --check` 更新。候选全量包含私服或后期内容，不能直接当成1.76开放清单。',
        '',f"候选地图标识 {s['mapIds']}；找到本地同名地图 {s['resourcesFound']}；已配置 {s['configured']}；候选门点 {s['portals']}；NPC记录 {s['npcRows']}。",
        f"已接门点检查 {s['activeDoorChecks']}；失败 {s['activeDoorFailures']}。资源存在不代表素材齐全、NPC已接或可玩验收通过。",'',
        '## 与比奇省直接相连的区域','', '| 地图 | 候选名称 | 地图文件 | 已配置 | NPC记录数 |','|---|---|---|---|---|']
    near={'0'}|{p['target'] for p in data['portals'] if p['source']=='0'}|{p['source'] for p in data['portals'] if p['target']=='0'}
    for r in data['maps']:
        if r['id'] in near:rows.append(f"| {r['id']} | {' / '.join(dict.fromkeys(n['name'] for n in r['names'])) or '未声明'} | {'有' if r['resourceFound'] else '缺失/别名待核对'} | {'是' if r['configured'] else '否'} | {r['npcCount']} |")
    rows += ['', '完整逐地图、逐NPC、逐门点及未解析行见 [world-inventory.json](world-inventory.json)。', '',
        '## 验收边界','', '- 未自动导入 FIGHT、倍率、传送权限等候选规则。', '- 已配置门点检查原候选坐标、原地图碰撞、抵达点是否立即触发另一门点、服务器种子是否一致。', '- 此检查不代替浏览器实际往返、断线重登、室内NPC服务和地图素材完整度验收。','']
    return '\n'.join(rows)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    data=build(ROOT);out=ROOT/'docs/world-inventory.json';out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'docs/world-inventory.md').write_text(markdown(data))
    print(json.dumps(data['summary'],ensure_ascii=False))
    if args.check and data['summary']['activeDoorFailures']:raise SystemExit(1)
