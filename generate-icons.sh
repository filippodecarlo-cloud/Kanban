#!/bin/bash

# Script to generate PWA icons from icon.png
# Requires ImageMagick or Python PIL

if [ ! -f "icon.png" ]; then
    echo "❌ Error: icon.png not found in current directory"
    echo ""
    echo "Please add your icon.png file to this directory with these specs:"
    echo "  - Format: PNG"
    echo "  - Minimum size: 512x512 pixels (square)"
    echo "  - Transparent or solid background"
    echo ""
    echo "Then run this script again: ./generate-icons.sh"
    exit 1
fi

echo "🎨 Generating PWA icons from icon.png..."

# Check if ImageMagick is installed
if command -v convert &> /dev/null; then
    echo "📱 Using ImageMagick to generate icons..."

    # Generate 192x192 icon
    echo "  → Generating 192x192 icon..."
    convert icon.png -resize 192x192 public/icon-192.png

    # Generate 512x512 icon
    echo "  → Generating 512x512 icon..."
    convert icon.png -resize 512x512 public/icon-512.png

    # Copy original as fallback
    cp icon.png public/icon.png

    echo "✅ Icons generated successfully with ImageMagick!"

elif command -v python3 &> /dev/null; then
    echo "📱 Using Python PIL to generate icons..."

    python3 << 'PYTHON'
from PIL import Image
import sys

try:
    # Open original image
    img = Image.open('icon.png')

    # Generate 192x192
    img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
    img_192.save('public/icon-192.png', 'PNG')
    print('  → Generated 192x192 icon')

    # Generate 512x512
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_512.save('public/icon-512.png', 'PNG')
    print('  → Generated 512x512 icon')

    # Copy original
    img.save('public/icon.png', 'PNG')
    print('  → Copied original icon')

except ImportError:
    print('❌ PIL/Pillow not installed. Install with: pip install Pillow')
    sys.exit(1)
except Exception as e:
    print(f'❌ Error: {e}')
    sys.exit(1)
PYTHON

    if [ $? -eq 0 ]; then
        echo "✅ Icons generated successfully with Python!"
    else
        echo "❌ Failed to generate icons"
        exit 1
    fi

else
    echo "❌ Neither ImageMagick nor Python found!"
    echo ""
    echo "Install one of these:"
    echo "  - ImageMagick: apt-get install imagemagick"
    echo "  - Python PIL: pip install Pillow"
    exit 1
fi

# Update manifest.json to use PNG instead of SVG
echo ""
echo "📝 Updating manifest.json to use PNG icons..."
sed -i 's/icon-192\.svg/icon-192.png/g' public/manifest.json
sed -i 's/icon-512\.svg/icon-512.png/g' public/manifest.json
sed -i 's/image\/svg+xml/image\/png/g' public/manifest.json

# Update index.html to use PNG
sed -i 's/icon-192\.svg/icon-192.png/g' index.html
sed -i 's/image\/svg+xml/image\/png/g' index.html

echo ""
echo "✅ All done! Generated files:"
echo "  - public/icon-192.png (192x192)"
echo "  - public/icon-512.png (512x512)"
echo "  - public/icon.png (original)"
echo ""
echo "Next steps:"
echo "  1. Review the generated icons"
echo "  2. git add public/icon-*.png"
echo "  3. git commit -m 'Add custom app icons'"
echo "  4. git push"
echo ""
echo "🎉 Your custom icon will appear when users install the app!"
