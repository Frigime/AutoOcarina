#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

export PICO_SDK_PATH="${PICO_SDK_PATH:-$HOME/.pico-sdk/sdk/2.2.0}"
export PICO_TOOLCHAIN_PATH="${PICO_TOOLCHAIN_PATH:-$HOME/.pico-sdk/toolchain/14_2_Rel1}"
export PATH="$PICO_TOOLCHAIN_PATH/bin:$PATH"
TOOLS=(-Dpicotool_DIR="$HOME/.pico-sdk/picotool/2.1.1/picotool" -Dpioasm_DIR="$HOME/.pico-sdk/tools/2.2.0/pioasm" -DOCARINA_CYW43_LED=ON)

BOARDS=(
  "rp2040_zero:waveshare_rp2040_zero"
  "pico:pico"
  "pico_w:pico_w"
  "pico2:pico2"
  "pico2_w:pico2_w"
  "xiao_rp2040:seeed_xiao_rp2040"
  "xiao_rp2350:seeed_xiao_rp2350"
  "rp2350_zero:waveshare_rp2350_zero"
)
OUT=../web/public/firmware
mkdir -p "$OUT"

for entry in "${BOARDS[@]}"; do
  name="${entry%%:*}"
  board="${entry##*:}"
  [ $# -gt 0 ] && [ "$1" != "$name" ] && continue
  echo "=== $name ($board)"
  cmake -S . -B "build/$name" -G Ninja -DCMAKE_BUILD_TYPE=Release -DPICO_BOARD="$board" "${TOOLS[@]}" > /dev/null
  cmake --build "build/$name" > /dev/null
  cp "build/$name/autoocarina.uf2" "$OUT/autoocarina_$name.uf2"
  echo "OK : $OUT/autoocarina_$name.uf2"
done
