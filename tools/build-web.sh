#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
creator="$project_root/.runtime/cocos/CocosCreator.app/Contents/MacOS/CocosCreator"
if [ ! -x "$creator" ]; then echo 'Cocos Creator is missing. Run bash tools/setup-cocos.sh'; exit 1; fi
if [ ! -f "$project_root/client/assets/resources/mir/manifest.json" ]; then echo 'Converted assets are missing. See docs/asset-sources.md'; exit 1; fi
mkdir -p "$project_root/.runtime"
"$project_root/.runtime/assets-venv/bin/python" "$project_root/tools/export-web-ui.py" > "$project_root/.runtime/web-ui-export.log"
"$project_root/.runtime/assets-venv/bin/python" "$project_root/tools/convert-healing.py"
mkdir -p "$project_root/.runtime"
set +e
"$creator" --project "$project_root/client" --build "platform=web-desktop;debug=true;buildPath=$project_root/build;outputName=web;startScene=ea09c8cd-f268-493a-9be4-f45b2f2d893b" > "$project_root/.runtime/build-web.log" 2>&1
build_exit=$?
set -e
# Creator documents exit 36 as successful command-line build.
if [ "$build_exit" -ne 36 ] && [ "$build_exit" -ne 0 ]; then tail -60 "$project_root/.runtime/build-web.log";exit "$build_exit";fi
if [ ! -f "$project_root/build/web/index.html" ]; then echo 'Build did not create index.html';exit 1;fi
"$project_root/.runtime/assets-venv/bin/python" "$project_root/tools/export-auth-assets.py"
node "$project_root/tools/prepare-web.mjs"
echo "Web build ready: $project_root/build/web"
