/** Protocol values from pinned Crystal Shared/Enums.cs; presentation only. */
export const ATTACK_MODES=['和平攻击','编组攻击','行会攻击','行会战争','善恶攻击','全体攻击'];
export function chatStyle(type:number):{label:string;fg:string;bg:string}{
 const styles:Record<number,[string,string,string]>={0:['普通','#fff','transparent'],1:['喊话','#000','#ff0'],2:['系统','#fff','#f00'],3:['提示','#006400','#fff'],4:['公告','#fff','#00f'],5:['队伍','#a52a2a','#fff'],6:['私聊','#00008b','#fff'],7:['私聊','#6495ed','#fff'],8:['行会','#008000','#fff'],11:['系统','#fff','#8b0000']};
 const [label,fg,bg]=styles[type]??['提示','#fff','transparent'];return {label,fg,bg};
}
export function validChat(text:string):boolean{return text.trim().length>0&&text.length<=80&&!/[\u0000-\u001f\u007f-\u009f]/.test(text);}
