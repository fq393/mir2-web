/** List state only. Character identity and capacity come from the server. */
export function characterListState(rows:any[],selected:number,pageSize=2){
 const characters=rows.map(c=>({index:c.Index??c.index,name:c.Name??c.name,level:c.Level??c.level,role:c.Class??c.class,gender:c.Gender??c.gender}));
 const index=characters.some(c=>c.index===selected)?selected:characters[0]?.index??0;
 const page=Math.max(0,Math.floor(characters.findIndex(c=>c.index===index)/pageSize));
 return {characters,selected:index,page,pages:Math.max(1,Math.ceil(characters.length/pageSize))};
}
