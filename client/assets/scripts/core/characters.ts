/** IntroScn.pas ChrArr[0..1]: two native slots, no invented pagination. */
export const CLASSIC_CHARACTER_SLOTS=2;
export function characterListState(rows:any[],selected:number){
 const characters=rows.slice(0,CLASSIC_CHARACTER_SLOTS).map(c=>({index:c.Index??c.index,name:c.Name??c.name,level:c.Level??c.level,role:c.Class??c.class,gender:c.Gender??c.gender}));
 const index=characters.some(c=>c.index===selected)?selected:characters[0]?.index??0;
 return {characters,selected:index};
}
