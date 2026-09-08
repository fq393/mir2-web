#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -x "$ROOT/.runtime/dotnet/dotnet" ]; then "$ROOT/.runtime/dotnet/dotnet" --version; exit 0; fi
mkdir -p "$ROOT/.runtime/dotnet"
bash "$ROOT/server/dotnet-install.upstream.sh" --version 8.0.414 --install-dir "$ROOT/.runtime/dotnet" --no-path --azure-feed https://dotnetcli.azureedge.net/dotnet
