# CodeRabbit Review Implementation

Systematically review and implement CodeRabbit PR comments with proper prioritization and risk assessment.

## Usage
`/coderabbit [PR_NUMBER]` - Review and implement CodeRabbit comments for the specified PR

## Steps

### 1. Access CodeRabbit Comments
Use the GitHub API to fetch all CodeRabbit comments from the PR:

```bash
gh api repos/:owner/:repo/pulls/PR_NUMBER/reviews \
  --jq '.[] | select(.user.login == "coderabbitai") | {id: .id, state: .state, body: .body}'
```

Also fetch line-specific comments:
```bash
gh api repos/:owner/:repo/pulls/PR_NUMBER/comments \
  --jq '.[] | select(.user.login == "coderabbitai") | {file: .path, line: .line, body: .body, outdated: .outdated}'
```

### 2. Filter Out Outdated Comments
- **CRITICAL**: Check the `outdated` field in API responses
- Skip any comments marked as `"outdated": true`
- These represent code that has since been modified/fixed
- Only process current, relevant feedback

### 3. Categorize Comments by Severity

#### 🔴 **Actionable Comments** (IMPLEMENT IMMEDIATELY):
- **Security vulnerabilities**: SQL injection, XSS risks, exposed secrets
- **Bug fixes**: Logic errors, null pointer risks, async race conditions
- **Breaking changes**: API compatibility issues, missing error handling
- **Critical performance**: Memory leaks, blocking operations
- **Test failures**: Missing coverage, incorrect assertions

#### 🟡 **Nitpick Comments** (ASSESS BEFORE IMPLEMENTING):
- **Code style**: Formatting, naming conventions, documentation
- **Best practices**: DRY violations, type safety improvements
- **Non-critical performance**: Minor optimizations
- **Code organization**: File structure, import patterns

### 4. Implementation Strategy

#### For Actionable Comments:
1. **Implement immediately** unless there's a major technical concern
2. **Document any concerns** and explain why a fix can't be applied
3. **Test thoroughly** after each fix to ensure no regressions

#### For Nitpick Comments:
1. **Group by category** (style, documentation, performance, etc.)
2. **Assess each group**:
   - **Necessity**: Does this improve code quality significantly?
   - **Cost**: How much time/effort to implement?
   - **Risk**: Could this introduce bugs or break functionality?
3. **Ask user for approval** before implementing nitpick categories
4. **Prioritize**: Security/consistency fixes first, cosmetic changes last

### 5. Quality Assurance Process

#### Before Any Commits:
```bash
# REQUIRED: Run all quality checks
npm run lint            # Fix all linting issues
npm run test:run        # Ensure tests pass
npm run build           # Verify build succeeds
```

#### Implementation Order:
1. **Security fixes** (highest priority)
2. **Bug fixes** and logic errors
3. **Performance improvements** (critical ones)
4. **Code consistency** (constants, patterns)
5. **Documentation** and comments (if approved)
6. **Style/formatting** (lowest priority)

### 6. Commit Strategy

#### Single Commit Approach (Recommended):
- **DO NOT commit** until ALL approved changes are complete
- Group all fixes into a single, comprehensive commit
- Use descriptive commit message with categories:

```bash
git commit -m "fix: address CodeRabbit feedback - security and quality improvements

Security:
- Add input validation for API parameters
- Fix SQL injection vulnerability in database queries

Code Quality:
- Use constants instead of magic strings
- Fix nullish coalescing for proper falsy handling
- Add missing error handling in async operations

Style (if approved):
- Remove unnecessary JSX comments
- Fix linting errors (trailing commas, imports)

Addresses CodeRabbit feedback from PR #XXX

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 7. Risk Assessment Framework

#### High Risk (Require User Approval):
- Changes to authentication/authorization logic
- Database schema or query modifications
- API contract changes
- Core business logic alterations

#### Medium Risk (Implement with Caution):
- Performance optimizations with complexity
- Refactoring existing working code
- Dependency updates or imports changes

#### Low Risk (Safe to Implement):
- Formatting and style consistency
- Adding missing constants
- Removing unused code/comments
- URL encoding for security

### 8. User Communication Template

When asking for nitpick approval:

> "I've implemented all actionable CodeRabbit comments (X security fixes, Y bug fixes).
>
> For nitpicks, I found Z categories:
> - **Style/Formatting** (A items): Low risk, improves consistency
> - **Documentation** (B items): Medium effort, improves maintainability
> - **Performance** (C items): Low impact, minor optimizations
>
> Should I implement all categories, specific ones, or skip nitpicks for this release?"

### 9. Error Handling

If any actionable fix fails or causes issues:
1. **Document the failure** in detail
2. **Revert the specific change** if it breaks functionality
3. **Report to user** with explanation and alternative approaches
4. **Continue with remaining fixes** (don't block entire process)

### 10. Final Verification

Before marking complete:
- [ ] All outdated comments filtered out
- [ ] All actionable comments addressed or documented
- [ ] User approval received for implemented nitpicks
- [ ] All quality checks pass (lint, test, build)
- [ ] Single comprehensive commit created
- [ ] PR ready for re-review

## Example API Usage

```bash
# Get PR reviews
gh api repos/Walton-Viking-Scouts/vikings-eventmgmt-mobile/pulls/156/reviews

# Get line comments
gh api repos/Walton-Viking-Scouts/vikings-eventmgmt-mobile/pulls/156/comments

# Filter for CodeRabbit only
gh api repos/Walton-Viking-Scouts/vikings-eventmgmt-mobile/pulls/156/comments \
  --jq '.[] | select(.user.login == "coderabbitai" and .outdated == false)'
```

## Notes

- **Always check for outdated comments** - CodeRabbit updates these as code changes
- **Security fixes are non-negotiable** - implement unless technically impossible
- **User approval required for nitpicks** - don't assume they want every suggestion
- **Single commit approach** prevents messy history and failed intermediate states
- **Quality checks are mandatory** - never commit without passing lint/test/build