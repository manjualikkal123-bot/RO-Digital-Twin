#!/bin/bash
# RO Digital Twin - First Time Setup for Mac
# Double-click this file ONCE to install everything

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================"
echo "  RO Digital Twin - Installing... Please wait"
echo "================================================"
echo ""

echo "Step 1/3 - Installing Python packages..."
pip3 install -r requirements.txt
echo "Done!"
echo ""

echo "Step 2/3 - Installing Backend packages..."
npm install
echo "Done!"
echo ""

echo "Step 3/3 - Installing Frontend packages..."
cd frontend
npm install
cd ..
echo "Done!"
echo ""

echo "================================================"
echo "  Installation Complete!"
echo "  Now double-click start_mac.command to run app"
echo "================================================"
read -p "Press Enter to close..."
