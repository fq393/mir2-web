#!/usr/bin/env python3
"""Build an isolated browser fixture; never copy live accounts or modify live ports.
Run the printed host/static commands, then use credentials.json only for local QA.
"""
from pathlib import Path
import json,shutil,uuid,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
qa=root/'.runtime/skillkeys-qa'
if qa.exists():raise SystemExit('QA root already exists; keep it for relogin checks. Refusing to overwrite.')
qa.mkdir(mode=0o700)
(qa/'SKILL_KEYS_QA_ONLY').write_text('Isolated synthetic skills; not 1.76 content.\n')
credentials=qa/'credentials.json';credentials.write_text(json.dumps({'account':'Q'+uuid.uuid4().hex[:10],'password':'Q'+uuid.uuid4().hex[:14]}));credentials.chmod(0o600)
(qa/'server/data').mkdir(parents=True)
for name in ['raw-assets','tools']:(qa/name).symlink_to(root/name,target_is_directory=True)
shutil.copytree(root/'server/content',qa/'server/content')
program=(root/'server/Program.cs').read_text()
assert program.count('const int crystalPort = 17000;')==1 and program.count('envir.Start();')==1
program=program.replace('const int crystalPort = 17000;','const int crystalPort = 17100;').replace('127.0.0.1:17080','127.0.0.1:17180').replace('127.0.0.1:17000','127.0.0.1:17100').replace('envir.Start();','SkillKeysFixture.Seed(envir,repoRoot);\nenvir.Start();')
(qa/'server/Program.cs').write_text(program)
project=ET.parse(root/'server/Mir2.Headless.csproj')
for compile in project.findall('.//Compile'):
 path=compile.attrib['Include']
 if path!='Program.cs':compile.set('Include',str(root/'server'/path))
for ref in project.findall('.//ProjectReference'):ref.set('Include',str(root/'server'/ref.attrib['Include']))
ET.SubElement(project.find('.//ItemGroup'),'Compile',Include=str(root/'tools/fixtures/SkillKeysFixture.cs'))
project.write(qa/'server/SkillKeysQA.csproj')
shutil.copytree(root/'build/web',qa/'web')
entry=qa/'web/assets/main/index.js';code=entry.read_text()
assert 'ws://127.0.0.1:17080/ws' in code
entry.write_text(code.replace('ws://127.0.0.1:17080/ws','ws://127.0.0.1:17180/ws'))
print('Fixture ready. Credentials are local only:',credentials)
print('Host: MIR2_ROOT="$PWD/.runtime/skillkeys-qa" .runtime/dotnet/dotnet run --project .runtime/skillkeys-qa/server/SkillKeysQA.csproj')
print('Web: python3 -m http.server 17610 --bind 127.0.0.1 --directory .runtime/skillkeys-qa/web')
