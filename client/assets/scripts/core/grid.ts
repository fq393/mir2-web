export type Point = {x: number; y: number};
export type Grid = {width: number; height: number; blocked: Set<string>};
const directions = [{x:0,y:-1},{x:1,y:-1},{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:-1,y:-1}];
const key = (p: Point): string => `${p.x},${p.y}`;
const clear = (g: Grid, p: Point): boolean => p.x >= 0 && p.y >= 0 && p.x < g.width && p.y < g.height && !g.blocked.has(key(p));
export function canStep(g: Grid, from: Point, to: Point): boolean {
    const dx = Math.abs(to.x-from.x), dy = Math.abs(to.y-from.y);
    if (dx > 1 || dy > 1 || (!dx && !dy) || !clear(g, to)) return false;
    return !(dx && dy) || (clear(g, {x:from.x,y:to.y}) && clear(g,{x:to.x,y:from.y}));
}
export function directionTo(from: Point, to: Point): number {
    const x = Math.sign(to.x-from.x), y = Math.sign(to.y-from.y);
    const result = directions.findIndex(d => d.x === x && d.y === y);
    return result < 0 ? 4 : result;
}
type SearchNode = {id:number; cost:number; estimate:number;deviation:number};
// Binary min-heap: prefer the node nearer the goal when total costs tie.
class Frontier {
    private items:SearchNode[]=[];
    private before(a:SearchNode,b:SearchNode):boolean {
        return a.estimate<b.estimate || (a.estimate===b.estimate && (a.cost>b.cost || a.cost===b.cost&&a.deviation<b.deviation));
    }
    push(node:SearchNode):void {
        let i=this.items.length;this.items.push(node);
        while(i>0){const parent=(i-1)>>1;if(!this.before(node,this.items[parent]))break;
            this.items[i]=this.items[parent];i=parent;}
        this.items[i]=node;
    }
    pop():SearchNode|undefined {
        const first=this.items[0],last=this.items.pop();
        if(this.items.length && last){
            let i=0;
            while(i*2+1<this.items.length){
                let child=i*2+1;
                if(child+1<this.items.length&&this.before(this.items[child+1],this.items[child]))child++;
                if(!this.before(this.items[child],last))break;
                this.items[i]=this.items[child];i=child;
            }
            this.items[i]=last;
        }
        return first;
    }
}
export function findPath(g: Grid, start: Point, goal: Point): Point[] {
    if (!clear(g,start) || !clear(g,goal) || key(start) === key(goal)) return [];
    const width=g.width,total=width*g.height,startId=start.y*width+start.x,goalId=goal.y*width+goal.x;
    const costs=new Int32Array(total),previous=new Int32Array(total),terrain=new Uint8Array(total);
    costs.fill(-1);costs[startId]=0;
    // Cache occupancy within this search only, so later collision edits remain visible.
    const walkable=(x:number,y:number):boolean=>{
        if(x<0||y<0||x>=width||y>=g.height)return false;
        const id=y*width+x;
        if(!terrain[id])terrain[id]=g.blocked.has(`${x},${y}`)?2:1;
        return terrain[id]===1;
    };
    // Every permitted step has equal duration; Chebyshev distance is admissible.
    const distance=(x:number,y:number):number=>Math.max(Math.abs(x-goal.x),Math.abs(y-goal.y));
    const frontier=new Frontier();frontier.push({id:startId,cost:0,estimate:distance(start.x,start.y),deviation:0});
    let current:SearchNode|undefined;
    while((current=frontier.pop())){
        if(current.cost!==costs[current.id])continue;
        if(current.id===goalId){
            const path:Point[]=[];
            for(let id=goalId;id!==startId;id=previous[id])path.push({x:id%width,y:Math.floor(id/width)});
            return path.reverse();
        }
        const x=current.id%width,y=Math.floor(current.id/width),cost=current.cost+1;
        for(const d of directions){
            const nx=x+d.x,ny=y+d.y;
            if(!walkable(nx,ny))continue;
            // Same diagonal corner rule as canStep, using cached occupancy.
            if(d.x&&d.y&&(!walkable(x,ny)||!walkable(nx,y)))continue;
            const id=ny*width+nx;
            if(costs[id]>=0&&costs[id]<=cost)continue;
            costs[id]=cost;previous[id]=current.id;
            frontier.push({id,cost,estimate:cost+distance(nx,ny),deviation:Math.abs((nx-start.x)*(goal.y-start.y)-(ny-start.y)*(goal.x-start.x))});
        }
    }
    return [];
}
/** Crystal MapControl.Direction16: nearest 22.5 degree sector, north = 0. */
export function projectileDirection(from:{x:number;y:number},to:{x:number;y:number}):number {
    const dx=to.x-from.x,dy=to.y-from.y;
    if(!dx&&!dy)return 0;
    return (Math.floor(Math.atan2(dx,-dy)/(Math.PI/8)+.5)+16)%16;
}
