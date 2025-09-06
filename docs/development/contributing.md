---
title: "Contributing Guidelines"
description: "Guidelines for contributing to Vikings Event Management"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["contributing", "development", "guidelines", "process"]
related_docs: ["../getting-started/development-workflow.md", "testing-strategy.md"]
---

# Contributing Guidelines

Guidelines for contributing to the Vikings Event Management project.

## 🤝 Welcome Contributors

We welcome contributions from developers of all skill levels! Whether you're fixing bugs, adding features, improving documentation, or helping with testing, your contributions are valuable.

## 🚀 Getting Started

### Prerequisites
1. **Read the documentation**: Familiarize yourself with the project
2. **Set up development environment**: Follow [Installation Guide](../getting-started/installation.md)
3. **Understand the workflow**: Review [Development Workflow](../getting-started/development-workflow.md)
4. **Join the community**: Connect with other contributors

### First Contribution
1. **Browse issues**: Look for issues labeled `good first issue` or `help wanted`
2. **Start small**: Begin with documentation fixes or minor bug fixes
3. **Ask questions**: Don't hesitate to ask for help or clarification
4. **Follow the process**: Use the contribution workflow outlined below

## 📋 Contribution Process

### 1. Issue Creation
Before starting work, create or find an existing issue:

#### Bug Reports
```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- Device: [e.g. iPhone 12, Windows PC]
- Browser: [e.g. Chrome 96, Safari 15]
- App Version: [e.g. 1.1.0]

**Screenshots**
If applicable, add screenshots
```

#### Feature Requests
```markdown
**Feature Description**
Clear description of the proposed feature

**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other solutions you've considered

**Additional Context**
Any other relevant information
```

### 2. Development Workflow

#### Fork and Clone
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/VikingsEventMgmt.git
cd VikingsEventMgmt

# Add upstream remote
git remote add upstream https://github.com/Walton-Viking-Scouts/VikingsEventMgmt.git
```

#### Create Feature Branch
```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

#### Development Process
1. **Make changes**: Implement your feature or fix
2. **Follow code style**: Use existing patterns and conventions
3. **Add tests**: Write tests for new functionality
4. **Update documentation**: Update relevant documentation
5. **Test thoroughly**: Ensure all tests pass

#### Commit Guidelines
```bash
# Use conventional commit format
git commit -m "feat: add notification system"
git commit -m "fix: resolve authentication bug"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for components"
git commit -m "chore: update dependencies"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 3. Pull Request Process

#### Before Submitting
```bash
# Ensure all tests pass
npm run test:run
npm run lint
npm run build

# Update from upstream
git fetch upstream
git rebase upstream/main

# Push to your fork
git push origin feature/your-feature-name
```

#### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Accessibility testing completed

## Screenshots (if applicable)
Add screenshots of UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is commented where necessary
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or clearly documented)
```

#### Review Process
1. **Automated checks**: CI/CD pipeline runs automatically
2. **Code review**: Maintainers review your code
3. **Address feedback**: Make requested changes
4. **Approval**: Once approved, your PR will be merged

## 📝 Code Standards

### TypeScript Guidelines
```typescript
// ✅ Good: Proper typing
interface ComponentProps {
  title: string;
  optional?: boolean;
}

const Component = ({ title, optional = false }: ComponentProps) => {
  return <div>{title}</div>;
};

// ❌ Bad: Using any type
const Component = (props: any) => {
  return <div>{props.title}</div>;
};
```

### React Patterns
```typescript
// ✅ Good: Functional component with hooks
import { useState, useEffect } from 'react';

const Component = () => {
  const [data, setData] = useState<Data[]>([]);
  
  useEffect(() => {
    fetchData().then(setData);
  }, []);

  return <div>{/* JSX */}</div>;
};

export default Component;
```

### File Organization
```
src/
├── components/
│   ├── ui/              # Base UI components
│   ├── forms/           # Form components
│   └── notifications/   # Notification components
├── hooks/               # Custom React hooks
├── contexts/            # React contexts
├── services/            # API and external services
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

### Testing Standards
```typescript
// ✅ Good: Comprehensive test
import { render, screen, fireEvent } from '@testing-library/react';
import Component from './Component';

