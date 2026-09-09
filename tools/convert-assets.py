#!/usr/bin/env python3
"""Convert Crystal v2/v3 gzip BGRA libraries and v100/version1 maps to browser assets.
Only selected frames are exported; original numeric library/image IDs survive.
"""
import argparse, gzip, hashlib, json, struct
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageOps
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'raw-assets'
OUT = ROOT / 'client/assets/resources/mir'
LIBRARIES = {0:'Data/Map/WemadeMir2/Tiles.Lib',1:'Data/Map/WemadeMir2/SmTiles.Lib',2:'Data/Map/WemadeMir2/Objects.Lib','armour0':'Data/CArmour/00.Lib'}
for k in (5,6,7,21,22,24): LIBRARIES[k]=f'Data/Map/WemadeMir2/Objects{k-1}.Lib'
for k,n in ((251,'Dungeonsc'),(253,'Furnituresc'),(254,'Wallsc'),(255,'SmObjectsc'),(257,'Object1c')): LIBRARIES[k]=f'Data/Map/WemadeMir3/Snow/{n}.Lib'
LIBRARIES.update(armour1='Data/CArmour/01.Lib',weapon1='Data/CWeapon/01.Lib',hair0='Data/CHair/00.Lib',npc0='Data/NPC/00.Lib',monster4='Data/Monster/004.Lib',monster5='Data/Monster/005.Lib',magic='Data/Magic.Lib')

for actor in ('armour0','armour1','weapon1','hair0'):LIBRARIES[actor+'f']=LIBRARIES[actor]

def rawpath(name): return RAW / name.replace('/','_')

class Library:
    def __init__(self,path):
        self.path=Path(path); self.segments=[]
        pins=json.loads((ROOT/'tools/asset-inputs.json').read_text())['sources']
        for source in pins:
            if source['path'].replace('/','_')!=self.path.name:continue
            p=self.path.parent/source.get('localFile',self.path.name)
            start=int(source['byteRange'].split('-')[0]) if source['byteRange'] else 0
            self.segments.append((start,p.read_bytes()))
        self.version,self.count=struct.unpack('<ii',self.read(0,8))
        if self.version not in (2,3):raise ValueError(f'Unsupported Lib version {self.version}')
        self.offsets=struct.unpack(f'<{self.count}i',self.read(12 if self.version==3 else 8,self.count*4))
    def read(self,offset,length):
        for start,data in self.segments:
            if start<=offset and offset+length<=start+len(data):return data[offset-start:offset-start+length]
        raise ValueError(f'Missing downloaded range {self.path.name} {offset}-{offset+length-1}')
    def frame_set(self):
        if self.version<3:return {}
        seek=struct.unpack('<i',self.read(8,4))[0]
        count=struct.unpack('<i',self.read(seek,4))[0]
        if not 0<=count<=256:raise ValueError('Invalid custom frame count')
        fields=('start','count','skip','interval','effectStart','effectCount','effectSkip','effectInterval','reverse','blend')
        result={}
        for i in range(count):
            action,*values=struct.unpack('<B8i??',self.read(seek+4+i*35,35));result[action]=dict(zip(fields,values))
        return result
    def frame(self,index):
        # Crystal CheckImage skips out-of-range indices and zero dimensions.
        if not 0<=index<self.count:return None
        off=self.offsets[index]
        if not off:return None
        w,h,x,y,sx,sy,shadow,length=struct.unpack('<hhhhhhBi',self.read(off,17))
        if not w or not h:return None
        if w<0 or h<0 or length<0:raise ValueError('Invalid image bounds')
        pixels=gzip.decompress(self.read(off+17,length))
        sw,sh=w,h
        if len(pixels)!=w*h*4:
            sw,sh=(w+3)//4*4,(h+3)//4*4
            if len(pixels)!=sw*sh*4:raise ValueError(f'BGRA byte count mismatch {self.path.name}:{index}: {w}x{h} versus {len(pixels)} bytes')
        return Image.frombytes('RGBA',(sw,sh),pixels,'raw','BGRA').crop((0,0,w,h)),dict(storedWidth=sw,storedHeight=sh,w=w,h=h,offsetX=x,offsetY=y,shadowX=sx,shadowY=sy,shadow=shadow,sourceOffset=off,sourceLength=length)

def reflect_border(image):
    """Reflect one texel preserving checker parity, including at slice boundaries."""
    w,h=image.size
    if w<2 or h<2:return ImageOps.expand(image,border=1)
    out=Image.new(image.mode,(w+2,h+2));out.paste(image,(1,1))
    out.paste(image.crop((1,0,2,h)),(0,1));out.paste(image.crop((w-2,0,w-1,h)),(w+1,1))
    out.paste(out.crop((0,2,w+2,3)),(0,0));out.paste(out.crop((0,h-1,w+2,h)),(0,h+1))
    return out

