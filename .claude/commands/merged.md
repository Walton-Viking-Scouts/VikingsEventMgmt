Sync local version with latest git tag after PR merge.

Run this after merging a PR on GitHub to ensure local package.json matches the actual deployed version.

Steps:

1. Pull latest changes from main branch
2. Get the current git tag version  
3. Update package.json to match git tag
4. Verify synchronization

```bash
git checkout main && git pull origin main
git fetch --tags
LATEST_TAG=$(git tag --sort=-version:refname | head -1)
CLEAN_VERSION=${LATEST_TAG#v}
npm version $CLEAN_VERSION --no-git-tag-version --allow-same-version
echo "✅ Synced package.json to $LATEST_TAG"