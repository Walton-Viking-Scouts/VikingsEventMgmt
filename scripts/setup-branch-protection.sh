

#!/bin/bash

# GitHub Branch Protection Setup Script
# Run this script to configure branch protection rules for all Viking Event Management repositories
# Requires: GitHub CLI (gh) installed and authenticated with admin permissions

set -e

echo "🛡️  Setting up GitHub branch protection rules for Viking Event Management repositories..."

# Repository list
REPOS=(
    "Walton-Viking-Scouts/VikingsEventMgmt"    # React mobile frontend
    "Walton-Viking-Scouts/VikingsEventMgmtAPI" # Backend API
)

# Function to set up branch protection for a repository
setup_branch_protection() {
    local repo=$1
    echo "📋 Setting up branch protection for $repo..."
    
    # Enable branch protection with comprehensive rules
    gh api "repos/$repo/branches/main/protection" \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["build","test","lint"]}' \
        --field enforce_admins=true \
        --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"require_last_push_approval":false}' \
        --field restrictions=null \
        --field required_linear_history=false \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        --field block_creations=false \
        --field required_conversation_resolution=true
        
    echo "✅ Branch protection enabled for $repo"
}

# Check if GitHub CLI is installed and authenticated
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "   https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI is not authenticated. Please run 'gh auth login' first."
    exit 1
fi

# Setup branch protection for each repository
for repo in "${REPOS[@]}"; do
    echo ""
    setup_branch_protection "$repo"
done

echo ""
echo "🎉 Branch protection setup complete!"
echo ""
echo "📝 Branch protection rules applied:"
echo "   ✅ Require pull request before merging (1 approval required)"
echo "   ✅ Dismiss stale reviews when new commits are pushed"
echo "   ✅ Require status checks: build, test, lint"
echo "   ✅ Require branches to be up to date before merging"
echo "   ✅ Require conversation resolution before merging"
echo "   ✅ Include administrators (rules apply to admins)"
echo "   ✅ Block force pushes and deletions"
echo ""
echo "⚠️  Note: Status checks (build, test, lint) will only activate when CI/CD workflows are present"
echo "    in each repository. Ensure your GitHub Actions or other CI systems use these job names."