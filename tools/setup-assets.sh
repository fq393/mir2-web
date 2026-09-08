#!/bin/sh
# Create an isolated Python runtime; no global packages are modified.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ASSET_PYTHON=${ASSET_PYTHON:-python3}
"$ASSET_PYTHON" -c 'import sys; sys.exit("Asset tools require Python 3.10+; set ASSET_PYTHON to a supported interpreter") if sys.version_info < (3, 10) else None'
"$ASSET_PYTHON" -m venv "$ROOT/.runtime/assets-venv"
"$ROOT/.runtime/assets-venv/bin/python" -m pip install --requirement "$ROOT/tools/requirements-assets.txt"
printf '%s\n' "Ready: $ROOT/.runtime/assets-venv/bin/python"
