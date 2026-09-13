#!/usr/bin/env python3
"""Create a separate port-17180 protocol fixture; never use the main account files."""
from pathlib import Path
import json
import re
import secrets
import shutil

root = Path(__file__).resolve().parent.parent
qa = root / '.runtime/storage-protocol-qa'
(qa / 'server').mkdir(parents=True, exist_ok=True)
(qa / 'STORAGE_PROTOCOL_QA_ONLY').touch()
for name in ['raw-assets', 'tools']:
    path = qa / name
    if not path.exists():
        path.symlink_to(root / name, target_is_directory=True)
shutil.copytree(root / 'server/content', qa / 'server/content', dirs_exist_ok=True)
credentials = qa / 'credentials.json'
if not credentials.exists():
    credentials.write_text(json.dumps({'account': 'sq' + secrets.token_hex(4), 'password': secrets.token_hex(6)}))
    credentials.chmod(0o600)
program = (root / 'server/Program.cs').read_text()
for old, new in [
    ('const int crystalPort = 17000;', 'const int crystalPort = 17100;'),
    ('http://127.0.0.1:17080', 'http://127.0.0.1:17180'),
    ('envir.Start();', 'StorageProtocolFixture.Seed(envir,repoRoot);\nenvir.Start();'),
]:
    assert program.count(old) == 1, f'QA source anchor changed: {old}'
    program = program.replace(old, new)
(qa / 'server/Program.cs').write_text(program)
project = (root / 'server/Mir2.Headless.csproj').read_text()
project = re.sub(r'<Compile Include="([^"]+)"', lambda m: '<Compile Include="' +
    (m[1] if m[1] == 'Program.cs' else str(root / 'server' / m[1])) + '"', project)
project = project.replace('engine/CrystalEngine.csproj', str(root / 'server/engine/CrystalEngine.csproj'))
project = project.replace('</Project>', f'<ItemGroup><Compile Include="{root}/tools/StorageProtocolFixture.cs" /></ItemGroup></Project>')
(qa / 'server/StorageQA.csproj').write_text(project)
print('Prepared isolated storage protocol QA; TCP 17100 / WebSocket 17180. Main data untouched.')
