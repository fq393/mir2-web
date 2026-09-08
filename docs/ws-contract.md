# Bichon Crystal bridge contract

WS `ws://127.0.0.1:17080/ws`; all state is decoded from real Crystal TCP packets.

`ready`: `{type:"ready",objectId:9,name:"WebGuest1",map:"0",x:282,y:622,direction:6,hp:18,mp:14,level:1,class:0,gender:0,gold:200,inventory:[{slot:0,UniqueID:"3",ItemIndex:1,Count:1,CurrentDura:10000,Info:{Index:1,Name:"BichonSword",Type:1,Shape:1,Image:30,Price:25}},null,...],equipment:[null,...],magics:[{spell:31,level:0}]}`. Inventory 46 slots, equipment14; Weapon slot0, Armour slot1. Arrays preserve nulls. Health is current HP/MP; max stats are not yet exposed.

Inbound:
- `{type:"equip",uniqueId:"3",slot:0}` -> C.EquipItem; wait `EquipItem` Success.
- `{type:"unequip",uniqueId:"3",to:2}` -> C.RemoveItem to inventory2.
- `{type:"attack",direction:2}` -> C.Attack Spell.None. Adjacent direction only.
- `{type:"cast",spell:31,targetId:6,x:282,y:622,direction:4}` -> C.Magic. Direction0..7; spell31 FireBall.
- `{type:"npc",id:1,key:"[@MAIN]"}` -> C.CallNPC. Approach within NPC interaction distance.
- `{type:"npc",id:1,key:"[@BUY]"}` -> actual NPC goods.
- `{type:"buy",itemIndex:7,count:1}` -> C.BuyItem. itemIndex is shop UserItem.UniqueID, NOT its ItemIndex.
- `{type:"revive"}` -> C.TownRevive; original server requires a dead player.
- walk/turn `{type:"walk",direction:2,seq:1}` retain original `state` ack.

All original packets except login/account/UserInformation/KeepAlive also emit `{type:"packet",source:"crystal-tcp",packet:"NAME",data:{OriginalPascalCaseFields}}`. Points `{X,Y}`, enums numeric. Important shapes:
- ObjectMonster: ObjectID,Name,Location,Image (Deer4,Scarecrow5),Direction,Dead
- ObjectNPC: ObjectID,Name,Location,Image0,Direction
- ObjectWalk/ObjectRun/ObjectTurn: ObjectID,Location,Direction
- ObjectAttack/ObjectMagic/ObjectStruck/ObjectDied: ObjectID,Location,Direction (+spell/target fields on magic)
- ObjectRemove: ObjectID
- ObjectHealth: ObjectID,Percent,Expire. Original monster HP percentage (not exact HP).
- HealthChanged: HP,MP (self)
- DamageIndicator: ObjectID,Damage,Type. Negative Damage is HP loss; positive is regeneration.
- EquipItem/RemoveItem: Grid,UniqueID,To,Success. Apply inventory/equipment swap only on Success.
- NPCResponse: Page array of original NPC markup strings, e.g. `<购买装备/@BUY>`.
- NPCGoods: List (UserItems),Rate,Type0,HideAddedStats. List items have UniqueID,ItemIndex,Count. Item Info is supplied separately by NewItemInfo packet `Info`, or ready inventory Info (same ItemIndex).
- GainedItem: Item (UserItem)
- LoseGold/GainedGold: Gold
- Magic: Spell,TargetID,Target{X,Y},Cast,Level

Demo grants existing WebGuest Warriors FireBall through persisted learned skills. Upstream casting path checks learned spell, range, MP, timers; no class restriction there. This is an explicit local demo grant, not standard Warrior progression. Original class, level, location retained. Equipment Shape1, Item images Sword30/Robe60; NPC0; monsters4/5. NPC(290,610), deer around(294,615), scarecrows around(282,621).

Position acknowledgements are serialized at the bridge: only one walk, turn, attack, or cast is sent to Crystal until its UserLocation returns. The original retry queue can reorder commands waiting on different timers, so mere FIFO response tagging with concurrent requests is unsafe. `state.command` names the matching action. Attack/cast have `seq:null, accepted:null`; only walk/turn carry movement seq. The bridge supports FireBall31 casts, rejects unlearned/dead/out-of-range requests before TCP dispatch, and closes an ambiguous session if an expected location reply fails to arrive within8s. It never fabricates a location to clear the queue.
