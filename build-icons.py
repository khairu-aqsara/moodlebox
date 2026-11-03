#!/usr/bin/env python3
"""
Build the platform icons from build/icon-source.png:
icon.icns (macOS, 16 to 1024 px), icon.ico (Windows, 16 to 256 px) and icon.png (Linux, 512 px).
Requires: pip install Pillow
Usage: python3 build-icons.py [output-dir]   (default: build)
"""

import sys
from pathlib import Path

from PIL import Image

out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("build")
out.mkdir(parents=True, exist_ok=True)

source = Image.open("build/icon-source.png").convert("RGBA")

source.save(out / "icon.icns")
source.save(out / "icon.ico", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
source.resize((512, 512), Image.LANCZOS).save(out / "icon.png")

print(f"✅ Icons saved to {out}/: icon.icns, icon.ico, icon.png")
