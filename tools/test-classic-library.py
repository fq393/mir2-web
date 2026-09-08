"""Real archive regression: one invalid tail index must not block selected valid frames."""
import runpy
from pathlib import Path
read=runpy.run_path(str(Path(__file__).with_name('inspect-classic-ui.py')))['read_library']
p=Path(__file__).resolve().parents[1]/'raw-assets/client-176/传奇私服1.76客户/Data/Items.wil'
frames=read(p,indices=[3,4,9,11,30,60])
assert set(frames)=={3,4,9,11,30,60}
try: read(p,indices=[570])
except ValueError as e: assert '570' in str(e) and 'outside' in str(e)
else: raise AssertionError('Malformed requested frame must fail, never be silently omitted')
print('PASS selected real WIL frames, invalid tail fails explicitly')
