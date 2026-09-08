/** IntroScn.pas: 10 door frames at 230ms; 16 selected frames at 300ms. */
export const DOOR_DURATION=2300;
export const doorFrame=(elapsed:number)=>Math.min(9,Math.max(0,Math.floor(elapsed/230)));
export function portraitLayout(role:number,gender:number,slot=0,frozen=false){
 const key=role*2+gender;
 const positions=[[71,52],[65,55],[77,46],[141,83],[85,63],[141,83]];
 const sizes=[[300,360],[300,360],[300,360],[176,311],[284,338],[196,314]];
 const [x,y]=positions[key]??positions[0], [w,h]=sizes[key]??sizes[0];
 const shift=frozen&&gender===1?(role===1?[30,14]:role===2?[23,20]:[0,0]):[0,0];
 return {x:x+slot*340+shift[0],y:y+slot*2+shift[1],w,h,source:`webui/auth/portrait-${role}-${gender}.png`};
}
