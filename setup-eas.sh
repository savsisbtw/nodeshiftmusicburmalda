#!/bin/bash
# EAS Setup for GitHub Actions
# This script helps configure EAS_TOKEN for CI/CD

set -e

echo "🔐 EAS Token Setup for GitHub Actions"
echo "===================================="
echo ""

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g eas-cli
fi

echo "📋 Step 1: Login to EAS"
echo "Open terminal and run: eas login"
echo "Then follow the prompts"
echo ""
read -p "Press Enter when done..."

echo ""
echo "📋 Step 2: Get your EAS token"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    TOKEN_FILE="$HOME/.eas-credentials"
elif [[ "$OSTYPE" == "msys" ]]; then
    # Windows Git Bash
    TOKEN_FILE="$USERPROFILE\.eas-credentials"
else
    # Linux
    TOKEN_FILE="$HOME/.eas-credentials"
fi

if [ -f "$TOKEN_FILE" ]; then
    echo "✓ Found credentials at: $TOKEN_FILE"
    echo ""
    echo "Your EAS token:"
    echo "================================"
    cat "$TOKEN_FILE" | grep -o '"access_token":"[^"]*"' | head -1
    echo "================================"
    echo ""
    echo "📋 Copy the access_token value (between quotes)"
else
    echo "❌ Credentials file not found at: $TOKEN_FILE"
    echo "Make sure you ran: eas login"
    exit 1
fi

echo ""
echo "📋 Step 3: Add to GitHub Secrets"
echo ""
echo "1. Go to: https://github.com/YOUR_USERNAME/nodeshiftmusicburmalda/settings/secrets/actions"
echo "2. Click 'New repository secret'"
echo "3. Name: EAS_TOKEN"
echo "4. Paste your token value"
echo "5. Click 'Add secret'"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. git add ."
echo "2. git commit -m 'Setup GitHub Actions'"
echo "3. git push origin main"
echo ""
echo "Your app will automatically build on EAS!"
