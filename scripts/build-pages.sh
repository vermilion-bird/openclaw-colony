#!/bin/bash

# Build script for GitHub Pages static export

set -e

# Backup original config
if [ -f "next.config.ts" ]; then
  cp next.config.ts next.config.ts.bak
fi

# Use export config
cp next.config.pages.ts next.config.ts

# Build static export
npm run build

# Restore original config
if [ -f "next.config.ts.bak" ]; then
  mv next.config.ts.bak next.config.ts
fi

echo "Static export completed. Output in ./out directory"