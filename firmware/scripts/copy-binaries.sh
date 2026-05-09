#!/usr/bin/env bash
# Copy locally-built PlatformIO firmware images into the web app's public dir
# so the in-browser installer can fetch them.
#
# Usage:
#   firmware/scripts/copy-binaries.sh [env...]
# Examples:
#   firmware/scripts/copy-binaries.sh                  # copies wemos_d1_mini
#   firmware/scripts/copy-binaries.sh wemos_d1_mini esp32_cyd
#
# The script deliberately uses simple, portable bash so a Windows user can run
# it under WSL or Git Bash.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FW_ROOT="${REPO_ROOT}/firmware/aquaponics-node"
WEB_PUBLIC="${REPO_ROOT}/apps/web/public/firmware"

if [[ "$#" -eq 0 ]]; then
  ENVS=("wemos_d1_mini")
else
  ENVS=("$@")
fi

for env in "${ENVS[@]}"; do
  src="${FW_ROOT}/.pio/build/${env}/firmware.bin"
  if [[ ! -f "${src}" ]]; then
    echo "error: ${src} not found. Run 'pio run -e ${env}' in firmware/aquaponics-node first." >&2
    exit 1
  fi

  # Public folder uses dashes (matches the URL path used by the installer).
  dst_dir="${WEB_PUBLIC}/${env//_/-}"
  mkdir -p "${dst_dir}"
  cp "${src}" "${dst_dir}/firmware.bin"
  echo "copied ${src} -> ${dst_dir}/firmware.bin"
done
