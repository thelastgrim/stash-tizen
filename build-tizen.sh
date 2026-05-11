#!/bin/bash
set -e

PROFILE="${1:-tlg}"
TV_IP="${2:-}"

echo "→ Building React app..."
npm run build

echo "→ Staging Tizen assets..."
cp tizen/config.xml dist/
cp tizen/icon.png dist/

echo "→ Packaging .wgt with profile '$PROFILE'..."
tizen package -t wgt -s "$PROFILE" -- ./dist

WGT=$(ls dist/*.wgt | head -1)
echo "✓ Built: $WGT"

if [ -n "$TV_IP" ]; then
  echo "→ Connecting to $TV_IP..."
  sdb connect "$TV_IP:26101"
  DEVICE=$(sdb devices | tail -n +2 | head -1 | awk '{print $1}')
  echo "→ Installing on $DEVICE..."
  tizen install -n "$WGT" -t "$DEVICE"
  echo "✓ Installed. Launch from TV Apps grid."
fi

echo ""
read -p "Press Enter to close..."