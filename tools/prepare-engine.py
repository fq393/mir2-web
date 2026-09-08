"""Audited snapshot and scheduler hooks; never modify pinned upstream checkout."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
source=root/'vendor/Crystal/Server/MirEnvir/Envir.cs'
pin='0e315fe327192afe52c3d7357ddd1f5b7e26c5b8'
assert subprocess.check_output(['git','-C',str(root/'vendor/Crystal'),'rev-parse','HEAD'],text=True).strip()==pin
text=source.read_text(encoding='utf-8-sig')
needle='                        DragonSystem?.Process();'
assert text.count(needle)==1, 'Upstream tick changed; review snapshot hook'
text=text.replace(needle,needle+'\n                        Mir2.WebHost.WorldSnapshots.Publish(this);')
# Upstream spins even when no deadline is due. Yield one millisecond after a
# complete loop; game/respawn deadlines still use Stopwatch.ElapsedMilliseconds.
idle='                        //   if (Players.Count == 0) Thread.Sleep(1);'
assert text.count(idle)==1, 'Upstream loop changed; review scheduler yield'
text=text.replace(idle,'                        Thread.Sleep(1); // Web host: bounded scheduler yield, no timer scaling.')
out=root/'server/engine/generated/Envir.cs';out.parent.mkdir(parents=True,exist_ok=True)
if not out.exists() or out.read_text()!=text: out.write_text(text)
