#!/bin/bash

# Railway Database Setup Script Runner
# This script installs Railway CLI and runs the database setup

echo "=========================================="
echo "Railway Database Setup"
echo "=========================================="
echo ""

# Step 1: Install Railway CLI
echo "📦 Installing Railway CLI..."
npm install -g @railway/cli

echo ""
echo "✅ Railway CLI installed!"
echo ""

# Step 2: Instructions for login
echo "=========================================="
echo "⚠️  MANUAL STEPS REQUIRED:"
echo "=========================================="
echo ""
echo "1. Run: railway login"
echo "   (This will open a browser - approve the login)"
echo ""
echo "2. Run: railway link"
echo "   (Select your Zinochain Bot project)"
echo ""
echo "3. Run: railway run psql < railway-db-setup.sql"
echo "   (This creates all database tables)"
echo ""
echo "=========================================="
echo ""
echo "Or run all at once after login+link:"
echo ""
echo "railway run psql < railway-db-setup.sql"
echo ""
echo "=========================================="
