# Release Workflow Test

This file is used to test the release workflow and conventional commits.

## Test Scenarios

### Version Bumping
- **fix**: Should bump patch version (1.0.0 → 1.0.1)
- **feat**: Should bump minor version (1.0.0 → 1.1.0)  
- **BREAKING CHANGE**: Should bump major version (1.0.0 → 2.0.0)

### Artifacts
The release should include:
- ✅ Backend JAR file
- ✅ Backend JAR SBOM (CycloneDX format)
- ✅ Backend Docker image SBOM
- ✅ Frontend Docker image SBOM
- ✅ Docker image digests
- ✅ Auto-generated CHANGELOG.md

### Workflow Steps
1. Push conventional commit to main
2. Release-please creates release PR
3. Merge release PR
4. GitHub release is created automatically
5. Artifacts are built and attached
6. Version numbers are bumped in all files

## Testing Commands

```bash
# Test conventional commit
git commit -m "feat(release): implement automated versioning and releases"

# Test fix commit  
git commit -m "fix(ci): resolve release workflow artifact upload"

# Test breaking change
git commit -m "feat(api)!: restructure note API response format

BREAKING CHANGE: The note API now returns notes in a different format"
```
