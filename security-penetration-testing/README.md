# Security Penetration Testing Framework

A comprehensive security penetration testing framework designed to identify and assess security vulnerabilities in web applications and APIs. This framework implements automated security testing based on OWASP guidelines and industry best practices.

## 🛡️ Overview

This security testing framework provides automated penetration testing capabilities covering:

- **OWASP Top 10 2021** - Complete coverage of the most critical web application security risks
- **Injection Vulnerabilities** - SQL, NoSQL, Command, LDAP, XPath, and other injection attacks
- **Authentication Security** - Password policies, session management, JWT security, MFA testing
- **Network Security** - TLS/SSL configuration, security headers, CORS, rate limiting
- **API Security** - REST API authentication, authorization, input validation, error handling
- **Dynamic Application Security Testing (DAST)** - Runtime analysis using browser automation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Target application running (for testing)

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to security testing directory
cd security-penetration-testing

# Install dependencies
npm install

# Install additional security tools (optional)
npm install -g @owasp/zap-api-nodejs
```

### Basic Usage

```bash
# Run all security tests
npm run test:all

# Run specific test suites
npm run test:owasp          # OWASP Top 10 tests
npm run test:injection      # Injection vulnerability tests
npm run test:auth           # Authentication security tests
npm run test:network        # Network security tests
npm run test:api            # API security tests
npm run test:dynamic        # Dynamic application security tests

# Run with custom configuration
node security-test-runner.js --base-url http://your-app.com --api-url http://your-api.com
```

## 📋 Test Suites

### OWASP Top 10 2021 Testing
- **A01 - Broken Access Control**
- **A02 - Cryptographic Failures**
- **A03 - Injection**
- **A04 - Insecure Design**
- **A05 - Security Misconfiguration**
- **A06 - Vulnerable and Outdated Components**
- **A07 - Identification and Authentication Failures**
- **A08 - Software and Data Integrity Failures**
- **A09 - Security Logging and Monitoring Failures**
- **A10 - Server-Side Request Forgery (SSRF)**

### Injection Vulnerability Testing
- SQL Injection (MySQL, PostgreSQL, SQLite)
- NoSQL Injection (MongoDB)
- Command Injection
- LDAP Injection
- XPath Injection
- Template Injection
- Log Injection
- Header Injection

### Authentication Security Testing
- Password security policies
- Brute force protection
- Session management
- JWT token security
- Multi-factor authentication
- Account lockout mechanisms
- Authentication bypass attempts

### Network Security Testing
- TLS/SSL configuration
- Security headers analysis
- CORS configuration
- Rate limiting protection
- DDoS protection mechanisms
- Certificate security

### API Security Testing
- Authentication mechanisms
- Authorization controls
- Input validation
- Output encoding
- Content type validation
- HTTP methods security
- Error handling security

### Dynamic Application Security Testing
- Cross-Site Scripting (XSS)
- CSRF protection
- Clickjacking protection
- Session management
- File upload security
- Business logic flaws
- DOM-based vulnerabilities

## ⚙️ Configuration

### Environment Variables

```bash
# Target application URLs
TEST_TARGET_URL=http://localhost:3000
API_TARGET_URL=http://localhost:8080

# Authentication
API_KEY=your-api-key-here

# Test configuration
SECURITY_TEST_TIMEOUT=30000
SECURITY_TEST_PARALLEL=false
```

### Configuration File

Create a `config/security-test-config.json` file:

```json
{
  "baseUrl": "http://localhost:3000",
  "apiUrl": "http://localhost:8080",
  "apiKey": "test-api-key",
  "timeout": 30000,
  "parallel": false,
  "outputDir": "./results",
  "testSuites": {
    "owasp": true,
    "injection": true,
    "authentication": true,
    "network": true,
    "api": true,
    "dynamic": true
  }
}
```

## 📊 Reports and Results

The framework generates comprehensive security reports in multiple formats:

### JSON Reports
- Machine-readable format
- Detailed test results
- Vulnerability classifications
- Remediation recommendations

### HTML Reports
- Human-readable format
- Visual charts and graphs
- Executive summary
- Detailed findings

### Report Structure

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "overallScore": 85,
  "status": "PASS",
  "vulnerabilities": [
    {
      "name": "SQL Injection Vulnerability",
      "severity": "High",
      "category": "Injection",
      "details": "SQL injection found in login form",
      "recommendation": "Use parameterized queries"
    }
  ],
  "testResults": [...],
  "summary": {...}
}
```

## 🔧 Command Line Interface

```bash
node security-test-runner.js [options]

Options:
  --base-url <url>     Base URL of the web application
  --api-url <url>      API URL for backend testing  
  --api-key <key>      API key for authentication
  --output-dir <dir>   Output directory for reports
  --parallel           Run tests in parallel
  --timeout <ms>       Request timeout in milliseconds
  --help               Show help message
```

### Examples

```bash
# Test specific application
node security-test-runner.js --base-url https://myapp.com --api-url https://api.myapp.com

# Run tests in parallel with custom timeout
node security-test-runner.js --parallel --timeout 60000

# Generate reports in specific directory
node security-test-runner.js --output-dir ./custom-results
```