describe('Component', () => {
  it('renders with correct title', () => {
    render(<Component title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Component onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## 📚 Documentation Standards

### Code Documentation
```typescript
/**
 * Fetches user data from the API
 * @param userId - The unique identifier for the user
 * @param includeProfile - Whether to include profile information
 * @returns Promise resolving to user data
 * @throws {ApiError} When the API request fails
 */
async function fetchUser(
  userId: string, 
  includeProfile: boolean = false
): Promise<User> {
  // Implementation
}
```

### README Updates
- Update relevant README files when adding features
- Include code examples for new functionality
- Update installation instructions if needed
- Add troubleshooting information for common issues

### API Documentation
- Document new API endpoints
- Include request/response examples
- Update OpenAPI specifications
- Add error code documentation

## 🧪 Testing Requirements

### Test Coverage
- **Minimum 80% code coverage** for new code
- **Unit tests** for all new functions and components
- **Integration tests** for API endpoints
- **E2E tests** for critical user journeys

### Testing Checklist
- [ ] Unit tests written and passing
- [ ] Integration tests updated
- [ ] Manual testing completed
- [ ] Accessibility testing performed
- [ ] Mobile testing completed
- [ ] Cross-browser testing done

### Test Commands
```bash
# Run all tests
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- Component.test.tsx

# Run E2E tests
npm run test:e2e
```

## 🔒 Security Guidelines

### Security Considerations
- **Never commit secrets**: Use environment variables
- **Validate inputs**: Sanitize all user inputs
- **Follow OWASP guidelines**: Implement security best practices
- **Review dependencies**: Check for known vulnerabilities

### Security Checklist
- [ ] No hardcoded secrets or API keys
- [ ] Input validation implemented
- [ ] Authentication/authorization checked
- [ ] SQL injection prevention
- [ ] XSS prevention measures
- [ ] CSRF protection in place

## 📱 Mobile Development

### Mobile-Specific Guidelines
- **Test on real devices**: Use physical devices when possible
- **Consider offline functionality**: Ensure features work offline
- **Touch-friendly design**: Optimize for touch interactions
- **Performance optimization**: Minimize battery and data usage

### Capacitor Integration
- **Native features**: Use Capacitor plugins appropriately
- **Platform differences**: Handle iOS/Android differences
- **Permissions**: Request permissions properly
- **Deep linking**: Implement proper URL handling

## 🎨 Design Guidelines

### UI/UX Standards
- **Consistency**: Follow existing design patterns
- **Accessibility**: Ensure WCAG 2.1 AA compliance
- **Responsive design**: Support all screen sizes
- **Performance**: Optimize for fast loading

### Component Design
- **Reusability**: Create reusable components
- **Props interface**: Clear and well-typed props
- **Styling**: Use TailwindCSS classes consistently
- **Documentation**: Include Storybook stories

## 🐛 Bug Fix Guidelines

### Bug Fix Process
1. **Reproduce the bug**: Confirm the issue exists
2. **Identify root cause**: Understand why the bug occurs
3. **Write failing test**: Create test that demonstrates the bug
4. **Fix the issue**: Implement the minimal fix
5. **Verify fix**: Ensure test passes and bug is resolved
6. **Test edge cases**: Check for related issues

### Bug Fix Checklist
- [ ] Bug reproduced and understood
- [ ] Root cause identified
- [ ] Test written to catch the bug
- [ ] Fix implemented
- [ ] All tests passing
- [ ] No regression introduced
- [ ] Documentation updated if needed

## 🚀 Release Process

### Version Management
- **Semantic versioning**: Follow semver (major.minor.patch)
- **Breaking changes**: Clearly document breaking changes
- **Migration guides**: Provide upgrade instructions
- **Release notes**: Document all changes

### Release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Version bumped appropriately
- [ ] Release notes written
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)

## 🤔 Getting Help

### Where to Get Help
- **GitHub Issues**: Ask questions in issues
- **Documentation**: Check existing documentation first
- **Code Review**: Ask for help during PR review
- **Community**: Connect with other contributors

### How to Ask for Help
1. **Search existing issues**: Check if question already answered
2. **Provide context**: Include relevant information
3. **Be specific**: Ask clear, focused questions
4. **Share code**: Include relevant code snippets
5. **Be patient**: Allow time for responses

## 🏆 Recognition

### Contributor Recognition
- **Contributors list**: All contributors are acknowledged
- **Release notes**: Significant contributions highlighted
- **Community**: Active contributors invited to join maintainer team

### Types of Contributions
- **Code**: Bug fixes, features, refactoring
- **Documentation**: Writing, editing, translating
- **Testing**: Manual testing, writing tests
- **Design**: UI/UX improvements, accessibility
- **Community**: Helping others, issue triage

---

*Thank you for contributing to Vikings Event Management! Your efforts help make Scout event management better for everyone.*