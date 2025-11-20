#!/bin/bash

echo "🚀 Pushing Moonpay changes to GitHub..."
echo ""

git add src/bot/menus.ts src/bot/commandsNew.ts

echo "✅ Files staged"
echo ""

git commit -m "Add Moonpay integration with disclaimer for buying SOL and USDC"

echo "✅ Changes committed"
echo ""

echo "📤 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Push complete! Check Railway for deployment."
