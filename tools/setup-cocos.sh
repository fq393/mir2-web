#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
creator="$project_root/.runtime/cocos/CocosCreator.app/Contents/MacOS/CocosCreator"
if [ -x "$creator" ]; then echo 'Cocos Creator 3.8.8 is ready';exit 0;fi
mkdir -p "$project_root/.runtime"
archive="$project_root/.runtime/CocosCreator-3.8.8.zip"
curl -fL --retry 2 'https://download.cocos.com/CocosCreator/v3.8.8/CocosCreator-v3.8.8-mac-121518.zip' -o "$archive"
ditto -x -k "$archive" "$project_root/.runtime/cocos"
test -x "$creator"
echo 'Cocos Creator 3.8.8 installed inside .runtime/cocos'
