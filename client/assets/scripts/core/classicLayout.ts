import type {Point} from './grid';
// Delphi Share.pas 800x600 path; original Prguse1 is 800x251.
export const CLASSIC={width:800,height:600,hudTop:349,worldCenterX:400,worldCenterY:222,mapBottom:469} as const;
export type PanelRect={x:number;y:number;w:number;h:number};
export function worldToScreen(p:Point,camera:Point):Point{return {x:400+(p.x-camera.x)*48+24,y:222+(p.y-camera.y)*32+16};}
export function screenToCell(p:Point,camera:Point):Point{return {x:Math.floor((p.x-400)/48+camera.x),y:Math.floor((p.y-222)/32+camera.y)};}
// Interactive round controls cover transparent pixels too.
export const HUD_CONTROLS:PanelRect[]=[{x:634,y:398,w:40,h:40},{x:674,y:377,w:40,h:40},{x:714,y:357,w:40,h:40},{x:754,y:349,w:40,h:40}];
export function blocksWorld(x:number,y:number,panels:PanelRect[],hudRows:string[]):boolean{
 if(x<0||x>=800||y<0||y>=469)return true;
 if(HUD_CONTROLS.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h))return true;
 if(panels.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h))return true;
 return y>=349&&hudRows[Math.floor(y)-349]?.[Math.floor(x)]==='1';
}
// FState.Init DSW* positions; slot numbers are the pinned Crystal wire enum.
export const JEWELLERY_SLOTS=[{slot:4,x:168,y:87},{slot:6,x:42,y:176},{slot:5,x:168,y:176},{slot:8,x:42,y:215},{slot:7,x:168,y:215}] as const;
