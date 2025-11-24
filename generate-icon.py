#!/usr/bin/env python3
"""
Generate MoodleBox icon with orange gradient and black MB text
Requires: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Create 1024x1024 image with gradient
width = height = 1024
image = Image.new('RGB', (width, height))
draw = ImageDraw.Draw(image)

# Moodle orange gradient (light to dark)
light_orange = (255, 136, 0)  # #FF8800
dark_orange = (255, 85, 0)    # #FF5500

# Draw gradient
for y in range(height):
    # Interpolate between light and dark orange
    ratio = y / height
    r = int(light_orange[0] + (dark_orange[0] - light_orange[0]) * ratio)
    g = int(light_orange[1] + (dark_orange[1] - light_orange[1]) * ratio)
    b = int(light_orange[2] + (dark_orange[2] - light_orange[2]) * ratio)
    draw.line([(0, y), (width, y)], fill=(r, g, b))

# Draw "MB" text in black
text = "MB"
# Use a large font size (you may need to adjust the path to a system font)
try:
    # Try different font paths for different systems
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",  # macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
        "C:\\Windows\\Fonts\\arialbd.ttf",  # Windows
    ]
    font = None
    for path in font_paths:
        if os.path.exists(path):
            font = ImageFont.truetype(path, 420)
            break
    if font is None:
        font = ImageFont.load_default()
except:
    font = ImageFont.load_default()

# Get text bbox to center it
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
x = (width - text_width) / 2
y = (height - text_height) / 2 - 40  # Slight adjustment

# Draw text
draw.text((x, y), text, font=font, fill=(0, 0, 0))

# Save as PNG
output_path = "build/icon-source.png"
image.save(output_path, "PNG")
print(f"✅ Icon saved to {output_path}")
print("\nNext steps:")
print("1. Install electron-icon-builder: npm install -g electron-icon-builder")
print("2. Generate icons: electron-icon-builder --input=build/icon-source.png --output=build")
print("3. This will create icon.icns (macOS), icon.ico (Windows), and icon.png (Linux)")
