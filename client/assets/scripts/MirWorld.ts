import {playerLayers,equippedShape,actorFrame} from './core/appearance';
import {MiniMap} from './platform/MiniMap';
import {PartyUI} from './platform/PartyUI';
import {AccountUI} from './platform/AccountUI';
import {ChatInput} from './platform/ChatInput';
import {ATTACK_MODES} from './core/social';
import {itemDescription,itemHintPosition,itemRequirements,compactBagDescription} from './core/itemStats';
import {CLASSIC,worldToScreen,screenToCell,blocksWorld,PanelRect,JEWELLERY_SLOTS} from './core/classicLayout';
import {gainItem,consumeItem,equipmentTarget} from './core/inventory';
import {healthWidth,showHealth} from './core/health';
import {MirAudio} from './platform/MirAudio';
import {stepSound} from './core/stepSound';
import { _decorator, Component, Node, UITransform, Sprite, SpriteFrame, Texture2D, ImageAsset,
    resources, JsonAsset, Rect, Vec3, Color, Graphics, Label,LabelOutline, input, Input, EventKeyboard,
    EventMouse, EventTouch, KeyCode, Layers, view, ResolutionPolicy, Size, Vec2, profiler, game, Game, UIOpacity } from 'cc';
import { findPath, canStep, directionTo, Grid, Point } from './core/grid';
import { Manifest, Frame, Ref } from './core/assets';
import { CrystalConnection } from './platform/connection';
import { MirSprite } from './renderer/MirSprite';
import { TerrainStream, SpriteStore, resource, actorOrder } from './renderer/TerrainStream';

const { ccclass } = _decorator;
const C = {gold:new Color(202,171,110),paper:new Color(220,218,197),dark:new Color(19,24,21,248),line:new Color(87,75,51),muted:new Color(150,163,143)};
type TileRef = Ref & {drawX?:number;drawY?:number;floor?:boolean;render?:boolean;blend?:boolean};
type CachedFrame = {sprite:SpriteFrame;meta:Frame};
type RenderTile = {node:Node;x:number;y:number;w:number;h:number;sort:number;kind:string};
type Peer = {node:Node;body:Sprite;point:Point;visual:Point;from:Point;direction:number;elapsed:number;name?:string;kind?:string;image?:number;hp?:number;healthUntil?:number;nameHeight?:number;healthBar?:{node:Node;fill:Sprite};dead?:boolean;harvested?:boolean;action?:string;actionTime?:number;label?:Label;weapon?:Sprite;hair?:Sprite;armour?:number;weaponShape?:number;hairShape?:number;gender?:number};

@ccclass('MirWorld')
export class MirWorld extends Component {
    private itemTooltip?:Node;private itemTooltipOwner?:Node;private itemTooltipDock?:Node;private mousePoint={x:0,y:0};
    private party?:PartyUI;
    private gender=0;private hairShape=0;private missingActors=new Set<string>();
    private characterName="旅人";
    private accounts?:AccountUI;
    private chatInput?:ChatInput;private miniMap?:MiniMap;
    private attackMode=0;
    private manifest!:Manifest;
    private resizeObserver:ResizeObserver|null=null;
    private maps=new Map<string,{map:Manifest['map'];grid:Grid}>();private mapId='0';
    private sound=new MirAudio();private stepSoundPhase=0;
    private frames=new Map<string,CachedFrame>();
    private grid!:Grid;
    private ground!:Node;
    private lootLayer!:Node;private loot=new Map<number,{node:Node;label:Label;point:Point;name:string}>();private pickupTarget=0;
    private objects!:Node;
    private world!:Node;
    private body!:Sprite;
    private feet!:Node;
    private marker!:Node;
    private collision!:Node;
    private coord!:Label;
    private status!:Label;
    private hint!:Label;
    private tiles:RenderTile[]=[];
    private point:Point={x:0,y:0};
    private visual:Point={x:0,y:0};
    private path:Point[]=[];private pathFailures=0;
    private keys=new Set<number>();
    private step:{from:Point;to:Point;elapsed:number;seq:number}|null=null;
    private nextSequence=0;
    private facing=4;
    private animationClock=0;private worldClock=0;
    private lastFrame='';
    private ready=false;private hudRows:string[]=[];private panelRects:PanelRect[]=[];private inventoryPage='bag';private bagOpen=false;private characterOpen=false;private carrySprite?:Sprite;private bagIcons=new Map<number,Node>();private bagSwapSource=-1;private shopTop=0;private shopBagOpen=true;private hovered=0;
    private connection:CrystalConnection|null=null;
    private debug=false;
    private zoom=1;
    private statusText='加载真实地图…';
    private serverReady=false;
    private confirmed:Point|null=null;
    private peers=new Map<number,Peer>();
    private ownId=0;private hudRoot!:Node;
    private store!:SpriteStore;private terrain!:TerrainStream;private labels!:Node;private effects!:Node;
    private camera:Point={x:0,y:0};private weapon!:Sprite;private hair!:Sprite;private ownLabel!:Label;
    private ownHealth!:{node:Node;fill:Sprite};private displayedMaxHP=0;private displayedMaxMP=0;
    private ghost!:Sprite;private ownAction='stand';private actionTime=0;private selected=0;
    private handWeight=0;private maxHandWeight=0;private wearWeight=0;private maxWearWeight=0;private bagGold:Label|null=null;private bagWeights:Label|null=null;private bagStatus:Label|null=null;private bagHighlights=new Map<number,Graphics>();private selectedBag=-1;private selectedBagAt=0;private lastBagTouch=-Infinity;private bagMovePending=false;
    private authoritativeMaxHP=0;private authoritativeMaxMP=0;private experience=0;private maxExperience=0;private bagWeight=0;private maxBagWeight=0;private magics:any[]=[];private expBar!:Sprite;private weightBar!:Sprite;
    private job=0;private hpBase!:Sprite;private hp=0;private mp=0;private gold=0;private level=1;private inventory:any[]=[];private equipment:any[]=[];
    private stats!:Label;private targetText!:Label;private logText!:Label;private menu!:Node;
    private tradeMode="sell";private tradeItem:any=null;private tradeQuote:any=null;private tradeRequest=0;
    private logs:string[]=[];private npcPage:string[]=[];private menuKind='';private npcId=0;private goods:any[]=[];private lastAttack=0;
    private collisionCell='';private particleEffects:{node:Node;sprite:Sprite;keys:string[];age:number;life:number;from:Point;to:Point}[]=[];

