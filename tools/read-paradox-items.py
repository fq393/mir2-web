#!/usr/bin/env python3
"""Read-only Paradox extraction. Requires pypxlib 2.5 with a matching native pxlib."""
import json
from pathlib import Path
from pypxlib import Table
ROOT=Path(__file__).resolve().parents[1]
for src,out in [('raw-assets/reference-server176/StdItems.DB','raw-assets/reference-server176/StdItems.json'),('vendor/MirServer-Delphi/MirServer/Mud2/DB/StdItems.DB','raw-assets/reference-delphi/StdItems.json')]:
 table=Table(str(ROOT/src),encoding='gb18030')
 try:rows=[{key:getattr(table[i],key) for key in table.fields} for i in range(len(table))]
 finally:table.close()
 (ROOT/out).parent.mkdir(parents=True,exist_ok=True);(ROOT/out).write_text(json.dumps(rows,ensure_ascii=False,default=str)+'\n')
 print(f'{src}: {len(rows)} read-only rows')
