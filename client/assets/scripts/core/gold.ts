export function parseGoldAmount(text:string,maximum:number):number|null {
 if(!/^[0-9]{1,10}$/.test(text))return null;
 const value=Number(text);
 return Number.isSafeInteger(value)&&value>0&&value<=Math.min(maximum,4294967295)?value:null;
}