## 🔄 CI/CD Integration

### GitHub Actions

The framework includes a comprehensive GitHub Actions workflow for automated security testing:

```yaml
# .github/workflows/security-testing.yml
name: Security Penetration Testing

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
```

### Features

- **Automated Testing** - Runs on push, PR, and scheduled
- **Multi-Environment Support** - Development, staging, production
- **Parallel Execution** - Matrix strategy for faster testing
- **Quality Gates** - Block deployments on critical vulnerabilities
- **Notifications** - Automatic issue creation for critical findings
- **Artifact Storage** - Test results and reports stored as artifacts

### Integration with Other CI/CD Systems

#### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Security Testing') {
            steps {
                sh 'cd security-penetration-testing && npm install'
                sh 'cd security-penetration-testing && npm run test:all'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'security-penetration-testing/results/**/*'
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'security-penetration-testing/results',
                        reportFiles: '*.html',
                        reportName: 'Security Test Report'
                    ])
                }
            }
        }
    }
}
```

#### GitLab CI

```yaml
security-testing:
  stage: security
  image: node:18
  script:
    - cd security-penetration-testing
    - npm install
    - npm run test:all
  artifacts:
    reports:
      junit: security-penetration-testing/results/*.xml
    paths:
      - security-penetration-testing/results/
    expire_in: 1 week
  only:
    - main
    - develop
    - merge_requests
```

## 📈 Metrics and Monitoring

### Security Score Calculation

The framework calculates an overall security score based on:

- **Test Success Rate** (40%)
- **Vulnerability Severity** (35%)  
- **Coverage Completeness** (25%)

### Severity Classifications

- **Critical** - Immediate action required (Score impact: -20 per vulnerability)
- **High** - High priority remediation (Score impact: -10 per vulnerability)
- **Medium** - Medium priority remediation (Score impact: -5 per vulnerability)
- **Low** - Low priority remediation (Score impact: -1 per vulnerability)

### Quality Gates

Default quality gate criteria:
- No critical vulnerabilities
- Maximum 5 high severity vulnerabilities
- Overall security score ≥ 80%
- All test suites must complete successfully

## 🛠️ Development and Customization

### Adding New Test Cases

1. Create test file in appropriate directory:
   ```javascript
   // tests/custom/custom-security-test.js
   const SecurityTest = require('../base/security-test-base');
   
   class CustomSecurityTest extends SecurityTest {
     async runCustomTest() {
       // Implementation
     }
   }
   ```

2. Register in main runner:
   ```javascript
   const CustomSecurityTest = require('./tests/custom/custom-security-test');
   
   this.testSuites.push({
     name: 'Custom Security Tests',
     runner: CustomSecurityTest
   });
   ```

### Extending Test Categories

Create new test categories by extending the base test class:

```javascript
class NewCategoryTest extends BaseSecurityTest {
  constructor(config) {
    super(config);
    this.testCategories = [
      'New Test Category 1',
      'New Test Category 2'
    ];
  }
  
  async testNewCategory() {
    // Implementation
  }
}
```

## 🔍 Troubleshooting

### Common Issues

#### Connection Timeouts
```bash
# Increase timeout for slow applications
node security-test-runner.js --timeout 60000
```

#### Authentication Failures
```bash
# Check API key configuration
export API_KEY=your-actual-api-key
```

#### Memory Issues with Large Applications
```bash
# Run tests sequentially to reduce memory usage
node security-test-runner.js --parallel false
```

### Debug Mode

Enable debug logging:

```bash
export DEBUG=security-test:*
node security-test-runner.js
```

### Verbose Output

```bash
npm run test:all -- --verbose
```

## 📚 Best Practices

### Security Testing Guidelines

1. **Regular Testing** - Run security tests on every build
2. **Environment Isolation** - Test in dedicated security testing environments
3. **False Positive Management** - Review and classify findings
4. **Continuous Improvement** - Update test cases based on new threats
5. **Team Training** - Ensure development teams understand security findings

### Performance Optimization

1. **Parallel Execution** - Use `--parallel` flag for faster testing
2. **Selective Testing** - Run specific test suites during development
3. **Caching** - Cache dependencies and test data when possible
4. **Resource Management** - Monitor memory and CPU usage during tests

## 🤝 Contributing

We welcome contributions to improve the security testing framework:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Add your changes with tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Contribution Guidelines

- Follow existing code style and patterns
- Add comprehensive tests for new features
- Update documentation for any changes
- Ensure all existing tests pass
- Add security test cases for new vulnerability types

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OWASP** - For security testing guidelines and methodology
- **Node.js Security Community** - For security tools and libraries
- **Contributors** - For their valuable contributions to this project

## 📞 Support

For support and questions:

- **Issues** - Create a GitHub issue for bugs or feature requests
- **Discussions** - Use GitHub Discussions for questions and ideas
- **Security** - Report security vulnerabilities privately via email

---

**⚠️ Security Notice**: This framework is designed for testing applications you own or have permission to test. Always ensure you have proper authorization before running security tests against any system.

**🔒 Responsible Disclosure**: If you discover security vulnerabilities in this framework itself, please report them responsibly by contacting the maintainers privately.
