#!/bin/bash
# Builds the zip for extensions.gnome.org into dist/.
cd "$(dirname "$0")/.." || exit 1
mkdir -p dist
gnome-extensions pack pixel-life@garfieldttt.github.io --extra-source=engine --force --out-dir=dist
