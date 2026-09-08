/** Crystal ObjectHealth uses a percentage and a visibility duration in seconds. */
export function healthWidth(percent:number|undefined):number {
    return Number.isFinite(percent)?Math.floor(32*Math.max(0,Math.min(100,percent!))/100):0;
}
export function showHealth(kind:string|undefined,dead:boolean|undefined,percent:number|undefined,expires:number|undefined,now:number):boolean {
    return (kind==='player'||kind==='monster')&&!dead&&Number.isFinite(percent)&&now<(expires??0);
}