def shadow_filter(image,kernel):
    w,h=image.size
    return reflect_border(image).filter(kernel).crop((1,1,w+1,h+1))

def shadow_mask(image,color=None):
    """Opaque checker candidates with two transparent cardinal and two dark
    diagonal neighbours. An exact palette colour can further restrict matching.
    """
    r,g,b,a=image.split()
    channels=[ch.point(lambda p,target=target:255 if (p==target if color is not None else p<=8) else 0) for ch,target in zip((r,g,b),color or (0,0,0))]
    dark=ImageChops.darker(ImageChops.darker(channels[0],channels[1]),channels[2])
    transparent=a.point(lambda p:255 if p==0 else 0)
    neighbours=shadow_filter(transparent,ImageFilter.Kernel((3,3),(0,1,0,1,0,1,0,1,0),scale=4)).point(lambda p:255 if p>=127 else 0)
    opaque_dark=ImageChops.multiply(dark,a.point(lambda p:255 if p>=200 else 0))
    diagonal=shadow_filter(opaque_dark,ImageFilter.Kernel((3,3),(1,0,1,0,0,0,1,0,1),scale=4)).point(lambda p:255 if p>=127 else 0)
    return ImageChops.multiply(ImageChops.multiply(opaque_dark,neighbours),diagonal)

def smooth_shadow(image,library=None):
    """Smooth only locally identified shadows; preserve opaque body details.
    Monster 4/5 use the observed exact (16,8,8) palette shadow colour. This is
    library-scoped, never a global expansion of the near-black threshold.
    """
    result=image.copy();transparent=image.getchannel('A').point(lambda p:255 if p==0 else 0)
    for color in ([None,(16,8,8)] if library in ('monster4','monster5') else [None]):
        mask=shadow_mask(image,color)
        if not mask.getbbox():continue
        blurred=shadow_filter(mask,ImageFilter.BoxBlur(.5))
        replace=ImageChops.lighter(mask,transparent)
        if color is not None:replace=ImageChops.multiply(replace,blurred.point(lambda p:255 if p else 0))
        shadow=Image.new('RGBA',image.size,(*(color or (0,4,0)),0));shadow.putalpha(blurred)
        result.paste(shadow,(0,0),replace)
    return result

def read_map(path):
    b=Path(path).read_bytes()
    if len(b)<8: raise ValueError('Truncated map header')
    if b[:4] != b'\x01\x00C#': raise ValueError('Requires Crystal custom map v100/version1')
    w,h=struct.unpack_from('<hh',b,4)
    if w<=0 or h<=0: raise ValueError('Map dimensions must be positive')
    if len(b)!=8+w*h*26: raise ValueError('Map byte size mismatch')
    def cell(x,y):
        if not (0<=x<w and 0<=y<h): raise ValueError(f'Map cell outside bounds: {x},{y} for {w}x{h}')
        off=8+(x*h+y)*26
        bl,bi,ml,mi,fl,fi,door,dooroff,fa,ft,ma,mt,ta,to,tf,light=struct.unpack_from('<hihhhhBBBBBBhhBB',b,off)
        layers={}
        for name,lib,idx in [('back',bl,(bi&0x1fffffff)-1),('middle',ml,mi-1),('front',fl,(fi&0x7fff)-1)]:
            if lib>=0 and idx>=0: layers[name]={'library':lib,'index':idx,'key':f'{lib}:{idx}'}
        return dict(x=x,y=y,blocked=bool((bi&0x20000000) or (fi&0x8000)),rawBackImage=bi,rawFrontImage=fi,doorIndex=door&127,doorOffset=dooroff,frontAnimationFrames=fa,frontAnimationTick=ft,middleAnimationFrames=ma,middleAnimationTick=mt,tileAnimationImage=ta,tileAnimationOffset=to,tileAnimationFrames=tf,light=light,**layers)
    return w,h,cell

def validate_crop(ox,oy,cw,ch,w,h):
    if cw<=0 or ch<=0 or ox<0 or oy<0 or ox+cw>w or oy+ch>h:
        raise ValueError(f'Crop {ox},{oy},{cw},{ch} must have positive size and fit inside {w}x{h}')

def actor_actions(key,spec):
    offset=(416 if key.startswith('weapon') else 808) if key.endswith('f') else 0
    return {name:[[f'{key}:{offset+start+d*count+i}' for i in range(count)] for d in range(8)] for name,(start,count) in spec.items()}

