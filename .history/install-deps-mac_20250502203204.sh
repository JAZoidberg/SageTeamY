#!/bin/bash
set -e
echo "Installing system dependencies for macOS..."
brew install pkg-config cairo pango jpeg giflib

echo "Checking for binding.gyp..."
BINDING_GYP="binding.gyp"
MODULE_NAME="sage"
SRC_FILE="src/sage.ts"

if [ ! -f "$BINDING_GYP" ]; then
    echo "Creating missing binding.gyp..."
    cat <<EOF > $BINDING_GYP
{
  "targets": [
    {
      "target_name": "$MODULE_NAME",
<<<<<<< HEAD

      "sources": ["$SRC_FILE"]
=======
      "sources": ["$SRC_FILE"],
>>>>>>> 1c0d10eab4981bb2ff421a64acc77f0afac0a43f
    }
  ]
}
EOF
    echo "binding.gyp created successfully."
<<<<<<< HEAD

fi

=======
fi
>>>>>>> 1c0d10eab4981bb2ff421a64acc77f0afac0a43f
