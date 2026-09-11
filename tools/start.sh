#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"
if [ ! -f build/web/index.html ]; then bash tools/build-web.sh;fi
mkdir -p .runtime
server_pid=''
cleanup() { if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true;fi; }
trap cleanup EXIT INT TERM
crystal_healthy() {
  curl --noproxy '*' --max-time 2 -fsS http://127.0.0.1:17080/health | python3 -c 'import json,sys; d=json.load(sys.stdin);sys.exit(not(d.get("engine")=="Suprcode/Crystal" and d.get("running")))' 2>/dev/null
}
if ! crystal_healthy; then
  bash tools/start-server.sh > .runtime/server.log 2>&1 &
  server_pid=$!
  for attempt in $(seq 1 60); do
    if ! kill -0 "$server_pid" 2>/dev/null;then tail -40 .runtime/server.log;exit 1;fi
    if crystal_healthy;then break;fi
    sleep 1
  done
  kill -0 "$server_pid" 2>/dev/null && crystal_healthy || { tail -40 .runtime/server.log;exit 1; }
fi
if curl --noproxy '*' --max-time 2 -fsS http://127.0.0.1:17600/__mir2_health | python3 -c 'import json,sys;d=json.load(sys.stdin);sys.exit(not(d.get("project")=="mir2-web" and d.get("root")==sys.argv[1] and d.get("webBuild")))' "$project_root" 2>/dev/null;then
  echo 'Mir2 已在 http://127.0.0.1:17600 运行'
  if [ -n "$server_pid" ];then wait "$server_pid";fi
else
  echo '浏览器打开 http://127.0.0.1:17600 ，关闭此终端或 Ctrl+C 停止本次启动的服务。'
  python3 tools/serve.py
fi
