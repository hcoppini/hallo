#!/bin/bash
# ==============================================================================
# Halloween Party NFC Bridge for macOS
# Starts the ACR122U NFC Reader bridge on macOS.
# ==============================================================================

set -e
cd "$(dirname "$0")"

echo "--------------------------------------------------"
echo " Halloween Party - macOS ACR122U NFC Bridge"
echo "--------------------------------------------------"

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed."
    echo "Please install Python 3 (e.g. from python.org or 'brew install python')."
    exit 1
fi

echo "📦 Checking required dependencies (pyscard, websockets)..."
python3 -m pip install pyscard websockets --quiet

echo "🚀 Starting NFC Bridge..."
exec python3 nfc_bridge.py