PLAYER_ACTIONS={'stand':(0,4),'walk':(32,6),'run':(80,6),'attack':(136,6),'cast':(296,6),'harvest':(344,2),'hit':(360,3),'die':(384,4)}
MONSTER_ACTIONS={'stand':(0,4),'walk':(32,6),'attack':(80,6),'hit':(128,2),'die':(144,10)}
ACTION_IDS={'stand':0,'walk':1,'run':2,'attack':9,'hit':18,'harvest':19,'cast':20,'die':21,'skeleton':23}

def apply_custom_frames(actors):
    for key,a in actors.items():
        if key not in ('npc0','monster4','monster5'):continue
        frames=Library(rawpath(LIBRARIES[key])).frame_set()
        a['frameSetSource']='Lib-v3-tail';a['sourceFrameSet']=frames
        if key=='monster4':a['skeleton']=[]
        for action,ident in ACTION_IDS.items():
            if action not in a:continue
            if ident not in frames:raise ValueError(f'{key} custom FrameSet lacks {action}')
            f=frames[ident]
            a[action]=[[f"{key}:{f['start']+d*(f['count']+f['skip'])+i}" for i in (range(f['count']-1,-1,-1) if f['reverse'] else range(f['count']))] for d in range(8)]
            a['actionFrameMs'][action]=f['interval']


