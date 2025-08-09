#!/bin/bash

# Release Management Script for Vikings Event Management Mobile
# Usage: ./scripts/release.sh [patch|minor|major]

set -e  # Exit on any error

RELEASE_TYPE=${1:-patch}
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "🚀 Starting release process..."
echo "📦 Current version: $CURRENT_VERSION"
echo "🔄 Release type: $RELEASE_TYPE"

# 1. Run tests first
echo "🧪 Running tests..."
npm run test:run
npm run lint

# 2. Bump version
echo "📈 Bumping version ($RELEASE_TYPE)..."
npm run version:$RELEASE_TYPE
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ New version: $NEW_VERSION"

# 3. Build application
echo "🔨 Building application..."
npm run build

# 4. Upload source maps and create Sentry release
echo "📤 Creating Sentry release: vikings-eventmgmt-mobile@$NEW_VERSION..."
npm run sentry:sourcemaps
npm run release:create

# 5. Commit version bump
echo "💾 Committing version bump..."
git add package.json package-lock.json
git commit -m "chore: bump version to v$NEW_VERSION

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 6. Create git tag
echo "🏷️ Creating git tag..."
git tag "v$NEW_VERSION"

# 7. Finalize Sentry release
echo "✅ Finalizing Sentry release..."
npm run release:finalize

echo ""
echo "🎉 Release v$NEW_VERSION created successfully!"
echo "📋 Next steps:"
echo "   1. Push changes: git push origin main --tags"
echo "   2. Create GitHub release from tag"
echo "   3. Deploy to production"
echo "   4. Mark deployment in Sentry: npm run release:deploy"

# Optional: Auto-create GitHub release
read -p "❓ Create GitHub release now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🐙 Creating GitHub release..."
    gh release create "v$NEW_VERSION" \
        --title "Release v$NEW_VERSION" \
        --notes "Release v$NEW_VERSION

## 🔄 Changes
- Version bump to v$NEW_VERSION
- Sentry release tracking enabled

## 🔗 Sentry Release
View in Sentry: https://walton-vikings.de.sentry.io/releases/vikings-eventmgmt-mobile@$NEW_VERSION/

🤖 Generated with [Claude Code](https://claude.ai/code)"
fi