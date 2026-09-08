#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export MIR2_ROOT="$ROOT"
export DOTNET_ROOT="$ROOT/.runtime/dotnet"
export DOTNET_CLI_HOME="$ROOT/.runtime/dotnet/home"
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_GENERATE_ASPNET_CERTIFICATE=false
export ASPNETCORE_ENVIRONMENT=Development
export NUGET_PACKAGES="$ROOT/.runtime/dotnet/packages"
CRYSTAL_COMMIT=0e315fe327192afe52c3d7357ddd1f5b7e26c5b8
if [ ! -d "$ROOT/vendor/Crystal/.git" ]; then
  mkdir -p "$ROOT/vendor/Crystal"
  git -C "$ROOT/vendor/Crystal" init
  git -C "$ROOT/vendor/Crystal" remote add origin https://github.com/Suprcode/Crystal.git
  git -C "$ROOT/vendor/Crystal" fetch --depth 1 origin "$CRYSTAL_COMMIT"
  git -C "$ROOT/vendor/Crystal" checkout --detach FETCH_HEAD
fi
if [ "$(git -C "$ROOT/vendor/Crystal" rev-parse HEAD)" != "$CRYSTAL_COMMIT" ]; then
  echo "Crystal commit differs from tested pin $CRYSTAL_COMMIT; refusing to run unknown protocol." >&2
  exit 1
fi
if [ -n "$(git -C "$ROOT/vendor/Crystal" status --porcelain --untracked-files=no)" ]; then
  echo "Crystal tracked source has local changes; refusing to run modified upstream core." >&2
  exit 1
fi
[ -x "$DOTNET_ROOT/dotnet" ] || bash "$ROOT/tools/setup-dotnet.sh"
exec "$DOTNET_ROOT/dotnet" run --project "$ROOT/server/Mir2.Headless.csproj" --no-launch-profile
