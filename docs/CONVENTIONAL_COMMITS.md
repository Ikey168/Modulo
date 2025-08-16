# Conventional Commits Guide

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification to automatically generate changelogs and version bumps.

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

## Scopes

Common scopes for this project:
- **frontend**: Changes to the React frontend
- **backend**: Changes to the Spring Boot backend
- **database**: Database schema or migration changes
- **docker**: Docker-related changes
- **k8s**: Kubernetes-related changes
- **auth**: Authentication-related changes
- **blockchain**: Blockchain integration changes
- **search**: Search functionality changes
- **websocket**: Real-time features changes

## Examples

### Features
```
feat(auth): add MetaMask authentication support

Implement MetaMask wallet connection and authentication
- Add MetaMask service for wallet interactions
- Update auth store to handle wallet credentials
- Add wallet info component for UI
```

### Bug Fixes
```
fix(websocket): resolve connection timeout issues

Fix WebSocket connection stability by implementing
proper reconnection logic and heartbeat mechanism
```

### Breaking Changes
```
feat(api)!: change note API response format

BREAKING CHANGE: The note API now returns notes in a different format.
Migration guide available in docs/api-migration.md
```

### Documentation
```
docs: update README with new deployment instructions

Add section about Docker Compose setup and
environment variable configuration
```

## Automatic Versioning

- **fix**: patch version bump (1.0.0 → 1.0.1)
- **feat**: minor version bump (1.0.0 → 1.1.0)
- **BREAKING CHANGE**: major version bump (1.0.0 → 2.0.0)

## Release Process

1. Make changes following conventional commits
2. Create PR to main branch
3. After merge, release-please will automatically:
   - Create a release PR with updated changelog
   - Bump version numbers
   - Create GitHub release with artifacts
   - Attach JAR files and Docker image digests

## Tools

- **commitlint**: Validates commit messages
- **husky**: Git hooks for commit message validation
- **release-please**: Automated releases and changelog generation