    async start():Promise<void> {
        view.setDesignResolutionSize(800,600,ResolutionPolicy.SHOW_ALL);
        view.resizeWithBrowserSize(true);profiler.hideStats();
        // Cocos 3.8 compares inline sizes; our CSS min()/4:3 frame can change
        // without changing those strings. Keep framebuffer and input scale in sync.
        if(typeof ResizeObserver!=='undefined'&&typeof document!=='undefined'){
            const frame=document.getElementById('GameDiv');
            if(frame){this.resizeObserver=new ResizeObserver(()=>{const r=frame.getBoundingClientRect();if(r.width>0&&r.height>0)view.setFrameSize(r.width,r.height);});this.resizeObserver.observe(frame);}
        }
        this.world=this.makeNode('World',this.node);
        this.ground=this.makeNode('Ground',this.world);
        this.lootLayer=this.makeNode('Ground items',this.world);
        this.collision=this.makeNode('Collision',this.world);
        this.objects=this.makeNode('Objects',this.world);
        this.effects=this.makeNode('Effects',this.world);this.labels=this.makeNode('Names',this.world);
        this.marker=this.makeNode('Destination',this.world);
        const mark=this.marker.addComponent(Graphics);mark.lineWidth=2;mark.strokeColor=C.gold;
        mark.moveTo(0,10);mark.lineTo(16,0);mark.lineTo(0,-10);mark.lineTo(-16,0);mark.close();mark.stroke();this.marker.active=false;
        this.createHUD();
        try {
            this.manifest=(await this.load<JsonAsset>('mir/manifest',JsonAsset)).json as Manifest;this.manifest.map.name='比奇省';
            const nativeUI=(await resource<JsonAsset>('mir/ui',JsonAsset)).json as any;const atlasBase=this.manifest.atlases.length;this.hudRows=nativeUI.hudHitRows??[];
            Object.values(nativeUI.frames).forEach((f:any)=>f.atlas+=atlasBase);Object.assign(this.manifest.frames,nativeUI.frames);this.manifest.atlases.push(...nativeUI.atlases);
            this.store=new SpriteStore(this.manifest);this.frames=this.store.frames;
            const classicNPC=(await resource<JsonAsset>('mir/actors/classic-npc',JsonAsset)).json as any;
            const npcAtlasBase=this.manifest.atlases.length;
            Object.values(classicNPC.frames).forEach((f:any)=>f.atlas+=npcAtlasBase);
            Object.assign(this.manifest.frames,classicNPC.frames);this.store.registerFrames(classicNPC.frames);this.manifest.atlases.push(...classicNPC.atlases);
            this.manifest.actors={...this.manifest.actors,...classicNPC.actors};
            const actorKeys:string[]=[];
            const collect=(v:any):void=>{if(typeof v==='string'&&this.manifest.frames[v])actorKeys.push(v);else if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object')Object.values(v).forEach(collect);};
            collect(this.manifest.player);collect(this.manifest.actors);collect(this.manifest.spellFireBall);actorKeys.push(...Object.keys(nativeUI.frames));await this.store.keys(actorKeys);this.createNativeHUD();
            const room=(await resource<JsonAsset>('mir/maps/0105/manifest',JsonAsset)).json as any;
            const roomBase=this.manifest.atlases.length;
            Object.values(room.frames).forEach((f:any)=>f.atlas+=roomBase);
            room.map.chunks.forEach((c:any)=>c.atlases=c.atlases.map((i:number)=>i+roomBase));
            Object.assign(this.manifest.frames,room.frames);this.store.registerFrames(room.frames);this.manifest.atlases.push(...room.atlases);
            for(const map of [this.manifest.map,room.map]){
                const blocked=new Set<string>();
                const data=(await resource<JsonAsset>('mir/'+map.collisionFile,JsonAsset)).json as any;
                data.rows.forEach((row:string,y:number)=>{for(let x=0;x<row.length;x++)if(row[x]==='1')blocked.add(`${x},${y}`);});
                this.maps.set(map.id??'0',{map,grid:{width:map.width,height:map.height,blocked}});
            }
            this.grid=this.maps.get('0')!.grid;
            this.point={...this.manifest.map.spawn};this.visual={...this.point};
            this.terrain=new TerrainStream(this.manifest,this.store,this.ground,this.objects,text=>this.notice(text));this.buildPlayer();this.ready=true;
            this.hint.string='1–6 物品栏 · F1 火球 · 空格攻击 · B 背包';
            input.on(Input.EventType.KEY_DOWN,this.onKeyDown,this);input.on(Input.EventType.KEY_UP,this.onKeyUp,this);
            input.on(Input.EventType.MOUSE_UP,this.onMouse,this);input.on(Input.EventType.TOUCH_END,this.onTouch,this);
            input.on(Input.EventType.MOUSE_MOVE,this.onHover,this);
            if(typeof document!=='undefined')document.addEventListener('pointermove',this.trackPointer,true);
            game.on(Game.EVENT_HIDE,this.pauseInput,this);
            this.connection=new CrystalConnection(text=>{this.statusText=text;},event=>this.serverEvent(event));
            this.connection.connect();this.updateView();
            // Read-only diagnostics for repeatable browser acceptance.
            (globalThis as any).__MIRQA={state:()=>({mapId:this.mapId,appearance:{gender:this.gender,hair:this.hairShape},missingActors:Array.from(this.missingActors),layout:CLASSIC,panels:this.menu?.active?this.panelRects:[],menuKind:this.menuKind,audio:this.sound.snapshot(),ready:this.ready,point:{...this.point},visual:{...this.visual},facing:this.facing,moving:!!this.step,queued:this.path.length,status:this.statusText,serverReady:this.serverReady,ownId:this.ownId,peers:Array.from(this.peers.entries()).map(([id,p])=>({id,point:p.point})),frameCount:this.frames.size,tileCount:this.terrain.tiles.size,origin:{x:this.manifest.map.originX,y:this.manifest.map.originY},spawn:this.manifest.map.spawn,map:{width:this.grid.width,height:this.grid.height},blocked:Array.from(this.grid.blocked),experience:this.experience,maxExperience:this.maxExperience,bagWeight:this.bagWeight,maxBagWeight:this.maxBagWeight,handWeight:this.handWeight,maxHandWeight:this.maxHandWeight,wearWeight:this.wearWeight,maxWearWeight:this.maxWearWeight,selectedBag:this.selectedBag,bagMovePending:this.bagMovePending,magics:this.magics,hp:this.hp,mp:this.mp,maxHP:this.displayedMaxHP,maxMP:this.displayedMaxMP,ownHealthVisible:this.ownHealth?.node.active,hpDisplay:this.hpText?.string,mpDisplay:this.mpText?.string,gold:this.gold,selected:this.selected,inventory:this.inventory,equipment:this.equipment,groundItems:Array.from(this.loot.entries()).map(([id,v])=>({id,point:v.point,name:v.name})),entities:Array.from(this.peers.entries()).map(([id,p])=>({id,name:p.name,kind:p.kind,gender:p.gender,hair:p.hairShape,armour:p.armour,weapon:p.weaponShape,hp:p.hp,healthVisible:p.healthBar?.node.active??false,healthUntil:p.healthUntil,dead:p.dead,point:p.point})),logs:this.logs}),screenFor:(x:number,y:number)=>worldToScreen({x,y},this.camera)};
        } catch(error) {
            console.error('Mir2 load failed',error);this.hint.string=`资源加载失败：${String(error)}`;this.statusText='加载失败';
        }
    }

    private load<T>(path:string,type:any):Promise<T> {
        return new Promise((resolve,reject)=>resources.load(path,type,(error,asset)=>error?reject(error):resolve(asset as T)));
    }
    private makeNode(name:string,parent:Node):Node {
        const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.addComponent(UITransform);return n;
    }
    private text(parent:Node,value:string,x:number,y:number,size=16,color=C.paper,width=400):Label {
        const n=this.makeNode(value,parent);n.setPosition(x,y);n.getComponent(UITransform)!.setContentSize(width,size+10);
        const label=n.addComponent(Label);label.string=value;label.fontFamily='"NSimSun","SimSun","Songti SC",serif';label.fontSize=size;label.lineHeight=size+2;
        label.color=color;label.horizontalAlign=Label.HorizontalAlign.LEFT;label.overflow=Label.Overflow.CLAMP;
        n.getComponent(UITransform)!.setAnchorPoint(0,0.5);return label;
    }
    private createHUD():void {
        this.hudRoot=this.makeNode('Loading',this.node);this.hint=this.text(this.hudRoot,'正在加载原生地图与界面素材…',-260,0,18,C.paper,620);this.status=this.text(this.hudRoot,this.statusText,-260,-38,13,C.muted,620);
    }
    private sprite(parent:Node,name:string):Sprite {const n=this.makeNode(name,parent);n.getComponent(UITransform)!.setAnchorPoint(0,1);const s=n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.RAW;return s;}
    private buildPlayer():void {
        this.feet=this.makeNode('Player',this.objects);this.weapon=this.sprite(this.feet,'Weapon');this.body=this.sprite(this.feet,'Body');this.hair=this.sprite(this.feet,'Hair');
        this.ghost=this.sprite(this.effects,'Occlusion silhouette');this.ghost.node.addComponent(UIOpacity).opacity=90;
        this.ownLabel=this.text(this.labels,'旅人',0,0,12,Color.WHITE,160);this.ownLabel.horizontalAlign=Label.HorizontalAlign.CENTER;this.outlineName(this.ownLabel);this.ownHealth=this.makeHealthBar();
    }
    private pathFor(from:Point,to:Point,avoid?:Point):Point[]{
        const blocked=new Set(this.grid.blocked);if(avoid)blocked.add(`${avoid.x},${avoid.y}`);this.peers.forEach(p=>{if(!p.dead&&(p.point.x!==from.x||p.point.y!==from.y))blocked.add(`${p.point.x},${p.point.y}`);});
        return findPath({...this.grid,blocked},from,to);
    }
    private reset():void {if(!this.ready||!this.serverReady)return;this.path=this.pathFor(this.step?.to??this.point,this.manifest.map.spawn);}
    private onKeyDown(e:EventKeyboard):void {if(this.accounts?.active||this.chatInput?.editing||(typeof document!=='undefined'&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName??'')))return;if(this.menu.active&&this.menuKind==='skillKeys'){
        if(e.keyCode===KeyCode.ESCAPE){if(this.selectedBag>=6){this.selectedBag=-1;return;}this.menu.active=false;if(this.targetText)this.targetText.string='';return;}
        if(e.keyCode===KeyCode.ENTER){this.saveSkillKey();return;}
        if(!this.skillPending&&e.keyCode>=KeyCode.F1&&e.keyCode<=KeyCode.F8){this.bindingKey=e.keyCode-KeyCode.F1+1;this.showSkillKeys(this.bindingSpell,false);}
        return;
    }if(e.keyCode===KeyCode.KEY_G){this.party?.toggle();return;}if(e.keyCode===KeyCode.KEY_H&&(this.keys.has(KeyCode.CTRL_LEFT)||this.keys.has(KeyCode.CTRL_RIGHT))){this.connection?.send({type:"attackMode",mode:(this.attackMode+1)%6});return;}this.sound.unlock();if(e.keyCode===KeyCode.KEY_B||e.keyCode===KeyCode.F9){this.showInventory('bag');return;}if(e.keyCode===KeyCode.F10){this.showInventory('character');return;}if(e.keyCode===KeyCode.F11){this.showSkills();return;}if(e.keyCode>=KeyCode.DIGIT_1&&e.keyCode<=KeyCode.DIGIT_6){this.usePotion(this.inventory[e.keyCode-KeyCode.DIGIT_1]);return;}if(e.keyCode>=KeyCode.F1&&e.keyCode<=KeyCode.F8){this.castKey(e.keyCode-KeyCode.F1+1);return;}if(e.keyCode===KeyCode.SPACE){this.attack();return;}if(e.keyCode===KeyCode.ESCAPE){if(this.selectedBag>=6){this.selectedBag=-1;return;}this.menu.active=false;if(this.targetText)this.targetText.string='';this.selected=0;return;}this.pickupTarget=0;this.keys.add(e.keyCode);this.path=[];if(this.ready&&!this.step)this.beginStep();}
    // Keep pointer coordinates available across Cocos UI hit regions. Capture them
    // before dispatch, using the same 800x600 transform as rendering.
    private trackPointer=(event:PointerEvent):void=>{
        const canvas=document.querySelector('canvas'),rect=canvas?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return;
        this.mousePoint={x:(event.clientX-rect.left)*800/rect.width,y:(event.clientY-rect.top)*600/rect.height};
        this.positionCarriedItem();this.positionItemTooltip();
    };
    private onKeyUp(e:EventKeyboard):void {this.keys.delete(e.keyCode);}
    private pauseInput():void {this.sound.stop();this.keys.clear();this.path=[];}
    private onMouse(e:EventMouse):void {if(this.accounts?.active||this.selectedBag>=6)return;this.sound.unlock();if(e.getButton()!==0)return;const p=e.getUILocation();if(this.keys.has(KeyCode.ALT_LEFT)||this.keys.has(KeyCode.ALT_RIGHT)){this.harvestAt({x:p.x,y:600-p.y});return;}this.destination(p);}
    private onTouch(e:EventTouch):void {if(this.accounts?.active||this.selectedBag>=6)return;this.sound.unlock();const p=e.getUILocation();if(this.keys.has(KeyCode.ALT_LEFT)||this.keys.has(KeyCode.ALT_RIGHT)){this.harvestAt({x:p.x,y:600-p.y});return;}this.destination(p);}
    private onHover(e:EventMouse):void {
        if(!this.ready)return;const p=e.getUILocation(),screen={x:p.x,y:600-p.y};
        this.mousePoint=screen;this.positionItemTooltip();this.positionCarriedItem();
        this.hovered=blocksWorld(screen.x,screen.y,this.menu.active?this.panelRects:[],this.hudRows)?0:this.entityAt(screen);
    }
    private entityAt(screen:Point,corpse=false):number {
        const cell=screenToCell(screen,this.camera),wx=screen.x-400+this.camera.x*48,wy=screen.y-222+this.camera.y*32;
        return Array.from(this.peers.entries()).filter(([,p])=>{if(corpse?(!p.dead||p.kind!=='monster'||p.harvested):p.dead)return false;const f=p.body.spriteFrame;if(!f)return p.point.x===cell.x&&p.point.y===cell.y;
            const left=p.visual.x*48+p.body.node.position.x,top=p.visual.y*32-p.body.node.position.y;return wx>=left&&wx<=left+f.rect.width&&wy>=top&&wy<=top+f.rect.height-12;
        }).sort((a,b)=>b[1].point.y-a[1].point.y)[0]?.[0]??0;
    }
    private clearLoot():void {this.loot.forEach(v=>{v.node.destroy();v.label.node.destroy();});this.loot.clear();this.pickupTarget=0;}
    private groundItem(d:any,gold=false):void {
        const old=this.loot.get(d.objectid);old?.node.destroy();old?.label.node.destroy();
        // Native DnItems, not inventory Items. Gold thresholds match pinned ItemObject.
        const image=gold?(d.gold<100?112:d.gold<200?113:d.gold<500?114:d.gold<1000?115:116):d.image;
        const f=this.frames.get(`ui:DnItems:${image}`);if(!f){this.notice(`地面物品原图尚未接入：${d.name??'金币'}`);return;}
        const sprite=this.sprite(this.lootLayer,'Ground item '+d.objectid);sprite.spriteFrame=f.sprite;
        sprite.node.setPosition(d.location.x*48+(48-f.meta.w)/2,-d.location.y*32-(32-f.meta.h)/2);
        const name=gold?`${d.gold} 金币`:this.itemName({info:{name:d.name}});
        const label=this.text(this.labels,name,d.location.x*48+24-80,-d.location.y*32+18,12,gold?C.gold:this.nameColor(d.namecolour),160);label.horizontalAlign=Label.HorizontalAlign.CENTER;this.outlineName(label);
        this.loot.set(d.objectid,{node:sprite.node,label,point:d.location,name});
    }
    private pickupAtDestination():void {
        if(!this.pickupTarget||this.step||!this.serverReady||this.hp<=0)return;
        const item=this.loot.get(this.pickupTarget);if(!item){this.pickupTarget=0;return;}
        if(this.point.x===item.point.x&&this.point.y===item.point.y){this.pickupTarget=0;this.connection?.send({type:'pickup'});}
        else if(!this.path.length)this.pickupTarget=0;
    }
    private destination(p:{x:number;y:number}):void {
        if(!this.ready||!this.serverReady)return;
        const screen={x:p.x,y:600-p.y};if(blocksWorld(screen.x,screen.y,this.menu.active?this.panelRects:[],this.hudRows))return;
        const {x,y}=screenToCell(screen,this.camera),id=this.entityAt(screen);this.pickupTarget=0;
        if(id){this.selected=id;this.path=[];if(this.peers.get(id)?.kind==='npc')this.talk();return;}
        this.selected=0;this.pickupTarget=Array.from(this.loot.entries()).find(([,v])=>v.point.x===x&&v.point.y===y)?.[0]??0;
        const from=this.step?.to??this.point;
        this.pathFailures=0;this.path=this.pathFor(from,{x,y});
        if(this.path.length){this.marker.active=true;this.marker.setPosition(x*48+24,-y*32-16);}
    }
    private clearMovement():void {
        this.pauseInput();this.step=null;this.confirmed=null;this.visual={...this.point};
        if(this.marker)this.marker.active=false;
    }
    private beginStep():void {
        if(!this.serverReady){this.clearMovement();return;}
        if(this.actionTime>0||this.hp<=0)return;
        const down=(...codes:number[])=>codes.some(c=>this.keys.has(c));
        const dx=Number(down(KeyCode.KEY_D,KeyCode.ARROW_RIGHT))-Number(down(KeyCode.KEY_A,KeyCode.ARROW_LEFT));
        const dy=Number(down(KeyCode.KEY_S,KeyCode.ARROW_DOWN))-Number(down(KeyCode.KEY_W,KeyCode.ARROW_UP));
        let next:Point|undefined;
        if(dx||dy){next={x:this.point.x+dx,y:this.point.y+dy};this.facing=directionTo(this.point,next);}
        else next=this.path.shift();
        if(!next || !canStep(this.grid,this.point,next)){if(!next)this.marker.active=false;return;}
        const direction=directionTo(this.point,next),seq=++this.nextSequence;
        if(!this.connection?.send({type:'walk',direction,seq})){this.serverReady=false;this.clearMovement();return;}
        this.confirmed=null;this.facing=direction;this.step={from:{...this.point},to:next,elapsed:0,seq};this.animationClock=0;this.stepSoundPhase=0;
    }
    update(dt:number):void {
        if(this.itemTooltip&&(!this.itemTooltipOwner?.isValid||!this.itemTooltipOwner.activeInHierarchy||!this.serverReady))this.clearItemTooltip();
        if(this.status)this.status.string=this.statusText;
        this.syncCarriedItem();
        if(!this.ready)return;
        this.miniMap?.update(dt,this.mapId,this.point,this.peers.values(),this.serverReady&&!(this.menu.active&&this.panelRects.some(r=>r.x<800&&r.x+r.w>680&&r.y<120&&r.y+r.h>0)));
        this.animationClock+=dt;this.worldClock+=dt;
        if(!this.step)this.beginStep();
        if(this.step){
            this.step.elapsed+=dt;if(this.confirmed&&this.stepSoundPhase<2&&this.step.elapsed>=(this.stepSoundPhase===0?.1:.4)){const code=stepSound(this.terrain.cell(this.step.to.x,this.step.to.y));if(code)this.sound.play(String(code+this.stepSoundPhase));this.stepSoundPhase++;}const t=Math.min(1,this.step.elapsed/0.65);
            this.visual={x:this.step.from.x+(this.step.to.x-this.step.from.x)*t,y:this.step.from.y+(this.step.to.y-this.step.from.y)*t};
            if(t===1&&this.confirmed){this.point=this.confirmed;this.visual={...this.point};this.confirmed=null;this.step=null;}
            else if(this.step&&this.step.elapsed>3){this.serverReady=false;this.clearMovement();this.connection?.reconnect();this.statusText='移动未获服务器确认 · 正在重新连接';}
        }
        this.pickupAtDestination();
        this.actionTime=Math.max(0,this.actionTime-dt);
        this.peers.forEach(p=>{p.elapsed+=dt;p.actionTime=Math.max(0,(p.actionTime??0)-dt);const t=Math.min(1,p.elapsed/0.6);p.visual={x:p.from.x+(p.point.x-p.from.x)*t,y:p.from.y+(p.point.y-p.from.y)*t};});
        this.particleEffects=this.particleEffects.filter(e=>{e.age+=dt;if(e.age>=e.life){e.node.destroy();return false;}const t=e.age/e.life;e.node.setPosition((e.from.x+(e.to.x-e.from.x)*t)*48+24,-(e.from.y+(e.to.y-e.from.y)*t)*32+28);const frame=this.frames.get(e.keys[Math.min(e.keys.length-1,Math.floor(t*e.keys.length))]);if(frame){e.sprite.spriteFrame=frame.sprite;e.sprite.node.setPosition(frame.meta.offsetX,-frame.meta.offsetY);}return true;});
        this.terrain?.animate(this.worldClock);this.updateView();
    }
    private drawActor(sprite:Sprite,actor:string|null,action:string,direction:number,clock:number):void {
        if(actor&&!this.manifest.actors?.[actor]&&this.missingActors.size<256)this.missingActors.add(actor);
        const key=actorFrame(this.manifest.actors,actor,action,direction,clock),frame=key?this.frames.get(key):undefined;
        sprite.node.active=!!frame;
        if(frame){sprite.spriteFrame=frame.sprite;sprite.node.setPosition(frame.meta.offsetX,-frame.meta.offsetY);}
        else sprite.spriteFrame=null;
    }
    private updateView():void {
        if(!this.ready)return;
        const halfX=400/48,halfY=222/32;
        this.camera={x:Math.max(halfX,Math.min(this.grid.width-halfX,this.visual.x)),y:Math.max(halfY,Math.min(this.grid.height-halfY,this.visual.y))};
        this.world.setScale(this.zoom,this.zoom,1);this.world.setPosition(-this.camera.x*48*this.zoom,this.camera.y*32*this.zoom+78);
        void this.terrain.update(this.camera.x,this.camera.y,this.zoom);
        this.feet.setPosition(this.visual.x*48,-this.visual.y*32);
        const action=this.hp<=0?'die':this.actionTime>0?this.ownAction:this.step?'walk':'stand';
        const armour=this.equipment[1],weapon=this.equipment[0];
        const layers=playerLayers(this.gender,this.hairShape,equippedShape(armour,armour?.info??this.itemInfo.get(armour?.itemindex),0),equippedShape(weapon,weapon?.info??this.itemInfo.get(weapon?.itemindex),-1));
        this.drawActor(this.body,layers.body,action,this.facing,this.animationClock);
        this.drawActor(this.hair,layers.hair,action,this.facing,this.animationClock);
        this.drawActor(this.weapon,layers.weapon,action,this.facing,this.animationClock);
        this.weapon.node.setSiblingIndex([0,5,6,7].includes(this.facing)?0:2);
        this.ownLabel.node.setPosition(Math.round(this.visual.x*48+24-80),Math.round(-this.visual.y*32+70));
        this.drawHealthBar(this.ownHealth,this.visual.x*48+24,-this.visual.y*32+60,100*this.hp/Math.max(1,this.displayedMaxHP),this.serverReady&&this.hp>0&&this.displayedMaxHP>0);
        this.ghost.node.active=false;this.ghost.spriteFrame=this.body.spriteFrame;this.ghost.node.setPosition(this.visual.x*48+this.body.node.position.x,-this.visual.y*32+this.body.node.position.y);
        const sorted=Array.from(this.terrain.tiles.values()).filter(t=>!t.floor).map(t=>({node:t.node,sort:t.sort}));
        sorted.push({node:this.feet,sort:actorOrder((this.step?.to??this.point).y,this.ownId)});
        this.peers.forEach((p,id)=>{
            p.node.setPosition(p.visual.x*48,-p.visual.y*32);
            const action=p.dead?(p.harvested&&p.image===4?'skeleton':'die'):(p.actionTime??0)>0?p.action!:(p.elapsed<0.6?'walk':'stand');
            const layers=playerLayers(p.gender??0,p.hairShape??0,p.armour??0,p.weaponShape??-1);
            const actor=p.kind==='monster'?`monster${p.image}`:p.kind==='npc'?`npc${p.image}`:layers.body;
            this.drawActor(p.body,actor,action,p.direction,p.elapsed);
            if(p.weapon&&p.hair){this.drawActor(p.weapon,layers.weapon,action,p.direction,p.elapsed);this.drawActor(p.hair,layers.hair,action,p.direction,p.elapsed);p.weapon.node.setSiblingIndex([0,5,6,7].includes(p.direction)?0:2);}
            p.nameHeight??=p.kind==='npc'?Math.max(70,p.body.node.position.y+12):70;
            if(p.label){p.label.node.setPosition(Math.round(p.visual.x*48+24-80),Math.round(-p.visual.y*32+p.nameHeight));p.label.string=p.name??'旅人';p.label.node.active=!p.dead&&(p.kind!=='monster'||id===this.hovered||id===this.selected);}
            if(p.kind==='player'||p.kind==='monster'){
                p.healthBar??=this.makeHealthBar();
                this.drawHealthBar(p.healthBar,p.visual.x*48+24,-p.visual.y*32+60,p.hp,showHealth(p.kind,p.dead,p.hp,p.healthUntil,Date.now()));
            }
            sorted.push({node:p.node,sort:actorOrder(p.point.y,id)});
        });
        sorted.sort((a,b)=>a.sort-b.sort);sorted.forEach((t,i)=>{if(t.node.getSiblingIndex()!==i)t.node.setSiblingIndex(i);});
        this.coord.string=`${this.manifest.map.name??'比奇省'} ${this.point.x+this.manifest.map.originX}:${this.point.y+this.manifest.map.originY}`;
        this.updateOrbs();this.stats.string=`${this.level}`;
        const cell=`${Math.floor(this.camera.x)},${Math.floor(this.camera.y)}`;
        if(this.debug&&cell!==this.collisionCell){this.collisionCell=cell;const g=this.collision.getComponent(Graphics)??this.collision.addComponent(Graphics);g.clear();g.fillColor=new Color(196,49,44,90);
            for(let y=Math.floor(this.camera.y)-15;y<this.camera.y+16;y++)for(let x=Math.floor(this.camera.x)-18;x<this.camera.x+19;x++)if(this.grid.blocked.has(`${x},${y}`)){g.rect(x*48,-y*32-32,48,32);g.fill();}}
    }
    private changeMap(id:string,location?:Point,direction?:number):boolean {
        const target=this.maps.get(id);
        this.clearMovement();this.clearLoot();this.menu.active=false;if(this.targetText)this.targetText.string='';this.selected=0;this.hovered=0;
        if(!target){this.serverReady=false;this.world.active=false;this.statusText=`地图 ${id} 尚未接入`;return false;}
        // Resources/collision metadata are prepared before connecting, so following
        // object packets cannot race an asynchronous map manifest load.
        this.peers.forEach(p=>{p.node.destroy();p.label?.node.destroy();p.healthBar?.node.destroy();});this.peers.clear();
        this.particleEffects.forEach(e=>e.node.destroy());this.particleEffects=[];this.fireTargets.clear();
        this.terrain.destroy();this.mapId=id;this.manifest.map=target.map;this.grid=target.grid;
        this.collision.getComponent(Graphics)?.clear();this.collisionCell='';
        this.terrain=new TerrainStream(this.manifest,this.store,this.ground,this.objects,text=>this.notice(text));
        this.world.active=true;this.point={...(location??target.map.spawn)};this.visual={...this.point};this.facing=direction??this.facing;
        this.notice(`进入${target.map.name??'比奇省'}`);this.updateView();return true;
    }
    private serverEvent(event:any):void {this.accounts?.event(event);
        if(event.type==='tradeQuote'&&event.request===this.tradeRequest&&this.menu.active&&this.menuKind==='merchant'){this.tradeQuote={token:event.token,quote:this.normalize(event.quote)};this.showMerchant();return;}
        if(event.type==='tradeResult'&&event.request===this.tradeRequest){this.tradeQuote=null;if(event.success)this.tradeItem=null;this.notice(event.message);if(this.menu.active&&this.menuKind==='merchant')this.showMerchant();return;}

        if(event.type==='skillBindings'&&event.request===this.skillRequest&&this.skillPending){
            this.skillPending=false;
            if(event.success)for(const binding of this.normalize(event.bindings??[])){
                const magic=this.magics.find(m=>m.spell===binding.spell);if(magic)magic.key=binding.key;
            }
            this.notice(event.message);
            if(this.menu.active&&['skills','skillKeys'].includes(this.menuKind))this.showSkills(this.skillPage);
            return;
        }
        if(event.type==='packet'){this.packet(event.packet,event.data);return;}
        if(event.type==='disconnected'){this.skillRequest++;this.skillPending=false;this.selectedBag=-1;this.bagMovePending=false;this.tradeRequest++;this.tradeItem=null;this.tradeQuote=null;this.chatInput?.setActive(false);this.logs=[];if(this.logText)this.logText.string='';if(this.menu)this.menu.active=false;if(this.targetText)this.targetText.string='';this.party?.reset();this.clearLoot();this.pendingUses.clear();this.fireTargets.clear();this.serverReady=false;this.clearMovement();this.peers.forEach(p=>{p.node.destroy();p.label?.node.destroy();p.healthBar?.node.destroy();});this.peers.clear();return;}
        if(event.type==='vitals'){const d=this.normalize(event.data);if(d.objectid!==this.ownId)return;this.authoritativeMaxHP=d.maxhp;this.authoritativeMaxMP=d.maxmp;this.bagWeight=d.bagweight;this.maxBagWeight=d.maxbagweight;this.handWeight=d.handweight;this.maxHandWeight=d.maxhandweight;this.wearWeight=d.wearweight;this.maxWearWeight=d.maxwearweight;return;}
        if(event.type==='transport')this.statusText='正在进入游戏';
        if(event.type==='ready') {this.chatInput?.setActive(true);this.gender=event.gender??0;this.hairShape=event.hair??0;this.missingActors.clear();this.characterName=event.name??'旅人';if(this.ownLabel)this.ownLabel.string=this.characterName;
            if(event.map&&event.map!==this.mapId&&!this.changeMap(event.map))return;
            this.authoritativeMaxHP=0;this.authoritativeMaxMP=0;this.experience=event.experience??0;this.maxExperience=event.maxExperience??0;this.magics=this.normalize(event.magics??[]);this.job=event.class??0;this.hp=event.hp??0;this.mp=event.mp??0;this.gold=event.gold??0;this.level=event.level??1;this.inventory=this.normalize(event.inventory??[]);this.equipment=this.normalize(event.equipment??[]);
            this.pendingUses.clear();this.refreshBelt();this.serverReady=true;this.ownId=event.objectId;this.statusText='已进入游戏';
            this.clearMovement();this.point={x:event.x-this.manifest.map.originX,y:event.y-this.manifest.map.originY};this.visual={...this.point};
        }
        if(this.serverReady&&(event.type==='state'||event.type==='position')&&Number.isFinite(event.x)&&Number.isFinite(event.y)) {
            const p={x:event.x-this.manifest.map.originX,y:event.y-this.manifest.map.originY};
            if(event.type==='state'){
                if(!this.step||event.seq!==this.step.seq)return;
                this.confirmed=p;
            } else {this.clearMovement();this.point=p;this.visual={...p};}
            if(event.accepted===false){this.stepSoundPhase=2;const goal=this.path[this.path.length-1],avoid=this.step?.to;this.path=goal&&this.pathFailures++<3?this.pathFor(p,goal,avoid):[];this.keys.clear();}
        }
        if(event.type==='peer'&&event.id!==this.ownId&&Number.isFinite(event.x)&&Number.isFinite(event.y)) {
            const point={x:event.x-this.manifest.map.originX,y:event.y-this.manifest.map.originY};let peer=this.peers.get(event.id);
            if(!peer){const node=this.makeNode(`Peer${event.id}`,this.objects);const bodyNode=this.makeNode('Body',node);bodyNode.getComponent(UITransform)!.setAnchorPoint(0,1);const body=bodyNode.addComponent(Sprite);body.sizeMode=Sprite.SizeMode.RAW;const label=this.text(this.labels,'同行者',0,65,12,Color.WHITE,160);peer={label,kind:'player',name:'同行者',node,body,point,visual:{...point},from:{...point},direction:event.direction??4,elapsed:1};this.peers.set(event.id,peer);}
            else {peer.from={...peer.visual};peer.point=point;peer.elapsed=0;peer.direction=event.direction??peer.direction;}
        }
        if(event.type==='peerRemoved'){this.peers.get(event.id)?.node.destroy();this.peers.get(event.id)?.label?.node.destroy();this.peers.get(event.id)?.healthBar?.node.destroy();this.peers.delete(event.id);}
        if(event.type==='error')this.statusText=String(event.message??event.error??'Crystal 服务返回错误');
    }
    private normalize(value:any):any {if(Array.isArray(value))return value.map(v=>this.normalize(v));if(value&&typeof value==='object'){const out:any={};Object.entries(value).forEach(([k,v])=>out[k.toLowerCase()]=this.normalize(v));return out;}return value;}
    private itemInfo=new Map<number,any>();private fireTargets=new Map<number,number>();
    private itemName(item:any):string {const info=item?.info??this.itemInfo.get(item?.itemindex);const names:Record<string,string>={BichonSword:'木剑',BichonArmour:'布衣',BichonRobe:'布衣',BichonPotion:'金创药',BichonHealthSmall:'金创药（小量）',BichonManaSmall:'魔法药（小量）'};return names[info?.name]??info?.name??`物品 ${item?.itemindex??''}`;}
    private outlineName(label:Label):void {label.horizontalAlign=Label.HorizontalAlign.CENTER;const outline=label.node.addComponent(LabelOutline);outline.color=Color.BLACK;outline.width=1;}
    private nameColor(value:any):Color {return value&&Number.isFinite(value.r)?new Color(value.r,value.g,value.b,255):Color.WHITE;}
    private notice(text:string,type=3):void {this.chatInput?.add(text,type);this.logs.push(text);this.logs=this.logs.slice(-4);if(this.logText)this.logText.string=this.logs.join('\n');}
    private attack():void {
        if(!this.serverReady||this.step||this.hp<=0||this.actionTime>0)return;const p=this.peers.get(this.selected);
        if(!p||!['monster','player'].includes(p.kind??'')||p.dead){this.notice('先点击选择一只怪物');return;}
        if(Math.max(Math.abs(p.point.x-this.point.x),Math.abs(p.point.y-this.point.y))>1){this.notice('靠近目标后按空格攻击');return;}
        this.fireTargets.delete(this.selected);this.facing=directionTo(this.point,p.point);if(this.connection?.send({type:'attack',direction:this.facing})){if(this.equipment[0])this.sound.play('50');this.ownAction='attack';this.actionTime=.8;this.animationClock=0;}
    }
    private harvestAt(screen:Point):void {
        if(!this.serverReady||this.hp<=0||this.step||this.actionTime>0||blocksWorld(screen.x,screen.y,this.menu.active?this.panelRects:[],this.hudRows))return;
        const target=this.peers.get(this.entityAt(screen,true));if(!target){this.notice('请对准尚未采集的怪物尸体');return;}
        if(Math.max(Math.abs(target.point.x-this.point.x),Math.abs(target.point.y-this.point.y))>2){this.notice('请靠近尸体后按住 Alt 点击采集');return;}
        this.facing=directionTo(this.point,target.point);if(this.connection?.send({type:'harvest',direction:this.facing})){this.ownAction='harvest';this.actionTime=.6;this.animationClock=0;}
    }
    private cast(spell=31):void {
        if(!this.magics.some(m=>m.spell===spell)){this.notice('尚未学习该技能');return;}
        if(spell!==31){this.notice(`${this.skillName(spell)}的施放尚未接入。`);return;}
        if(!this.serverReady||this.step||this.hp<=0||this.actionTime>0)return;const p=this.peers.get(this.selected);
        if(!p||!['monster','player'].includes(p.kind??'')||p.dead){this.notice('请先选择目标，再按已设置的技能键施放火球');return;}
        this.facing=directionTo(this.point,p.point);this.connection?.send({type:'cast',spell:31,targetId:this.selected,x:p.point.x,y:p.point.y,direction:this.facing});
    }
    private talk():void {
        const p=this.peers.get(this.selected);if(!p||p.kind!=='npc')return;
        if(Math.max(Math.abs(p.point.x-this.point.x),Math.abs(p.point.y-this.point.y))>3){this.notice('请走近商人再点击交谈');return;}
        this.npcId=this.selected;this.connection?.send({type:'npc',id:this.npcId,key:'[@MAIN]'});
    }
    private belt!:Node;private pendingUses=new Set<string>();private lastUse=0;
    private nativeLayer!:Node;private hpOrb!:Sprite;private mpOrb!:Sprite;private hpText!:Label;private mpText!:Label;private baseStats:any[]=[];private selectedGood:any=null;private shopRate=1;
    private nativeImage(parent:Node,key:string,x:number,y:number,offset=false):Sprite {
        const f=this.frames.get(key);if(!f)throw Error('Missing original UI sprite '+key);
        const s=this.sprite(parent,key);s.spriteFrame=f.sprite;s.node.setPosition(x+(offset?f.meta.offsetX:0),-y-(offset?f.meta.offsetY:0));return s;
    }
    private nativeClick(node:Node,action:()=>void):void {
        let last=0;const run=(event:EventMouse|EventTouch)=>{event.propagationStopped=true;const now=Date.now();if(now-last<150)return;last=now;this.sound.unlock();this.sound.play('103');action();};
        node.on(Node.EventType.TOUCH_END,run);node.on(Node.EventType.MOUSE_UP,run);
    }
    private nativeDoubleClick(node:Node,action:()=>void):void {
        let first:number|null=null,lastTouch=-Infinity;
        const activate=()=>{const now=Date.now();this.sound.unlock();if(first!==null&&now-first<=500){first=null;this.sound.play('103');action();}else first=now;};
        node.on(Node.EventType.TOUCH_END,(event:EventTouch)=>{event.propagationStopped=true;lastTouch=Date.now();activate();});
        node.on(Node.EventType.MOUSE_UP,(event:EventMouse)=>{event.propagationStopped=true;if(event.getButton()===0&&Date.now()-lastTouch>700)activate();});
    }
    private nativeButton(parent:Node,key:string,x:number,y:number,action:()=>void):Node {const s=this.nativeImage(parent,key,x,y);this.nativeClick(s.node,action);return s.node;}
    private nativeLabel(parent:Node,value:string,x:number,y:number,size=12,width=250,color=C.paper):Label{return this.text(parent,value,x,-y,size,color,width);}
    /** Text rectangles use the supplied native frame's logical pixels, not glyph width. */
    private nativeField(parent:Node,value:string,x:number,y:number,width:number,height=16,size=12,color=C.paper,align=Label.HorizontalAlign.LEFT):Label {
        const label=this.nativeLabel(parent,value,x,y+height/2,size,width,color);
        label.node.getComponent(UITransform)!.setContentSize(width,height);
        label.verticalAlign=Label.VerticalAlign.CENTER;label.horizontalAlign=align;label.enableWrapText=false;
        return label;
    }
    private nativeCrop(parent:Node,key:string,x:number,y:number,rx:number,ry:number,w:number,h:number):Sprite {
        const original=this.frames.get(key)!;const sprite=this.nativeImage(parent,key,x,y);sprite.spriteFrame=original.sprite.clone();sprite.spriteFrame.rect=new Rect(original.meta.x+rx,original.meta.y+ry,w,h);sprite.spriteFrame.originalSize=new Size(w,h);sprite.spriteFrame.offset=new Vec2();sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.node.getComponent(UITransform)!.setContentSize(w,h);return sprite;
    }
    private closeNative(parent:Node,x:number,y:number,action:()=>void=()=>{this.menu.active=false;if(this.targetText)this.targetText.string='';}):void {const button=this.nativeCrop(parent,'ui:ClassicPrguse:370',x,y,8,40,15,23);this.nativeClick(button.node,action);}
    private nativeWindow(parent:Node,key:string,x:number,y:number):Node {
        const n=this.makeNode('Native window',parent);n.setPosition(x,-y);this.nativeImage(n,key,0,0);const f=this.frames.get(key)!.meta;this.panelRects.push({x,y,w:f.w,h:f.h});return n;
    }
    private createNativeHUD():void {
        this.hudRoot.destroy();this.nativeLayer=this.makeNode('Classic gray stone UI',this.node);this.nativeLayer.setPosition(-400,300);
        const bar=this.makeNode('Classic main panel',this.nativeLayer);bar.setPosition(0,-349);
        this.nativeImage(bar,'ui:ClassicPrguse:1',0,0);
        const chat=this.nativeCrop(bar,'ui:ClassicPrguse:1',208,120,208,120,385,123);chat.color=new Color(16,12,10,255);
        this.hpBase=this.nativeCrop(bar,'ui:ClassicPrguse:5',38,90,0,0,94,92);
        this.hpOrb=this.nativeImage(bar,'ui:ClassicPrguse:4',39,91);this.hpOrb.spriteFrame=this.hpOrb.spriteFrame!.clone();this.hpOrb.sizeMode=Sprite.SizeMode.CUSTOM;
        this.mpOrb=this.nativeImage(bar,'ui:ClassicPrguse:4',85,91);this.mpOrb.spriteFrame=this.mpOrb.spriteFrame!.clone();this.mpOrb.sizeMode=Sprite.SizeMode.CUSTOM;
        this.expBar=this.nativeCrop(bar,'ui:ClassicPrguse:7',666,178,0,0,76,13);this.weightBar=this.nativeCrop(bar,'ui:ClassicPrguse:7',666,211,0,0,76,13);
        this.expBar.node.active=false;this.weightBar.node.active=false;
        // Old DrawScrn uses (26, SCREENHEIGHT-38) and (88, SCREENHEIGHT-38).
        this.hpText=this.nativeLabel(bar,'',26,219,12,61,Color.WHITE);this.mpText=this.nativeLabel(bar,'',88,219,12,64,Color.WHITE);
        for(const label of [this.hpText,this.mpText]){const outline=label.node.addComponent(LabelOutline);outline.color=Color.BLACK;outline.width=1;}

        this.stats=this.nativeLabel(bar,'',678,154,12,80,Color.WHITE);this.status=this.nativeLabel(bar,this.statusText,208,236,8,384,C.muted);
        this.logText=this.nativeLabel(bar,'',212,162,11,377);this.logText.node.getComponent(UITransform)!.setContentSize(377,88);
        this.hint=this.nativeLabel(bar,'1–6 用药  F1–F8 技能  F11 设置  B 背包',212,219,9,377,C.muted);
        for(const [x,y,action] of [[634,49,()=>this.showInventory('character')],[674,28,()=>this.showInventory('bag')],[714,8,()=>this.showSkills()]] as const){const hit=this.makeNode('Original round button',bar);hit.getComponent(UITransform)!.setAnchorPoint(0,1);hit.getComponent(UITransform)!.setContentSize(40,40);hit.setPosition(x,-y);this.nativeClick(hit,action);}
        this.belt=this.makeNode('Six original item slots',bar);this.refreshBelt();
        const mute=this.makeNode('Sound toggle',bar);mute.getComponent(UITransform)!.setAnchorPoint(0,1);mute.getComponent(UITransform)!.setContentSize(40,40);mute.setPosition(754,0);this.nativeClick(mute,()=>this.notice(this.sound.toggle()?'音效已开启':'音效已静音'));
        this.coord=this.nativeLabel(bar,'比奇省',29,235,12,175,Color.WHITE);this.targetText=this.nativeField(bar,'',214,124,374,16,11,Color.WHITE);
        this.menu=this.makeNode('Classic dialogs',this.nativeLayer);this.menu.active=false;if(this.targetText)this.targetText.string='';
        if(typeof document!=='undefined'){this.miniMap=new MiniMap();this.accounts=new AccountUI(v=>!!this.connection?.send(v),()=>this.connection?.reconnect());this.party=new PartyUI(v=>!!this.connection?.send(v),()=>this.characterName);this.chatInput=new ChatInput(text=>!!this.serverReady&&!!this.connection?.send({type:'chat',message:text}),()=>{this.keys.clear();this.path=[];},()=>!this.accounts?.active&&this.serverReady&&!(this.menu.active&&this.menuKind==='skillKeys'));this.logText.node.active=false;this.hint.node.active=false;}
    }
    private refreshBelt():void {
        if(!this.belt)return;this.belt.children.slice().forEach(c=>c.destroy());
        for(let slot=0;slot<6;slot++){
            const x=285+slot*43;const item=this.inventory[slot];
            if(item)this.nativeItem(this.belt,item,x,57,()=>this.usePotion(item));
            this.nativeLabel(this.belt,String(slot+1),x+2,81,10,20,C.gold);
        }
    }
    private usePotion(item:any):void {
        if((item?.info??this.itemInfo.get(item?.itemindex))?.type!==13)return;
        this.useInventoryItem(item);
    }
    private useInventoryItem(item:any):void {
        if(!this.serverReady||!item||this.hp<=0)return;
        const info=item.info??this.itemInfo.get(item.itemindex);
        if(info?.type!==13&&info?.type!==20)return;
        const id=String(item.uniqueid),now=Date.now();if(this.pendingUses.has(id)||now-this.lastUse<500)return;
        if(this.connection?.send({type:'use',uniqueId:id})){this.pendingUses.add(id);this.lastUse=now;}
    }
    private makeHealthBar():{node:Node;fill:Sprite} {
        const node=this.makeNode('Original health bar',this.labels);
        this.nativeImage(node,'ui:ClassicPrguse2:0',0,0);
        const fill=this.nativeCrop(node,'ui:ClassicPrguse2:1',0,0,0,0,32,4);
        node.active=false;return {node,fill};
    }
    private drawHealthBar(bar:{node:Node;fill:Sprite},x:number,y:number,percent:number|undefined,visible:boolean):void {
        bar.node.active=visible;if(!visible)return;
        bar.node.setPosition(Math.round(x)-16,Math.round(y));
        const width=healthWidth(percent);bar.fill.node.active=width>0;if(!width)return;
        const original=this.frames.get('ui:ClassicPrguse2:1')!.meta;
        bar.fill.spriteFrame!.rect=new Rect(original.x,original.y,width,4);
        bar.fill.spriteFrame!.originalSize=new Size(width,4);bar.fill.node.getComponent(UITransform)!.setContentSize(width,4);
    }
    private fillProgress(sprite:Sprite,current:number,max:number):void {
        const width=max>0?Math.round(76*Math.max(0,Math.min(1,current/max))):0;
        sprite.node.active=width>0;if(!width||sprite.spriteFrame!.rect.width===width)return;
        const f=this.frames.get('ui:ClassicPrguse:7')!.meta;
        sprite.spriteFrame!.rect=new Rect(f.x,f.y,width,13);sprite.spriteFrame!.originalSize=new Size(width,13);sprite.node.getComponent(UITransform)!.setContentSize(width,13);
    }
    private updateOrbs():void {
        const maxHP=this.authoritativeMaxHP,maxMP=this.authoritativeMaxMP,warrior=this.job===0&&this.level<28;
        this.hpBase.node.active=warrior;
        if(warrior){
            const frame=this.frames.get('ui:ClassicPrguse:6')!;const h=Math.max(1,Math.min(92,Math.round(92*this.hp/Math.max(1,maxHP))));
            this.hpOrb.node.active=this.hp>0&&maxHP>0;this.mpOrb.node.active=false;this.hpOrb.spriteFrame!.texture=frame.sprite.texture;
            this.hpOrb.spriteFrame!.rect=new Rect(frame.meta.x,frame.meta.y+92-h,94,h);this.hpOrb.spriteFrame!.originalSize=new Size(94,h);this.hpOrb.spriteFrame!.offset=new Vec2();this.hpOrb.node.getComponent(UITransform)!.setContentSize(94,h);this.hpOrb.node.setPosition(38,-90-(92-h));
        }else{
            const frame=this.frames.get('ui:ClassicPrguse:4')!,meta=frame.meta;
            for(const [sprite,current,max,side,width] of [[this.hpOrb,this.hp,maxHP,0,45],[this.mpOrb,this.mp,maxMP,47,44]] as const){const h=Math.max(1,Math.min(90,Math.round(90*current/Math.max(1,max))));sprite.node.active=current>0&&max>0;sprite.spriteFrame!.texture=frame.sprite.texture;sprite.spriteFrame!.rect=new Rect(meta.x+side,meta.y+90-h,width,h);sprite.spriteFrame!.originalSize=new Size(width,h);sprite.spriteFrame!.offset=new Vec2();sprite.node.getComponent(UITransform)!.setContentSize(width,h);sprite.node.setPosition(40+side,-91-(90-h));}
        }
        this.displayedMaxHP=maxHP;this.displayedMaxMP=maxMP;
        this.hpText.string=`${this.hp}/${maxHP||'…'}`;this.mpText.string=`${this.mp}/${maxMP||'…'}`;
        if(this.bagGold?.isValid)this.bagGold.string=String(this.gold);
        if(this.bagWeights?.isValid)this.bagWeights.string=`背包 ${this.bagWeight}/${this.maxBagWeight} · 穿戴 ${this.wearWeight}/${this.maxWearWeight} · 手持 ${this.handWeight}/${this.maxHandWeight}`;
        this.fillProgress(this.expBar,this.experience,this.maxExperience);this.fillProgress(this.weightBar,this.bagWeight,this.maxBagWeight);
    }
    private showInventory(page?:string):void {
        this.targetText.string='';
        if(!this.serverReady){this.notice('正在连接服务器，请稍候');return;}
        if(!this.menu.active||this.menuKind!=='inventory'){this.bagOpen=false;this.characterOpen=false;this.selectedBag=-1;}
        if(page==='bag')this.bagOpen=!this.bagOpen;
        if(page==='character')this.characterOpen=!this.characterOpen;
        this.inventoryPage=this.characterOpen?'character':'bag';
        this.clearItemTooltip();this.menuKind='inventory';this.menu.children.slice().forEach(c=>c.destroy());this.panelRects=[];
        this.menu.active=this.bagOpen||this.characterOpen;
        if(!this.bagOpen)this.selectedBag=-1;
        if(this.bagOpen)this.renderBag(0);
        if(this.characterOpen)this.renderCharacter();
    }
    private renderCharacter():void {
        const character=this.nativeWindow(this.menu,'ui:ClassicPrguse:370',568,0);
        this.nativeImage(character,'ui:ClassicPrguse:376',40,53);this.nativeField(character,'装备',40,53,174,26,12,Color.WHITE,Label.HorizontalAlign.CENTER);this.nativeField(character,this.characterName,58,14,139,22,13,C.gold,Label.HorizontalAlign.CENTER);this.closeNative(character,8,40,()=>this.showInventory('character'));
        const doll=this.makeNode('Original paperdoll equipment',character);doll.setPosition(33,-97);
        for(const slot of [1,0]){const item=this.equipment[slot];if(!item)continue;const info=item.info??this.itemInfo.get(item.itemindex),image=info?.image;if(this.frames.has(`ui:Stateitem:${image}`))this.nativeImage(doll,`ui:Stateitem:${image}`,0,0,true);}
        for(const {slot,x,y} of JEWELLERY_SLOTS){const item=this.equipment[slot];if(item)this.nativeItem(character,item,x,y,()=>this.equipmentCell(slot));else {const hit=this.makeNode('装备格 '+slot,character);hit.setPosition(x,-y);hit.getComponent(UITransform)!.setAnchorPoint(0,1);hit.getComponent(UITransform)!.setContentSize(36,32);this.nativeClick(hit,()=>this.equipmentCell(slot));}}
        // Weapon/armour are already drawn by Stateitem; their original paperdoll
        // hit regions must not be replaced with inventory icons in bracelet slots.
        for(const [slot,x,y,w,h] of [[0,47,80,47,87],[1,96,122,53,112]]){
            const item=this.equipment[slot];
            const hit=this.makeNode('装备格 '+slot,character);hit.setPosition(x,-y);
            hit.getComponent(UITransform)!.setAnchorPoint(0,1);hit.getComponent(UITransform)!.setContentSize(w,h);this.nativeClick(hit,()=>this.equipmentCell(slot));if(item)this.bindItemTooltip(hit,item);
        }
        this.nativeField(character,`等级 ${this.level}`,37,270,52,16,12,C.gold);
        this.nativeField(character,`金币 ${this.gold}`,91,270,119,16,12,C.gold,Label.HorizontalAlign.RIGHT);
        const action=this.nativeLabel(character,this.hp<=0?'回城复活':`经验 ${this.experience}/${this.maxExperience}`,37,300,11,195,C.paper);if(this.hp<=0)this.nativeClick(action.node,()=>this.connection?.send({type:'revive'}));
    }
    private equipmentCell(slot:number):void {
        const carried=this.inventory[this.selectedBag];
        if(this.selectedBag>=6&&carried){this.selectedBag=-1;this.connection?.send({type:'equip',uniqueId:String(carried.uniqueid),slot});return;}
        const item=this.equipment[slot];if(!item)return;
        const to=this.inventory.findIndex((v,i)=>!v&&i>=6);if(to>=0)this.connection?.send({type:'unequip',uniqueId:String(item.uniqueid),to});else this.notice('背包空间不足。');
    }
    private positionCarriedItem():void {if(this.carrySprite?.node.active)this.carrySprite.node.setPosition(this.mousePoint.x-18,-this.mousePoint.y+16);}
    private syncCarriedItem():void {
        if(!this.ready||!this.serverReady||this.accounts?.active||!this.menu.active||this.menuKind!=='inventory'||!this.bagOpen)this.selectedBag=-1;
        const item=this.selectedBag>=6?this.inventory[this.selectedBag]:null;
        for(const [slot,node] of this.bagIcons)if(node.isValid)node.active=slot!==this.selectedBag;
        if(!item){if(this.carrySprite)this.carrySprite.node.active=false;return;}
        const info=item.info??this.itemInfo.get(item.itemindex),frame=this.frames.get(`ui:Items:${info?.image}`);
        if(!frame){if(this.carrySprite)this.carrySprite.node.active=false;return;}
        if(!this.carrySprite)this.carrySprite=this.sprite(this.nativeLayer,'鼠标物品');
        this.carrySprite.node.active=this.mousePoint.x>=0&&this.mousePoint.x<800&&this.mousePoint.y>=0&&this.mousePoint.y<600;this.carrySprite.spriteFrame=frame.sprite;this.carrySprite.node.setSiblingIndex(this.nativeLayer.children.length-1);this.positionCarriedItem();
    }
    private bagCell(slot:number):void {
        if(this.bagMovePending)return;
        const item=this.inventory[slot],now=Date.now();
        if(this.selectedBag===slot){
            this.selectedBag=-1;
            if(now-this.selectedBagAt<500&&item){const info=item.info??this.itemInfo.get(item.itemindex),target=equipmentTarget(info?.type,this.equipment);if(info?.type===13||info?.type===20)this.useInventoryItem(item);else if(target>=0)this.connection?.send({type:'equip',uniqueId:String(item.uniqueid),slot:target});}
        }else if(this.selectedBag>=6){
            const from=this.selectedBag;this.bagSwapSource=item?from:-1;this.selectedBag=-1;
            if(this.inventory[from])this.bagMovePending=!!this.connection?.send({type:'moveItem',from,to:slot});if(!this.bagMovePending)this.bagSwapSource=-1;
        }else if(item){this.selectedBag=slot;this.selectedBagAt=now;}
        for(const [index,g] of this.bagHighlights){if(!g.isValid)continue;g.clear();}
        if(this.bagStatus?.isValid)this.bagStatus.string=this.bagMovePending?'等待服务器确认…':this.selectedBag>=6?'已选 '+this.itemName(this.inventory[this.selectedBag])+' · 点击目标格':'单击移动 · 双击使用或穿戴';
    }
    private renderBag(x:number):void {
        const bag=this.nativeWindow(this.menu,'ui:ClassicPrguse:3',x,0);
        this.closeNative(bag,309,202,()=>{if(this.menuKind==='shop'){this.shopBagOpen=false;this.showShop();}else this.showInventory('bag');if(this.targetText)this.targetText.string='';});this.bagGold=this.nativeField(bag,String(this.gold),65,182,136,18,12,Color.WHITE);
        this.bagWeights=null;this.bagStatus=null;this.bagHighlights.clear();this.bagIcons.clear();
        for(let slot=6;slot<Math.min(46,this.inventory.length);slot++){
            const item=this.inventory[slot];
            const x=20+(slot-6)%8*36,y=13+Math.floor((slot-6)/8)*32;
            if(this.menuKind==='inventory'){
                if(item){const icon=this.nativeItem(bag,item,x,y,()=>{});if(icon)this.bagIcons.set(slot,icon.node);}
                const hit=this.makeNode('背包格 '+slot,bag);hit.setPosition(x,-y);hit.getComponent(UITransform)!.setAnchorPoint(0,1);hit.getComponent(UITransform)!.setContentSize(36,32);
                const g=hit.addComponent(Graphics);g.strokeColor=C.gold;g.lineWidth=1;this.bagHighlights.set(slot,g);
                hit.on(Node.EventType.TOUCH_END,(event:EventTouch)=>{event.propagationStopped=true;this.lastBagTouch=Date.now();this.bagCell(slot);});
                hit.on(Node.EventType.MOUSE_UP,(event:EventMouse)=>{event.propagationStopped=true;if(event.getButton()===0&&Date.now()-this.lastBagTouch>700)this.bagCell(slot);});
                if(item)this.bindItemTooltip(hit,item,bag);continue;
            }
            if(!item)continue;
            this.nativeItem(bag,item,x,y,()=>{if(this.menuKind==='merchant'){this.requestTrade(item);return;}const info=item.info??this.itemInfo.get(item.itemindex);const target=equipmentTarget(info?.type,this.equipment);if(info?.type===13||info?.type===20)this.useInventoryItem(item);else if(target>=0)this.connection?.send({type:'equip',uniqueId:String(item.uniqueid),slot:target});},this.menuKind!=='merchant'&&(item.info??this.itemInfo.get(item.itemindex))?.type===20,bag);
        }
    }
    private itemHint(item:any):string {return this.itemName(item);}
    private clearItemTooltip():void {
        if(this.itemTooltip?.isValid)this.itemTooltip.destroy();
        if(this.itemTooltipDock?.isValid)for(const child of this.itemTooltipDock.children)if(child.name==='背包默认说明')child.active=true;
        this.itemTooltip=undefined;this.itemTooltipOwner=undefined;this.itemTooltipDock=undefined;
    }
    private positionItemTooltip():void {
        if(!this.itemTooltip?.isValid||this.itemTooltipDock)return;const size=this.itemTooltip.getComponent(UITransform)!.contentSize;
        const p=itemHintPosition(this.mousePoint.x,this.mousePoint.y,size.width,size.height);this.itemTooltip.setPosition(p.x,-p.y);
    }
    private bindItemTooltip(owner:Node,item:any,bag?:Node):void {
        owner.on(Node.EventType.MOUSE_ENTER,(event:EventMouse)=>{
            if(this.selectedBag>=6)return;this.clearItemTooltip();const p=event.getUILocation();this.mousePoint={x:p.x,y:600-p.y};
            const info=item.info??this.itemInfo.get(item.itemindex),name=this.itemName(item);
            const requirements=itemRequirements(info,{level:this.level,job:this.job,gender:this.gender});
            const lines=itemDescription(item,info,name);
            // Measure with the same system font as nativeField; never shrink the font to squeeze long items.
            const context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
            if(context)context.font='12px "NSimSun","SimSun","Songti SC",serif';
            const measure=(text:string)=>context?context.measureText(text).width:Array.from(text).length*12;
            const compact=bag?compactBagDescription(item,info,name,measure,252):null;
            if(bag&&compact){
                this.itemTooltipDock=bag;for(const child of bag.children)if(child.name==='背包默认说明')child.active=false;
                const panel=this.makeNode('物品说明',bag);this.itemTooltip=panel;this.itemTooltipOwner=owner;panel.setPosition(70,-215);
                const nameWidth=Math.min(258,measure(name+' '));this.nativeField(panel,name,0,0,nameWidth,14,12,Color.YELLOW);
                this.nativeField(panel,compact[0].slice(name.length+1),nameWidth,0,258-nameWidth,14,12,Color.WHITE);
                this.nativeField(panel,compact[1],0,14,258,14,12,Color.WHITE);
                this.nativeField(panel,compact[2],0,28,258,14,12,requirements.some(row=>row.met===false)?Color.RED:Color.WHITE);
                return;
            }
            const width=Math.min(380,Math.max(112,...lines.map(line=>Array.from(line).reduce((n,c)=>n+(c.charCodeAt(0)>255?12:7),0)+16))),height=lines.length*18+12;
            const panel=this.makeNode('物品说明',this.nativeLayer);this.itemTooltip=panel;this.itemTooltipOwner=owner;
            panel.getComponent(UITransform)!.setAnchorPoint(0,1);panel.getComponent(UITransform)!.setContentSize(width,height);
            const g=panel.addComponent(Graphics);g.fillColor=new Color(0,0,0,215);g.rect(0,-height,width,height);g.fill();
            lines.forEach((line,i)=>this.nativeField(panel,line,8,6+i*18,width-16,18,12,i===0?C.gold:requirements.some(row=>row.text===line&&row.met===false)?Color.RED:Color.WHITE));
            this.positionItemTooltip();
        });
        owner.on(Node.EventType.MOUSE_LEAVE,()=>{if(this.itemTooltipOwner===owner)this.clearItemTooltip();});
        owner.on(Node.EventType.TOUCH_START,()=>this.clearItemTooltip());
        owner.on(Node.EventType.MOUSE_DOWN,()=>this.clearItemTooltip());
    }
    private nativeItem(parent:Node,item:any,x:number,y:number,action:()=>void,double=false,dock?:Node):Sprite|undefined {
        const info=item.info??this.itemInfo.get(item.itemindex),key=`ui:Items:${info?.image}`;if(!this.frames.has(key))return;
        const f=this.frames.get(key)!;const icon=this.nativeImage(parent,key,x+(36-f.meta.w)/2,y+(32-f.meta.h)/2);if(double)this.nativeDoubleClick(icon.node,action);else this.nativeClick(icon.node,action);
        this.bindItemTooltip(icon.node,item,dock);
        if(item.count>1)this.nativeLabel(icon.node,String(item.count),f.meta.w-10,f.meta.h-7,9,25,C.gold);
        return icon;
    }
    private showNPC(page:string[]):void {
        this.npcPage=page;this.menuKind='npc';this.menu.children.slice().forEach(c=>c.destroy());this.panelRects=[];this.menu.active=true;
        this.renderNPCDialog();
    }
    private renderNPCDialog():void {
        const page=this.npcPage;
        const dialog=this.nativeWindow(this.menu,'ui:ClassicPrguse:384',0,0);this.nativeLabel(dialog,this.peers.get(this.npcId)?.name??'',30,16,14,360,C.gold);this.closeNative(dialog,399,1);let y=43;
        page.forEach(line=>{const links=Array.from(line.matchAll(/<([^/<>]+)\/([^<>]+)>/g));const plain=line.replace(/<[^<>]+>/g,'').replace(/\\/g,'').trim();if(plain){this.nativeLabel(dialog,plain,22,y,13,370);y+=18;}
            links.forEach(match=>{const label=this.nativeLabel(dialog,match[1],22,y,13,370,new Color(245,224,140));this.nativeClick(label.node,()=>{if(/exit/i.test(match[2])){this.menu.active=false;if(this.targetText)this.targetText.string='';return;}this.connection?.send({type:'npc',id:this.npcId,key:`[@${match[2].replace(/^@/,'').toUpperCase()}]`});});y+=18;});});
    }
    private requestTrade(item:any):void {
        this.tradeItem=item;this.tradeQuote=null;this.tradeRequest++;
        this.connection?.send({type:'tradeQuote',request:this.tradeRequest,uniqueId:String(item.uniqueid),mode:this.tradeMode});this.showMerchant();
    }
    private showMerchant(mode?:string):void {
        if(mode){this.tradeMode=mode;this.tradeItem=null;this.tradeQuote=null;this.tradeRequest++;}
        this.menuKind='merchant';this.menu.children.slice().forEach(c=>c.destroy());this.panelRects=[];this.menu.active=true;
        this.renderNPCDialog();this.renderBag(464);
        // Old FState: DSellDlg at (328,163), slot (27,67), confirmation (85,150).
        const dialog=this.nativeWindow(this.menu,'ui:ClassicPrguse:392',328,163),name=this.tradeMode==='sell'?'出售':this.tradeMode==='special'?'特修':'修理';
        this.nativeField(dialog,`${name}：${this.tradeQuote?this.tradeQuote.quote.gold:'—'}`,8,3,103,16,11,Color.WHITE);this.closeNative(dialog,115,0);
        if(this.tradeItem){this.nativeItem(dialog,this.tradeItem,39,77,()=>{});this.nativeLabel(dialog,this.itemName(this.tradeItem),5,37,10,123,Color.WHITE);}
        const button=this.nativeImage(dialog,'ui:ClassicPrguse:393',85,150);
        if(this.tradeQuote){this.nativeClick(button.node,()=>{const token=this.tradeQuote?.token;if(!token)return;this.tradeQuote=null;this.connection?.send({type:'tradeCommit',request:this.tradeRequest,token});this.showMerchant();});}
        else button.color=new Color(130,130,130,255);
    }
    private shopPrice(item:any):number {
        const info=this.itemInfo.get(item.itemindex);if(!info)return 0;let p=info.price;
        if(info.durability>0){p=Math.floor((item.maxdura??0)*(info.price/2/info.durability));const ratio=item.maxdura>0?item.currentdura/item.maxdura:0;p=Math.floor(p/2+p/2*ratio+info.price/2);}
        return Math.floor(p*(1+(item.addedstats?.count??0)*.1)*(item.count??1)*this.shopRate);
    }
    private showShop():void {
        this.menuKind='shop';this.menu.children.slice().forEach(c=>c.destroy());this.panelRects=[];this.menu.active=true;
        // FState.ShowShopItems keeps the merchant conversation above its item list.
        this.renderNPCDialog();
        // Original shop opens the bag on the right. Clamp the source's 475px
        // position to our supplied 336px bag so its close button stays visible.
        if(this.shopBagOpen)this.renderBag(Math.min(475,800-this.frames.get('ui:ClassicPrguse:3')!.meta.w));
        // FState.Init/DMenuDlgDirectPaint: original 385 frame, 10 rows at 13px.
        const dialog=this.nativeWindow(this.menu,'ui:ClassicPrguse:385',0,176);
        for(const [text,x,width] of [['物品列表',19,127],['费用(金币)',156,77],['持久',245,38]] as const)this.nativeField(dialog,text,x,9,width,16,12,Color.WHITE);
        this.goods.slice(this.shopTop,this.shopTop+10).forEach((item,i)=>{
            const selected=String(this.selectedGood?.uniqueid)===String(item.uniqueid),color=selected?Color.RED:Color.WHITE,y=38+i*13;
            if(selected)this.nativeLabel(dialog,'•',10,y,12,10,Color.RED);
            const row=this.makeNode('商品 '+this.itemName(item),dialog);row.setPosition(14,-(32+i*13));row.getComponent(UITransform)!.setAnchorPoint(0,1);row.getComponent(UITransform)!.setContentSize(265,13);
            this.nativeClick(row,()=>{this.selectedGood=item;this.showShop();this.targetText.string=this.itemHint(item);});
            this.nativeField(dialog,this.itemName(item),19,y-6,127,13,12,color);
            this.nativeField(dialog,String(this.shopPrice(item)),156,y-6,77,13,12,color,Label.HorizontalAlign.RIGHT);
            this.nativeField(dialog,item.maxdura?String(Math.ceil(item.maxdura/1000)):'-',245,y-6,38,13,12,color,Label.HorizontalAlign.CENTER);
        });
        this.nativeButton(dialog,'ui:ClassicPrguse:388',43,175,()=>{this.shopTop=Math.max(0,this.shopTop-9);this.showShop();});
        this.nativeButton(dialog,'ui:ClassicPrguse:387',90,175,()=>{if(this.shopTop+10<this.goods.length)this.shopTop+=9;this.showShop();});
        this.nativeButton(dialog,'ui:ClassicPrguse:386',215,171,()=>{
            if(!this.selectedGood){this.notice('请先选择物品。');return;}
            if(this.gold<this.shopPrice(this.selectedGood)){this.notice('金币不足。');return;}
            if(!this.inventory.some(i=>!i)){this.notice('背包空间不足。');return;}
            this.connection?.send({type:'buy',itemIndex:Number(this.selectedGood.uniqueid),count:1});
        });
        this.nativeButton(dialog,'ui:ClassicPrguse:64',291,0,()=>this.showNPC(this.npcPage));
    }
    private skillRequest=0;private skillPending=false;private skillPage=0;private bindingSpell=0;private bindingKey=0;
    private skillName(spell:number):string {
        const names:Record<number,string>={1:'基本剑术',2:'攻杀剑术',3:'刺杀剑术',4:'半月弯刀',5:'野蛮冲撞',8:'烈火剑法',31:'火球术',61:'治愈术'};
        return names[spell]??`技能 ${spell}`;
    }
    private skillIcon(spell:number):number|undefined {
        // Delphi FState DStMag1Click uses Magic.DB Effect * 2, not Crystal Icon.
        return ({1:0,2:10,3:26,4:46,5:50,8:48,31:2,61:4} as Record<number,number>)[spell];
    }
    private castKey(key:number):void {
        const magic=this.magics.find(m=>m.key===key);
        if(!magic){this.notice(`F${key} 尚未设置技能，请按 F11 设置。`);return;}
        this.cast(magic.spell);
    }
    private saveSkillKey():void {
        if(this.skillPending||!this.serverReady)return;
        const request=++this.skillRequest;
        if(this.connection?.send({type:'skillKey',request,spell:this.bindingSpell,key:this.bindingKey})){
            this.skillPending=true;this.showSkillKeys(this.bindingSpell,false);
        }else this.notice('连接已断开，键位尚未保存。');
    }
    private showSkillKeys(spell:number,reset=true):void {
        const magic=this.magics.find(m=>m.spell===spell);if(!magic)return;
        this.chatInput?.closeEditor();this.keys.clear();this.path=[];
        if(reset){this.bindingSpell=spell;this.bindingKey=magic.key>=1&&magic.key<=8?magic.key:0;}
        this.menuKind='skillKeys';this.menu.children.slice().forEach(c=>c.destroy());this.panelRects=[];this.menu.active=true;
        // Original Delphi FState: native 229 dialog; 230/232..246 key buttons.
        const frame=this.frames.get('ui:ClassicPrguse:229')!.meta;
        const dialog=this.nativeWindow(this.menu,'ui:ClassicPrguse:229',(800-frame.w)/2,(600-frame.h)/2);
        this.panelRects.push({x:0,y:0,w:800,h:600}); // Modal: clicks must not move/attack behind the dialog.
        this.nativeLabel(dialog,this.skillName(spell)+' 快捷键',95,38,14,230,C.gold);
        const icon=this.skillIcon(spell);if(icon!==undefined)this.nativeImage(dialog,`ui:MagIcon:${icon}`,52,29);
        const positions=[299,34,66,98,130,171,203,235,267];
        positions.forEach((x,key)=>{
            const index=(key===0?230:230+key*2)+(this.bindingKey===key?1:0);
            this.nativeButton(dialog,`ui:ClassicPrguse:${index}`,x,83,()=>{if(!this.skillPending){this.bindingKey=key;this.showSkillKeys(spell,false);}});
        });
        const occupied=this.magics.find(m=>m.spell!==spell&&m.key===this.bindingKey&&this.bindingKey>0);
        this.nativeLabel(dialog,this.skillPending?'正在保存…':occupied?`将替换${this.skillName(occupied.spell)}的键位`:'选择快捷键，确认保存；Esc 取消。',32,122,10,310,C.muted);
        this.nativeButton(dialog,'ui:ClassicPrguse:62',222,131,()=>this.saveSkillKey());
    }
    private showSkills(page=0):void {
        this.targetText.string='';
        this.skillPage=page;this.menuKind='skills';this.menu.children.slice().forEach(c=>c.destroy());this.panelRects=[];this.menu.active=true;
        const dialog=this.nativeWindow(this.menu,'ui:ClassicPrguse:380',540,0);this.nativeField(dialog,'技能',20,14,215,22,14,C.gold,Label.HorizontalAlign.CENTER);this.closeNative(dialog,235,3);
        if(!this.magics.length){this.nativeLabel(dialog,'尚未学习技能',20,108,12,235);this.nativeLabel(dialog,'达到对应等级后，使用技能书学习。',20,137,11,235);return;}
        if(page>0){const previous=this.nativeLabel(dialog,'上一页',20,330,12,80,C.gold);this.nativeClick(previous.node,()=>this.showSkills(page-1));}
        if((page+1)*5<this.magics.length){const next=this.nativeLabel(dialog,'下一页',158,330,12,80,C.gold);this.nativeClick(next.node,()=>this.showSkills(page+1));}
        for(const [i,m] of this.magics.slice(page*5,page*5+5).entries()){
            const icon=this.skillIcon(m.spell);
            if(icon!==undefined){const sprite=this.nativeImage(dialog,`ui:MagIcon:${icon}`,20,78+i*42);this.nativeClick(sprite.node,()=>this.showSkillKeys(m.spell));}
            const y=78+i*42;
            const label=this.nativeField(dialog,this.skillName(m.spell),60,y,121,16,12);
            const key=this.nativeField(dialog,m.key>=1&&m.key<=8?'F'+m.key:'未设置',187,y,48,16,12,C.gold,Label.HorizontalAlign.RIGHT);
            for(const field of [label,key])this.nativeClick(field.node,()=>this.showSkillKeys(m.spell));
            this.nativeField(dialog,`等级 ${m.level} · 熟练度 ${m.experience??0}/${m['need'+(m.level+1)]??'—'}`,60,y+18,175,16,11,C.muted);
        }

    }
    private spawnEntity(d:any,kind:string):void {
        if(d.objectid===this.ownId||!d.location)return;let p=this.peers.get(d.objectid);
        if(!p){const node=this.makeNode(`Entity${d.objectid}`,this.objects),body=this.sprite(node,'Body'),label=this.text(this.labels,'',0,0,12,Color.WHITE,160);
            this.outlineName(label);p={node,body,label,point:d.location,visual:{...d.location},from:{...d.location},direction:d.direction??4,elapsed:1};this.peers.set(d.objectid,p);}
        const names:Record<string,string>={BichonTrader:'比奇商人',BichonDeer:'鹿',BichonScarecrow:'稻草人'};
        if(kind==='player'&&!p.weapon){p.weapon=this.sprite(p.node,'Weapon');p.hair=this.sprite(p.node,'Hair');}
        if(d.namecolour&&p.label)p.label.color=this.nameColor(d.namecolour);
        Object.assign(p,{kind,name:names[d.name]??d.name??kind,image:d.image??0,armour:d.armour??0,weaponShape:d.weapon??-1,hairShape:d.hair??0,gender:d.gender??0,dead:d.dead??false,harvested:d.skeleton??false});
    }
    private spellEffect(from:Point,to:Point,hit=false):void {
        const def=this.manifest.spellFireBall;let keys:string[]=hit?def?.hit:def?.projectile?.[(directionTo(from,to)*2)%16];
        if(!keys?.length)return;const node=this.makeNode('Fireball',this.effects),sprite=this.sprite(node,'Flame');
        this.particleEffects.push({node,sprite,keys,age:0,life:hit?.5:.6,from:{...from},to:{...to}});
    }
    private packet(name:string,raw:any):void {
        if(['NewItemInfo','LevelChanged','DuraChanged','ItemRepaired','ItemUpgraded','ItemUsed','DeleteItem','DeleteItems','GainedItem','EquipItem','RemoveItem','MoveItem','SellItem'].includes(name))this.clearItemTooltip();
        const d=this.normalize(raw),id=d.objectid,p=this.peers.get(id);if(name==='BaseStatsInfo'){this.baseStats=d.stats?.stats??[];return;}
        if(name==='ColourChanged'){this.ownLabel.color=this.nameColor(d.namecolour);return;}
        if(name==='ObjectColourChanged'){if(p?.label)p.label.color=this.nameColor(d.namecolour);return;}
        if(name==='ObjectName'){if(p?.label)p.label.color=this.nameColor(d.namecolour);if(p&&d.name)p.name=d.name;return;}
        if(name==='NewItemInfo'){this.itemInfo.set(d.info.index,d.info);return;}
        if(name==='ObjectItem'||name==='ObjectGold'){this.groundItem(d,name==='ObjectGold');return;}
        if(name==='ObjectHarvested'&&p){p.harvested=true;this.notice('尸体已采集完毕');return;}
        if(name==='ObjectHarvest'&&p){p.action='harvest';p.actionTime=.6;p.elapsed=0;p.direction=d.direction;if(d.location){p.point={...d.location};p.from={...d.location};p.visual={...d.location};}return;}
        if(name==='ObjectMonster'){this.spawnEntity(d,'monster');return;}
        if(name==='ObjectNPC'){this.spawnEntity(d,'npc');return;}
        if(name==='ObjectPlayer'){if(id===this.ownId){this.hairShape=d.hair??this.hairShape;this.gender=d.gender??this.gender;}else this.spawnEntity(d,'player');return;}
        if(name==='PlayerUpdate'&&p?.kind==='player'){p.armour=d.armour;p.weaponShape=d.weapon;return;}
        if(['ObjectWalk','ObjectRun','ObjectTurn'].includes(name)&&p){if(d.location){p.from={...p.visual};p.point=d.location;p.elapsed=0;}p.direction=d.direction??p.direction;}
        if(name==='ObjectRemove'){const loot=this.loot.get(id);loot?.node.destroy();loot?.label.node.destroy();this.loot.delete(id);if(this.pickupTarget===id)this.pickupTarget=0;p?.node.destroy();p?.label?.node.destroy();p?.healthBar?.node.destroy();this.peers.delete(id);}
        if(name==='ObjectHealth'&&p){p.hp=d.percent;p.healthUntil=Date.now()+Math.max(0,d.expire??0)*1000;}
        if(name==='HealthChanged'){if(this.hp>0&&d.hp<=0)this.animationClock=0;this.hp=d.hp;this.mp=d.mp;}if(name==='Struck'){this.sound.play('138');this.ownAction='hit';this.actionTime=.4;this.animationClock=0;}if(name==='Death'){this.sound.play('144');this.hp=0;if(this.menu.active){if(this.menuKind==='inventory')this.showInventory();else if(this.menuKind==='shop')this.showShop();}this.notice('你已倒下，打开人物装备栏选择回城复活');}
        if(name==='MapInformation'||name==='MapChanged'){this.changeMap(d.filename,d.location,d.direction);return;}
        if(name==='Revived'){this.clearMovement();this.menu.active=false;if(this.targetText)this.targetText.string='';this.notice('已回城复活');}
        if(name==='GainExperience'){this.experience+=d.amount;this.notice(`获得 ${d.amount} 点经验`);}
        if(name==='LevelChanged'){this.level=d.level;this.experience=d.experience;this.maxExperience=d.maxexperience;this.notice(`等级提升至 ${this.level} 级`);}
        if(name==='NewMagic'&&!d.hero){const at=this.magics.findIndex(m=>m.spell===d.magic.spell);if(at<0)this.magics.push(d.magic);else this.magics[at]=d.magic;}
        if(name==='MagicLeveled'&&d.objectid===this.ownId){const magic=this.magics.find(m=>m.spell===d.spell);if(magic)Object.assign(magic,{level:d.level,experience:d.experience});}
        if(name==='RemoveMagic'&&d.placeid>=0&&d.placeid<this.magics.length)this.magics.splice(d.placeid,1);
        if(['NewMagic','MagicLeveled','RemoveMagic'].includes(name)&&this.menuKind==='skills'&&this.menu.active)this.showSkills();
        if(name==='GainedGold'){this.gold+=d.gold;if(this.menuKind==='merchant'&&this.menu.active)this.showMerchant();}
        if(name==='LoseGold'){this.gold-=d.gold;if(this.menuKind==='shop'&&this.menu.active)this.showShop();}
        if(name==='DamageIndicator'&&d.damage!==0){this.notice(`${id===this.ownId?'你':p?.name??'目标'} ${d.damage<0?'受到':'恢复'} ${Math.abs(d.damage)} 点${d.damage<0?'伤害':'生命'}`);if(p&&d.damage<0&&(this.fireTargets.get(id)??0)>Date.now()){this.spellEffect(p.point,p.point,true);this.sound.play('M31-2');this.fireTargets.delete(id);}}
        if(name==='ObjectDied'&&p){if(p.kind==='monster')this.sound.play(`${String(p.image).padStart(3,'0')}-3`);this.fireTargets.delete(id);p.dead=true;p.from={...p.point};p.visual={...p.point};p.elapsed=0;p.actionTime=0;this.notice(`${p.name} 已倒下`);}
        if(['ObjectAttack','ObjectMagic','ObjectStruck'].includes(name)){const action=name==='ObjectAttack'?'attack':name==='ObjectMagic'?'cast':'hit';if(p?.kind==='monster'&&name!=='ObjectMagic')this.sound.play(`${String(p.image).padStart(3,'0')}-${name==='ObjectAttack'?1:2}`);if(id===this.ownId&&name==='ObjectStruck')this.sound.play('138');if(id===this.ownId){this.ownAction=action;this.actionTime=.8;this.animationClock=0;this.facing=d.direction??this.facing;}else if(p){p.action=action;p.actionTime=.8;p.from={...p.point};p.visual={...p.point};p.elapsed=0;p.direction=d.direction??p.direction;}}
        if(name==='Magic'){if(d.cast){this.sound.play('M31-0');this.sound.play('M31-1',.25);this.ownAction='cast';this.actionTime=.8;this.animationClock=0;this.spellEffect(this.point,d.target??this.point);this.fireTargets.set(d.targetid,Date.now()+1500);this.notice('施放火球术');}else this.notice('施法未成功：检查目标距离、MP 或冷却');}
        if(name==='EquipItem'||name==='RemoveItem'){
            if(!d.success){this.notice('装备操作被服务器拒绝');return;}
            const from=name==='EquipItem'?this.inventory:this.equipment,to=name==='EquipItem'?this.equipment:this.inventory;
            const index=from.findIndex(i=>i&&String(i.uniqueid)===String(d.uniqueid));
            if(index>=0){this.sound.play((from[index].info??this.itemInfo.get(from[index].itemindex))?.type===1?'111':'112');const previous=to[d.to];to[d.to]=from[index];from[index]=previous??null;this.notice(name==='EquipItem'?'装备已穿戴':'装备已卸下');}
            this.refreshBelt();if(this.menu.active){if(this.menuKind==='inventory')this.showInventory();else if(this.menuKind==='shop')this.showShop();}
        }
        if(name==='ItemUpgraded'){
            const item=d.item;item.info=this.itemInfo.get(item.itemindex);
            for(const bag of [this.inventory,this.equipment]){const index=bag.findIndex(v=>v&&String(v.uniqueid)===String(item.uniqueid));if(index>=0)bag[index]=item;}
            this.refreshBelt();if(this.menuKind==='inventory'&&this.menu.active)this.showInventory();
        }
        if(name==='GainedItem'){this.sound.play('106');d.item.info=this.itemInfo.get(d.item.itemindex);if(!gainItem(this.inventory,d.item)){this.notice('物品状态待同步，正在重新连接');this.connection?.reconnect();return;}this.refreshBelt();this.notice(`获得 ${this.itemName(d.item)}`);if(this.menu.active){if(this.menuKind==='inventory')this.showInventory();else if(this.menuKind==='shop')this.showShop();}}
        if(name==='UseItem'){
            const key=String(d.uniqueid),item=this.inventory.find(i=>i&&String(i.uniqueid)===key);this.pendingUses.delete(key);
            if(consumeItem(this.inventory,key,d.success)){const book=(item?.info??this.itemInfo.get(item?.itemindex))?.type===20;if(!book)this.sound.play('108');this.notice(`${book?'已使用技能书':'服用'} ${this.itemName(item)}`);this.refreshBelt();if(this.menu.active){if(this.menuKind==='inventory')this.showInventory();else if(this.menuKind==='shop')this.showShop();}}
            else if(!d.success)this.notice((item?.info??this.itemInfo.get(item?.itemindex))?.type===20?'技能书未使用：请检查职业、等级或是否已经学会。':'物品未使用：服务器拒绝此次操作');
        }
        if(name==='NPCResponse')this.showNPC(d.page??[]);
        if(name==='MoveItem'&&d.grid===1){
            this.bagMovePending=false;this.selectedBag=-1;
            if(d.success&&Number.isInteger(d.from)&&Number.isInteger(d.to)&&d.from>=0&&d.to>=0&&d.from<this.inventory.length&&d.to<this.inventory.length){const item=this.inventory[d.from];this.inventory[d.from]=this.inventory[d.to];this.inventory[d.to]=item;if(this.bagSwapSource===d.from&&this.inventory[d.from]){this.selectedBag=d.from;this.selectedBagAt=0;}}
            else if(!d.success)this.notice('物品移动未成功，背包保持原状。');
            this.bagSwapSource=-1;this.refreshBelt();if(this.menu.active&&this.menuKind==='inventory')this.showInventory();
        }
        if(name==='SellItem'){
            if(d.success){const i=this.inventory.findIndex(v=>v&&String(v.uniqueid)===String(d.uniqueid));if(i>=0){if(this.inventory[i].count<=d.count)this.inventory[i]=null;else this.inventory[i].count-=d.count;}this.refreshBelt();}
            else this.notice('出售未成功，物品仍在背包中。');
            if(this.menuKind==='merchant'&&this.menu.active)this.showMerchant();
        }
        if(name==='DuraChanged'){for(const bag of [this.inventory,this.equipment]){const item=bag.find(v=>v&&String(v.uniqueid)===String(d.uniqueid));if(item)item.currentdura=d.currentdura;}return;}
        if(name==='ItemRepaired'){
            for(const bag of [this.inventory,this.equipment]){const item=bag.find(v=>v&&String(v.uniqueid)===String(d.uniqueid));if(item){item.currentdura=d.currentdura;item.maxdura=d.maxdura;}}
            if(this.menuKind==='merchant'&&this.menu.active)this.showMerchant();
        }
        if(name==='NPCSell')this.showMerchant('sell');
        if(name==='NPCRepair')this.showMerchant('repair');
        if(name==='NPCSRepair')this.showMerchant('special');
        if(name==='NPCGoods'){this.shopBagOpen=true;this.goods=d.list??[];this.shopRate=d.rate??1;this.selectedGood=null;this.shopTop=0;this.showShop();}
        if(name==='Chat'&&d.message)this.notice(d.message,d.type??0);
        if(name==='ObjectChat'&&d.text)this.notice(d.text,d.type??0);
        if(['SwitchGroup','AddMember','DeleteMember','DeleteGroup','GroupInvite'].includes(name))this.party?.event(name,d);
        if(name==='ChangeAMode'){this.attackMode=d.mode;this.notice(ATTACK_MODES[d.mode]??'攻击模式已更新');}

    }
    onDestroy():void {this.miniMap?.destroy();this.party?.destroy();this.accounts?.destroy();this.chatInput?.destroy();this.resizeObserver?.disconnect();this.sound.destroy();
        input.off(Input.EventType.KEY_DOWN,this.onKeyDown,this);input.off(Input.EventType.KEY_UP,this.onKeyUp,this);
        input.off(Input.EventType.MOUSE_UP,this.onMouse,this);input.off(Input.EventType.TOUCH_END,this.onTouch,this);input.off(Input.EventType.MOUSE_MOVE,this.onHover,this);
        if(typeof document!=='undefined')document.removeEventListener('pointermove',this.trackPointer,true);
        this.connection?.close();delete (globalThis as any).__MIRQA;
        game.off(Game.EVENT_HIDE,this.pauseInput,this);
        this.terrain?.destroy();this.store?.destroy();
    }
}
