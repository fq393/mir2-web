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
# Serialize uncommitted escrow as returned assets in the existing account schema.
account_save='                    AccountList[i].Save(writer);'
assert text.count(account_save)==1
text=text.replace(account_save,'                    Mir2.WebHost.TradeAccountSnapshot.Write(writer, AccountList[i], Players);')
# Keep the last valid account file present until a complete replacement exists.
text=text.replace('File.Move(AccountPath, Path.Combine(AccountsBackUpPath, fileName));','File.Copy(AccountPath, Path.Combine(AccountsBackUpPath, fileName));')
old='                if (File.Exists(AccountPath))\n                    File.Move(AccountPath, AccountPath + "o");\n                File.Move(AccountPath + "n", AccountPath);\n                if (File.Exists(AccountPath + "o"))\n                    File.Delete(AccountPath + "o");'
assert text.count(old)==1
text=text.replace(old,'                File.Move(AccountPath + "n", AccountPath, true);')
old='                    if (File.Exists(oldfilename))\n                        File.Move(oldfilename, oldfilename + "o");\n                    File.Move(newfilename, oldfilename);\n                    if (File.Exists(oldfilename + "o"))\n                        File.Delete(oldfilename + "o");'
assert text.count(old)==1
text=text.replace(old,'                    File.Move(newfilename, oldfilename, true);')
# Async write failures must be visible and release the file handle.
a=text.index('        private void EndSaveAccounts(');b=text.index('        public bool LoadDB()',a)
method=text[a:b].replace('                    fStream.Dispose();','                    fStream.Flush(true);\n                    fStream.Dispose();')
old='            catch (Exception)\n            {\n            }\n\n            Saving = false;'
assert method.count(old)==1
method=method.replace(old,'            catch (Exception ex) { MessageQueue.Enqueue(ex); }\n            finally { fStream?.Dispose(); Saving = false; }')
text=text[:a]+method+text[b:]
# Serialization failures must not permanently suppress later saves.
a=text.index('        public void BeginSaveAccounts()');b=text.index('        private void EndSaveAccounts(',a)
method=text[a:b];start=method.index('            using (var mStream');end=method.rfind('        }')
method=method[:start]+'            try\n            {\n'+method[start:end]+'            }\n            catch (Exception ex) { Saving = false; MessageQueue.Enqueue(ex); }\n'+method[end:]
text=text[:a]+method+text[b:]
# Durable trade saves must propagate failure to the transaction boundary.
anchor='        public void SaveAccounts()'
assert text.count(anchor)==1
text=text.replace(anchor,'''        public void SaveTradeAccountsOrThrow(PlayerObject first, PlayerObject second)
        {
            if (!Players.Contains(first) || !Players.Contains(second) ||
                !AccountList.Contains(first.Account) || !AccountList.Contains(second.Account))
                throw new InvalidOperationException("Trade participants are not registered for saving.");
            var deadline = System.Diagnostics.Stopwatch.StartNew();
            while (Saving) {
                if (deadline.ElapsedMilliseconds > 10000) throw new IOException("Previous account save did not finish.");
                Thread.Sleep(1);
            }
            using (var memory = new MemoryStream()) {
                SaveAccounts(memory);
                using (var file = new FileStream(AccountPath + "n", FileMode.Create, FileAccess.Write, FileShare.None)) {
                    byte[] data = memory.ToArray(); file.Write(data, 0, data.Length); file.Flush(true);
                }
                File.Move(AccountPath + "n", AccountPath, true);
            }
        }

'''+anchor)
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
# Escrow owns return capacity until cancellation or the final two-party settlement.
replace_player('return (ulong)gold + Account.Gold <= uint.MaxValue;', 'return (ulong)gold + Account.Gold + (WebTradeCapacityReleased ? 0u : TradeGoldAmount) <= uint.MaxValue;')
replace_player('''            if (((UInt64)Account.Gold + gold) > uint.MaxValue)
                gold = uint.MaxValue - Account.Gold;''','''            ulong available = (ulong)uint.MaxValue - Account.Gold;
            if (!WebTradeCapacityReleased) available = available >= TradeGoldAmount ? available - TradeGoldAmount : 0;
            gold = (uint)Math.Min((ulong)gold, available);''')
# Direct inventory-slot insertions do not all call CanGainItem.
import re
for method in ['RemoveItem','RemoveSlotItem','TakeBackItem','TakeBackHeroItem','RetrieveRefineItem']:
    pattern=r'(        public void '+method+r'\([^\n]*\)\s*\{\s*S\.[^;]+;)'
    player,n=re.subn(pattern, r'\1\n            if (!WebTradeCapacityReleased && Info.Trade.Any(i => i != null) && FreeSpace(Info.Inventory) <= 0) { Enqueue(p); return; }',player,count=1)
    assert n==1, 'Review reserved-slot insertion: '+method
