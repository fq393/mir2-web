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

# Safety corrections to the pinned trading implementation. Keep upstream intact;
# exact anchors fail the build if its implementation changes.
player=(root/'vendor/Crystal/Server/MirObjects/PlayerObject.cs').read_text(encoding='utf-8-sig')
def replace_player(old,new,count=1):
    global player
    assert player.count(old)==count, 'Upstream trade changed; review patch: '+old[:80]
    player=player.replace(old,new)
replace_player('''        public void DepositTradeItem(int from, int to)
''','''        // Revalidate the original adjacent, facing-player requirement at acceptance.
        private bool WebTradePeerValid(PlayerObject other)
        {
            return other != null && other != this && !Dead && !other.Dead &&
                CurrentMap != null && CurrentMap == other.CurrentMap &&
                Functions.InRange(CurrentLocation, other.CurrentLocation, 1) &&
                Functions.FacingEachOther(Direction, CurrentLocation, other.Direction, other.CurrentLocation);
        }

        public void DepositTradeItem(int from, int to)
''')
replace_player('''            S.DepositTradeItem p = new S.DepositTradeItem { From = from, To = to, Success = false };
''','''            S.DepositTradeItem p = new S.DepositTradeItem { From = from, To = to, Success = false };

            if (!WebTradePeerValid(TradePartner) || TradePartner.TradePartner != this)
            {
                Enqueue(p);
                return;
            }
''')
replace_player('''            TradePartner = TradeInvitation;
            TradeInvitation.TradePartner = this;''','''            if (!AllowTrade || !WebTradePeerValid(TradeInvitation))
            {
                TradeInvitation = null;
                return;
            }

            TradePartner = TradeInvitation;
            TradeInvitation.TradePartner = this;''')
replace_player('''            if (!Functions.InRange(TradePartner.CurrentLocation, CurrentLocation, Globals.DataRange) || TradePartner.CurrentMap != CurrentMap ||
                !Functions.FacingEachOther(Direction, CurrentLocation, TradePartner.Direction, TradePartner.CurrentLocation))''','''            if (!WebTradePeerValid(TradePartner) || TradePartner.TradePartner != this)''')
replace_player('''        public void TradeGold(uint amount)
        {
            TradeUnlock();

            if (TradePartner == null) return;''','''        public void TradeGold(uint amount)
        {
            if (!WebTradePeerValid(TradePartner) || TradePartner.TradePartner != this) return;
            TradeUnlock();''')
# Repeated deposits must retain the full unsigned balance instead of wrapping.
replace_player("            if (amount < 1 || Account.Gold < amount)\n", "            if (amount < 1 || Account.Gold < amount || amount > uint.MaxValue - TradeGoldAmount)\n")
# Both item capacity and wallet capacity failures tell clients to unlock. The
# authoritative flags must agree so one later click cannot commit both parties.
replace_player('''                    CanTrade = false;
                    TradePair[p].ReceiveChat''','''                    CanTrade = false;
                    TradeUnlock();
                    TradePair[p].ReceiveChat''',2)
out=root/'server/engine/generated/PlayerObject.cs'
if not out.exists() or out.read_text()!=player: out.write_text(player)

# Quote without changing shared shop instances. Partial used stacks retain the
# remainder; only successful commits remove stock (upstream discarded it).
npc=(root/'vendor/Crystal/Server/MirObjects/NPC/NPCScript.cs').read_text(encoding='utf-8-sig')
def replace_npc(old,new):
    global npc
    assert npc.count(old)==1, 'Upstream shop changed; review patch: '+old[:80]
    npc=npc.replace(old,new)
replace_npc('''            if ((isBuyBack || isUsed) && count > goods.Count)
                count = goods.Count;
            else
                goods.Count = count;

            uint cost = goods.Price();''','''            bool instanceStock = isBuyBack || isUsed;
            if (instanceStock && count > goods.Count) count = goods.Count;
            var quoted = goods.Clone();
            quoted.Count = count;

            uint cost = quoted.Price();''')
replace_npc('''            uint baseCost = (uint)(goods.Price() * PriceRate(player, true));''','''            uint baseCost = (uint)(quoted.Price() * PriceRate(player, true));''')
replace_npc('''            UserItem item = (isBuyBack || isUsed) ? goods : Envir.CreateFreshItem(goods.Info);
            item.Count = goods.Count;

            if (!player.CanGainItem(item)) return;''','''            if (!player.CanGainItem(quoted)) return;
            bool split = instanceStock && count < goods.Count;
            UserItem item = instanceStock ? (split ? quoted : goods) : Envir.CreateFreshItem(goods.Info);
            if (split) item.UniqueID = ++Envir.NextUserItemID;
            item.Count = count;''')
replace_npc('''                callingNPC.UsedGoods.Remove(goods); //If used or buyback will destroy whole stack instead of reducing to remaining quantity''','''                if (split) goods.Count -= count;
                else callingNPC.UsedGoods.Remove(goods);''')
replace_npc('''                callingNPC.BuyBack[player.Name].Remove(goods); //If used or buyback will destroy whole stack instead of reducing to remaining quantity''','''                if (split) goods.Count -= count;
                else callingNPC.BuyBack[player.Name].Remove(goods);''')
out=root/'server/engine/generated/NPCScript.cs'
if not out.exists() or out.read_text()!=npc: out.write_text(npc)
