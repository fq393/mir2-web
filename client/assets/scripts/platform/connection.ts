/** Only this module depends on the browser WebSocket implementation. */
export class CrystalConnection {
    private socket:WebSocket|null=null;
    private stopped=false;
    private retry:ReturnType<typeof setTimeout>|null=null;
    readonly errors:{time:number;type:string;packet:string;error:string;stack:string}[]=[];
    constructor(private onStatus:(text:string)=>void, private onEvent:(event:any)=>void) {}
    connect():void {
        this.onStatus('连接本地服务…');
        this.socket=new WebSocket('ws://127.0.0.1:17080/ws');
        this.socket.onopen=()=>this.onStatus('接入层已连接');
        this.socket.onmessage=(event)=> {
            let message:any;
            try {message=JSON.parse(String(event.data));}
            catch {this.onStatus('收到无法识别的服务消息');return;}
            try {this.onEvent(message);}
            catch(error) {
                // Retain bounded routing/stack evidence, never packet contents or credentials.
                const diagnostic={time:Date.now(),type:String(message?.type??''),packet:String(message?.packet??''),
                    error:error instanceof Error?error.name:'Error',stack:error instanceof Error?(error.stack??'').split('\n').slice(1,6).join('\n'):''};
                this.errors.push(diagnostic);if(this.errors.length>20)this.errors.shift();
                console.error('Mir2 服务消息处理失败',diagnostic);
                this.onStatus('游戏消息处理异常 · 请保留现场以便排查');
            }
        };
        this.socket.onerror=()=>{this.onStatus('本地服务连接失败');this.onEvent({type:'disconnected'});};
        this.socket.onclose=()=> {
            this.onStatus('服务已断开 · 等待重新连接');
            this.onEvent({type:'disconnected'});
            if (!this.stopped) this.retry=setTimeout(()=>this.connect(),5000);
        };
    }
    send(message:unknown):boolean {
        if (this.socket?.readyState!==WebSocket.OPEN) return false;
        try {this.socket.send(JSON.stringify(message));return true;}
        catch {this.onStatus('服务发送失败 · 等待重新连接');this.reconnect();return false;}
    }
    reconnect():void {this.close();this.onEvent({type:'disconnected'});this.stopped=false;this.connect();}
    close():void {
        this.stopped=true;if(this.retry)clearTimeout(this.retry);this.retry=null;
        if(this.socket){this.socket.onopen=null;this.socket.onmessage=null;this.socket.onerror=null;this.socket.onclose=null;this.socket.close();this.socket=null;}
    }
}