replace_player('                    Info.Inventory[to] = MyGuild.StoredItems[from].Item;','                    if (!WebTradeCapacityReleased && FreeSpace(Info.Inventory) <= 0) { Enqueue(p); return; }\n                    Info.Inventory[to] = MyGuild.StoredItems[from].Item;')
replace_player('            var packet = new S.RetrieveRentalItem { From = from, To = to, Success = false };', '            var packet = new S.RetrieveRentalItem { From = from, To = to, Success = false };\n            if (!WebTradeCapacityReleased && FreeSpace(Info.Inventory) <= 0) { Enqueue(packet); return; }')
# Successful settlement may consume outgoing escrow capacity, and only for its duration.
a=player.index('        public void TradeConfirm(bool confirm)')
b=player.index('        public void TradeCancel()',a)
method=player[a:b]
anchor='            PlayerObject[] TradePair = new PlayerObject[2] { TradePartner, this };'
start=method.index(anchor)+len(anchor)
end=method.rfind('        }')
method=method[:start]+'\n            foreach (var member in TradePair) member.WebTradeCapacityReleased = true;\n            try\n            {\n'+method[start:end]+'\n            }\n            finally { foreach (var member in TradePair) member.WebTradeCapacityReleased = false; }\n'+method[end:]
player=player[:a]+method+player[b:]
# Replace the unpersisted swap/notification loop; retain the upstream preflight.
a=player.index('        public void TradeConfirm(bool confirm)');b=player.index('        public void TradeCancel()',a)
method=player[a:b];start=method.index('            //swap items');end=method.index('            finally {')
method=method[:start]+'''            if (CanTrade) Mir2.WebHost.PlayerTradeCommit.Apply(TradePair[0], TradePair[1],
                () => Envir.SaveTradeAccountsOrThrow(TradePair[0], TradePair[1]));
            }
'''+method[end:]
method=method.replace('            UserItem u;\n','')
player=player[:a]+method+player[b:]
replace_player('            Enqueue(new S.GainedGold { Gold = gold });','            WebTradeNotify(new S.GainedGold { Gold = gold });')
# Cancellation returns escrow, so it must inspect physical capacity, not subtract itself.
a=player.index('        public void TradeCancel()');b=player.index('        #endregion',a)
method=player[a:b].replace('FreeSpace(TradePair[p].Info.Inventory) < 1','!TradePair[p].Info.Inventory.Any(i => i == null)').replace('TradePair[p].CanGainItem(temp)','TradePair[p].Info.Inventory.Any(i => i == null)')
method=method.replace('''                        TradePair[p].GainGold(TradePair[p].TradeGoldAmount);
                        TradePair[p].TradeGoldAmount = 0;''','''                        uint refund = TradePair[p].TradeGoldAmount;
                        TradePair[p].TradeGoldAmount = 0;
                        TradePair[p].GainGold(refund);''')
player=player[:a]+method+player[b:]

human=(root/'vendor/Crystal/Server/MirObjects/HumanObject.cs').read_text(encoding='utf-8-sig')
def replace_human(old,new):
    global human
    assert human.count(old)==1, 'Review inventory capacity patch: '+old[:80]
    human=human.replace(old,new)
replace_human('''        protected static int FreeSpace(IList<UserItem> array)
''','''        public bool WebTradeCapacityReleased;
        protected int FreeSpace(IList<UserItem> array)
''')
replace_human('''                if (array[i] == null) count++;

            return count;''','''                if (array[i] == null) count++;

            if (!WebTradeCapacityReleased && ReferenceEquals(array, Info.Inventory))
                count -= Info.Trade.Count(i => i != null);
            return Math.Max(0, count);''')
# A logically full bag can still contain physically empty, reserved slots.
replace_human('''                    if (bagItem.Info != item.Info) continue;''','''                    if (bagItem == null || bagItem.Info != item.Info) continue;''')
replace_human('        public bool WebTradeCapacityReleased;','''        public bool WebTradeCapacityReleased;
        public List<Packet> WebTradeNotifications;
        public void WebTradeNotify(Packet packet)
        {
            if (WebTradeNotifications != null) WebTradeNotifications.Add(packet);
            else Enqueue(packet);
        }''')
replace_human('            Enqueue(new S.GainedItem { Item = clonedItem });','            WebTradeNotify(new S.GainedItem { Item = clonedItem });')
out=root/'server/engine/generated/HumanObject.cs'
if not out.exists() or out.read_text()!=human: out.write_text(human)

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

# Exclude protected cells once when assembling natural wildlife respawn candidates.
map_source=(root/'vendor/Crystal/Server/MirEnvir/Map.cs').read_text(encoding='utf-8-sig')
anchor='info.WalkableCells = WalkableCells.Where(x =>'
assert map_source.count(anchor)==1
map_source=map_source.replace(anchor,anchor+'\n                        Mir2.WebHost.SpawnSafety.Allows(this, info.Monster, x) &&')
out=root/'server/engine/generated/Map.cs'
if not out.exists() or out.read_text()!=map_source: out.write_text(map_source)
