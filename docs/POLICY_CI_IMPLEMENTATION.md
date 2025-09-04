# Policy CI Gate Implementation

This document describes the implementation of the Policy CI Gate for automated validation of OPA (Open Policy Agent) policies in the Modulo platform.

## 🎯 Overview

The Policy CI Gate provides comprehensive automated validation of policy files through:
- **Syntax validation** - Ensures all Rego policies are syntactically correct
- **Test execution** - Runs all policy tests with coverage reporting
- **Security scanning** - Checks for potential security issues in policies
- **Bundle building** - Validates that policies can be built into deployable bundles
- **Change analysis** - Analyzes policy changes in pull requests

## 🔧 Implementation Details

### GitHub Actions Workflow

The Policy CI Gate is implemented as a GitHub Actions workflow (`.github/workflows/policy-ci.yml`) that:

1. **Triggers on**:
   - Pull requests affecting policy files (`policy/**`, `infra/opa/**`)
   - Pushes to main branch
   - Changes to the CI workflow itself

2. **Key Features**:
   - **Binary Caching**: Caches OPA and Conftest binaries for faster execution
   - **Parallel Validation**: Runs multiple validation steps concurrently
   - **Comprehensive Testing**: Executes both unit tests and integration validation
   - **Artifact Upload**: Preserves test results, coverage reports, and built bundles

### Validation Steps

#### 1. Policy Formatting
```bash
opa fmt --write policy/
```
- Automatically formats all Rego files
- Fails if formatting changes are needed

#### 2. Syntax Validation
```bash
opa parse policy/
```
- Validates all policy files for syntax errors
- Ensures policies can be loaded by OPA

#### 3. Test Execution
```bash
opa test policy/ --verbose
```
- Runs all test cases in policy directory
- Generates JSON and JUnit formatted results

#### 4. Coverage Analysis
```bash
opa test policy/ --coverage --format=json
```
- Measures test coverage for all policies
- Enforces minimum 80% coverage threshold

#### 5. Bundle Building
```bash
opa build policy/ -o dist/bundles/authorization-bundle.tar.gz
```
- Creates deployable policy bundles
- Validates bundle integrity

#### 6. Security Scanning
- Scans for hardcoded credentials or sensitive data
- Reviews policy rules for overly permissive patterns
- Uses pattern matching for common security issues

#### 7. Infrastructure Validation
- Uses Conftest for infrastructure policy validation
- Validates Docker Compose and Kubernetes manifests
- Provides extensible policy framework

### Makefile Integration

The implementation includes Makefile targets for local development:

```bash
# Run complete policy CI validation
make policy-ci

# Individual validation steps
make policy-test        # Run tests
make policy-fmt         # Format files
make policy-lint        # Check formatting
make policy-coverage    # Generate coverage
make policy-build       # Build bundles
make policy-validate    # Syntax validation
make policy-security-scan # Security checks
```

## 📊 Test Results and Reporting

### JUnit Integration
- Converts OPA test results to JUnit XML format
- Integrates with GitHub's test reporting UI
- Provides detailed failure information

### Coverage Reporting
- Generates coverage reports in JSON format
- Enforces minimum coverage thresholds
- Tracks coverage trends over time

### PR Comments
Automatically comments on pull requests with:
- Test execution summary
- Coverage percentage
- Built bundle information
- Security scan results
- Overall status

### Status Checks
Creates GitHub status checks for:
- `ci/policy-gate` - Overall policy validation status
- Individual step statuses for detailed feedback

## 🚀 Usage

### For Developers

1. **Local Validation**:
   ```bash
   make policy-ci
   ```

2. **Individual Checks**:
   ```bash
   make policy-test        # Run tests only
   make policy-coverage    # Check coverage
   make policy-fmt         # Format files
   ```

3. **Pre-commit Hook** (recommended):
   ```bash
   #!/bin/sh
   make policy-fmt policy-test
   ```

### For CI/CD Pipeline

The workflow automatically triggers on:
- Pull requests modifying policy files
- Pushes to main branch
- Manual workflow dispatch

### Policy Change Analysis

For pull requests, the workflow includes a separate job that:
- Compares policies against the base branch
- Generates diff reports showing changes
- Uploads change analysis as artifacts

## 🔧 Configuration

### Environment Variables
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- Custom OPA/Conftest versions can be set in workflow variables

### Thresholds
- **Coverage Threshold**: 80% (configurable in workflow)
- **Test Timeout**: 10 minutes per job
- **Artifact Retention**: 30 days

### Binary Versions
- **OPA**: v0.58.0 (latest stable)
- **Conftest**: v0.46.0 (latest stable)

## 📈 Benefits

1. **Quality Assurance**: Ensures all policies meet quality standards
2. **Security**: Automated scanning for security vulnerabilities
3. **Consistency**: Enforces consistent formatting and structure
4. **Reliability**: Comprehensive testing before deployment
5. **Visibility**: Clear reporting on policy health and changes
6. **Performance**: Efficient caching reduces CI execution time

## 🛠️ Maintenance

### Updating Dependencies
1. Update OPA version in workflow file
2. Update Conftest version if needed
3. Test locally with `make install-policy-ci`

### Adding New Validation Rules
1. Extend security scan patterns in workflow
2. Add new Conftest policies for infrastructure
3. Update coverage thresholds as needed

### Troubleshooting
- Check workflow logs for detailed error messages
- Run `make policy-ci` locally to reproduce issues
- Review JUnit test reports for specific failures

## 🔗 Integration Points

- **Main CI Pipeline**: Status checks block merging on failure
- **OPA Deployment**: Built bundles used in production deployments  
- **Security Pipeline**: Results feed into security reporting
- **Development Workflow**: Local validation matches CI exactly

## 📚 References

- [Open Policy Agent Documentation](https://www.openpolicyagent.org/docs/)
- [Conftest Documentation](https://www.conftest.dev/)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [OPA Rego Language Guide](https://www.openpolicyagent.org/docs/latest/policy-language/)
