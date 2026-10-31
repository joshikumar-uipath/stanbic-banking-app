#!/usr/bin/env bash
# Convert a bank's PNGs to its JPEG shots (1440 wide, quality 80), then rebuild the guide.
#   ./to-jpeg.sh             capture/png/           → ../shots/            (Stanbic IBTC)
#   ./to-jpeg.sh firstbank   capture/png-firstbank/ → ../firstbank/shots/  (FirstBank)
# The PNGs are removed afterwards: public/ ships with the app build, and only the JPEGs are needed.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BANK="${1:-stanbic}"
if [ "$BANK" = stanbic ]; then PNG="$HERE/png"; SHOTS="$HERE/../shots"; else PNG="$HERE/png-$BANK"; SHOTS="$HERE/../$BANK/shots"; fi
mkdir -p "$SHOTS"
for f in "$PNG"/*.png; do
  [ -e "$f" ] || { echo "no PNGs in $PNG"; exit 1; }
  out="$SHOTS/$(basename "${f%.png}").jpg"
  if command -v magick >/dev/null; then magick "$f" -resize '1440x>' -quality 80 "$out"
  else sips -s format jpeg -s formatOptions 80 --resampleWidth 1440 "$f" --out "$out" >/dev/null; fi
done
rm -rf "$PNG"
python3 "$HERE/../build.py"