def build(ox=0,oy=0,cw=700,ch=700):
    w,h,getcell=read_map(rawpath('Map/0.map'));validate_crop(ox,oy,cw,ch,w,h)
    actors={k:actor_actions(k,PLAYER_ACTIONS if k.startswith(('armour','weapon','hair')) else MONSTER_ACTIONS if k.startswith('monster') else {'stand':(0,4)}) for k in LIBRARIES if isinstance(k,str) and k!='magic'}
    for a in actors.values():a['actionFrameMs']={'stand':500,'walk':100,'run':100,'attack':100,'cast':100,'hit':200,'harvest':300,'die':100}
    apply_custom_frames(actors)
    spell={'cast':[f'magic:{i}' for i in range(10)],'projectile':[[f'magic:{10+d*10+i}' for i in range(6)] for d in range(16)],'hit':[f'magic:{i}' for i in range(170,180)]}
    wanted=set();cells=[]
    for y in range(oy,oy+ch):
        for x in range(ox,ox+cw):
            c=getcell(x,y)
            for layer in ('back','middle','front'):
                a=c.get(layer)
                if not a:continue
                a['render']=layer!='back' or (x%2==0 and y%2==0)
                if not a['render']:continue
                n=max(1,(c['frontAnimationFrames']&127) if layer=='front' else (c['middleAnimationFrames']&15) if layer=='middle' else 1)
                if n>1:a['animationKeys']=[f"{a['library']}:{a['index']+i}" for i in range(n)]
                wanted.update((a['library'],a['index']+i) for i in range(n))
            cells.append(c)
    for key,a in actors.items():
        for action,rows in a.items():
            if action not in ACTION_IDS:continue
            wanted.update((key,int(f.split(':')[1])) for row in rows for f in row)
    wanted.update(('magic',i) for i in range(180))
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'chunks').mkdir(exist_ok=True)
    # Group each library into a compact atlas family, so distant map regions
    # load only families actually referenced by their chunk.
    atlases=[];frames={};empty=[]
    for lib in sorted({k for k,i in wanted},key=str):
        if lib==257:
            empty.extend(f'{lib}:{i}' for k,i in sorted(wanted,key=lambda q:(str(q[0]),q[1])) if k==lib);continue
        library=Library(rawpath(LIBRARIES[lib]));images=[]
        for idx in sorted(i for k,i in wanted if k==lib):
            f=library.frame(idx)
            if f is None:empty.append(f'{lib}:{idx}');continue
            img,meta=f;images.append((f'{lib}:{idx}',smooth_shadow(img,lib),dict(library=lib,index=idx,**meta)))
        atlas=Image.new('RGBA',(2048,2048));px=py=rowh=0;dirty=False
        def flush():
            nonlocal atlas,px,py,rowh,dirty
            if not dirty:return
            name=f'atlas-{len(atlases)}.png';used_height=min(2048,1<<(max(1,py+rowh)-1).bit_length());atlas.crop((0,0,2048,used_height)).save(OUT/name,optimize=True)
            atlases.append(dict(file=name,width=2048,height=used_height,library=lib));atlas=Image.new('RGBA',(2048,2048));px=py=rowh=0;dirty=False
        for key,img,meta in sorted(images,key=lambda a:-a[1].height):
            iw,ih=img.size
            if iw+2>2048 or ih+2>2048:raise ValueError('Oversize frame')
            if px+iw+2>2048:px=0;py+=rowh;rowh=0
            if py+ih+2>2048:flush()
            atlas.paste(img,(px+1,py+1))
            atlas.paste(img.crop((0,0,iw,1)),(px+1,py));atlas.paste(img.crop((0,ih-1,iw,ih)),(px+1,py+ih+1))
            atlas.paste(img.crop((0,0,1,ih)),(px,py+1));atlas.paste(img.crop((iw-1,0,iw,ih)),(px+iw+1,py+1))
            for dx,dy,sx,sy in ((0,0,0,0),(iw+1,0,iw-1,0),(0,ih+1,0,ih-1),(iw+1,ih+1,iw-1,ih-1)):atlas.putpixel((px+dx,py+dy),img.getpixel((sx,sy)))
            frames[key]=dict(atlas=len(atlases),x=px+1,y=py+1,**meta);px+=iw+2;rowh=max(rowh,ih+2);dirty=True
        flush()
    missing_references=[]
    for c in cells:
        for layer in ('back','middle','front'):
            a=c.get(layer)
            if not a:continue
            f=frames.get(a['key'])
            if not a['render'] or not f:
                if a['render'] and not f:missing_references.append(dict(x=c['x'],y=c['y'],layer=layer,key=a['key']))
                a['render']=False;continue
            floor=layer=='back' or (f['w'],f['h']) in ((48,32),(96,64))
            a.update(floor=floor,drawX=0,drawY=0 if floor else 32-f['h'],blend=bool(layer=='front' and c['frontAnimationFrames']&128))
            if a['blend'] and 2723<=a['index']<=2732:a['drawX']+=f['offsetX'];a['drawY']+=f['offsetY']
    chunks=[]
    for cy in range(oy,oy+ch,32):
        for cx in range(ox,ox+cw,32):
            ww=min(32,ox+cw-cx);hh=min(32,oy+ch-cy)
            subset=[cells[(y-oy)*cw+x-ox] for y in range(cy,cy+hh) for x in range(cx,cx+ww)]
            needed=set()
            for c in subset:
                for layer in ('back','middle','front'):
                    a=c.get(layer)
                    if a and a.get('render'):
                        needed.update(frames[k]['atlas'] for k in [a['key'],*a.get('animationKeys',[])] if k in frames)
            subset=[{k:v for k,v in c.items() if k not in ('rawBackImage','rawFrontImage') and (k in ('x','y','blocked') or v)} for c in subset]
            file=f'chunks/{cx//32}-{cy//32}.json';(OUT/file).write_text(json.dumps(dict(x=cx,y=cy,width=ww,height=hh,cells=subset),separators=(',',':'))+'\n')
            chunks.append(dict(x=cx,y=cy,width=ww,height=hh,file=file,atlases=sorted(needed)))
    (OUT/'collision.json').write_text(json.dumps(dict(width=cw,height=ch,rows=[''.join('1' if cells[y*cw+x]['blocked'] else '0' for x in range(cw)) for y in range(ch)]),separators=(',',':'))+'\n')
    for key,a in actors.items():
        a['atlases']=sorted({f['atlas'] for f in frames.values() if f['library']==key});a['anchor']='cell-top-left-plus-library-offset';a['library']=LIBRARIES[key]
    spell['atlases']=sorted({f['atlas'] for f in frames.values() if f['library']=='magic'})
    player=dict(actors['armour0'],standFrameMs=500,walkFrameMs=100,directions=['N','NE','E','SE','S','SW','W','NW'])
    manifest=dict(schemaVersion=2,tileWidth=48,tileHeight=32,map=dict(id='0',name='比奇省',format='Crystal-v100-version1',sourceWidth=w,sourceHeight=h,width=cw,height=ch,originX=ox,originY=oy,spawn={'x':288,'y':615},chunkSize=32,chunks=chunks,collisionFile='collision.json'),atlases=atlases,frames=frames,player=player,actors=actors,spellFireBall=spell,emptyFrames=empty,missingReferences=missing_references,missingLibraries=[dict(library=257,path=LIBRARIES[257],reason='Absent from original public Crystal patch Snow directory; original client draws no image')],shadowProcessing='library-scoped-transparent-checker-to-continuous-alpha-v3-reflected-edges',sources=json.loads((ROOT/'tools/asset-inputs.json').read_text())['sources'])
    (OUT/'manifest.json').write_text(json.dumps(manifest,separators=(',',':'),ensure_ascii=False)+'\n')
    print(json.dumps(dict(frames=len(frames),atlases=len(atlases),cells=len(cells),chunks=len(chunks),emptyFrames=empty)))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--crop',nargs=4,type=int,default=[0,0,700,700]);a=p.parse_args();build(*a.crop)
