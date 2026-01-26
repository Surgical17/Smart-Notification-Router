#!/bin/bash
# Test build script - runs TypeScript check before building

echo "🔍 Running TypeScript type check..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found!"
    exit 1
fi

echo "✅ TypeScript check passed!"
echo ""
echo "🏗️  Running Next.js build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
