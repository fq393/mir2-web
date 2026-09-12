import importlib.util,struct,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('audit-world.py'));audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class WorldAuditTests(unittest.TestCase):
 def test_formats_and_comments(self):
  maps,doors,unknown=audit.parse_maps('[0 比奇省 0] SHOP\n0 1,2 -> 0105 3,4 ; note\n0105 3 5 -> 0 1 3\n;0 9 9 -> 0 9 9')
  self.assertEqual(len(doors),2);self.assertEqual(doors[1]['ty'],3);self.assertEqual(maps['0'][0]['name'],'比奇省');self.assertEqual(unknown,[])
 def test_malformed_not_silently_repaired(self):
  _,doors,unknown=audit.parse_maps('B351 12:13 -> 5 127 301\nD2062 136 188 -> D2063 89.164')
  self.assertEqual(doors,[]);self.assertEqual([r['line'] for r in unknown],[1,2])
 def test_duplicate_declarations_retained(self):
  maps,_,_=audit.parse_maps('[0 比奇省]\n[0 测试地图] FIGHT')
  self.assertEqual(len(maps['0']),2)
 def test_npc_identity_preserves_leading_zero(self):
  rows,unknown=audit.parse_npcs('比奇城/比奇屠夫 0102 9 7 比奇屠夫 0 11 1')
  self.assertEqual((rows[0]['map'],rows[0]['image']),('0102',11));self.assertEqual(unknown,[])
 def test_column_major_collision_and_bounds(self):
  with tempfile.TemporaryDirectory() as folder:
   p=Path(folder)/'a.map';b=bytearray(52+3*2*12);struct.pack_into('<hh',b,0,3,2)
   struct.pack_into('<H',b,52+(1*2+0)*12,32768);p.write_bytes(b)
   self.assertEqual(audit.legacy_cell(p,1,0),'blocked');self.assertEqual(audit.legacy_cell(p,0,1),'walkable');self.assertEqual(audit.legacy_cell(p,3,0),'out-of-bounds')
   p.write_bytes(b[:-1]);self.assertEqual(audit.legacy_cell(p,0,0),'unverified-format')
if __name__=='__main__':unittest.main()
