# Contributing to Agent Task CLI

Thanks for your interest in contributing to Agent Task CLI! This document provides guidelines for contributing.

## Code of Conduct

Please participate in a friendly and respectful manner. Report any abusive behavior to the maintainers.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/agent-task-cli.git`
3. Install dependencies: `npm install`
4. Run tests: `npm test`
5. Start development: `npm run dev`

## Pull Request Process

1. Create a feature branch from `main`: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Add tests for new functionality
5. Update documentation as needed
6. Commit your changes: `git commit -m "feat: add your feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Submit a pull request

## Guidelines

### Code Style

- Use ESLint: `npm run lint`
- Format code with Prettier: `npm run format`
- Follow the existing code style and patterns

### Testing

- Write comprehensive tests for new features
- Ensure 100% test coverage for new code
- Run the full test suite before submitting PRs
- Include both positive and negative test cases

### Documentation

- Update README.md for new user-facing features
- Update API reference for new APIs
- Include examples in documentation
- Keep changelog updated

### Commit Messages

Use conventional commits format:
- `feat:` for new features
- `fix:` for bug fixes  
- `docs:` for documentation changes
- `test:` for test changes
- `chore:` for other changes

### Pull Request Template

```markdown
## Description
Brief description of changes

## Changes Made
- List of changes made
- Related issues if any

## Testing
- Tests added/modified
- How to test the changes

## Checklist
- [ ] Tests pass
- [ ] Lint passes
- [ ] Documentation updated
- [ ] Changelog updated
```

## Reporting Issues

When reporting bugs, please include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Environment details (Node.js version, OS, etc.)
5. Error messages if any

## Feature Requests

We welcome feature requests! Please create an issue with:
1. Problem statement
2. Proposed solution
3. Use cases
4. Implementation ideas (if any)

## Getting Help

- Check the [documentation](./docs/TUTORIAL.md)
- Look through existing [issues](https://github.com/robertsong2019/agent-task-cli/issues)
- Join discussions in pull requests

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.