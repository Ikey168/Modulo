# 🔒 CodeQL Code Scanning & Security Analysis

This document describes the CodeQL security analysis implementation for Modulo, providing comprehensive static analysis for Java backend and TypeScript frontend code.

## 📊 Overview

CodeQL performs automated security vulnerability detection and code quality analysis on every pull request and scheduled runs. The implementation includes:

- **Multi-language Support**: Java (backend) and TypeScript/JavaScript (frontend)
- **Security-focused Analysis**: Extended security query suites with CWE coverage
- **PR Security Gates**: Automatic blocking of PRs with high-severity findings
- **Comprehensive Coverage**: Spring Boot, React, and associated frameworks
- **Automated Triage**: Scheduled scans with artifact retention

## 🔍 Languages & Technologies Analyzed

### Java Backend
- **Framework**: Spring Boot 2.7.18
- **Java Version**: 11 (OpenJDK Temurin)
- **Build Tool**: Maven 3.x
- **Source Path**: `./backend/src`
- **Build Command**: `mvn clean compile -DskipTests`

### TypeScript/JavaScript Frontend  
- **Framework**: React 18 with Vite
- **Node Version**: 18.x LTS
- **Package Manager**: npm
- **Source Path**: `./frontend/src`
- **Build Command**: `npm ci && npm run build`

## 🚦 Security Query Coverage

### Common Vulnerabilities & Exposures (CWE)

| CWE ID | Vulnerability Type | Java | TypeScript | Description |
|--------|-------------------|------|------------|-------------|
| **CWE-079** | Cross-Site Scripting (XSS) | ✅ | ✅ | Improper neutralization of user input |
| **CWE-089** | SQL Injection | ✅ | ✅ | Improper neutralization of SQL commands |
| **CWE-094** | Code Injection | ✅ | ✅ | Improper control of code generation |
| **CWE-022** | Path Traversal | ✅ | ✅ | Improper limitation of pathname |
| **CWE-078** | OS Command Injection | ✅ | ✅ | Improper neutralization of OS commands |
| **CWE-295** | Certificate Validation | ✅ | ✅ | Improper certificate validation |
| **CWE-502** | Unsafe Deserialization | ✅ | ❌ | Deserialization of untrusted data |
| **CWE-601** | Open Redirect | ❌ | ✅ | URL redirection to untrusted site |
| **CWE-116** | Encoding Issues | ❌ | ✅ | Improper encoding/escaping |

### Query Suites Used
- **security-extended**: Comprehensive security analysis
- **code-scanning**: Standard code quality and security
- **security-and-quality**: Combined security and performance analysis

## 🔄 Workflow Triggers

### Automatic Triggers
- **Push Events**: main, develop, feature/*, *-* branches
- **Pull Requests**: targeting main branch
- **Schedule**: Weekly on Sundays at 2 AM UTC

### Manual Triggers
- **Workflow Dispatch**: Manual execution via GitHub Actions
- **Security Tab**: Re-run analysis from Security insights

## 📋 Analysis Process

### 1. Code Checkout & Setup
```yaml
# Repository checkout with full history
- uses: actions/checkout@v4

# Language-specific environment setup
- Java 11 (Temurin) + Maven cache
- Node.js 18 + npm cache
```

### 2. CodeQL Initialization
```yaml
# Initialize with custom configuration
- uses: github/codeql-action/init@v3
  with:
    languages: ['java', 'javascript']
    queries: security-and-quality
    config-file: ./.github/codeql/codeql-config.yml
```

### 3. Application Build
```bash
# Java/Spring Boot build
cd backend && mvn clean compile -DskipTests

# TypeScript/React build  
cd frontend && npm ci && npm run build
```

### 4. Security Analysis
```yaml
# Perform analysis with SARIF output
- uses: github/codeql-action/analyze@v3
  with:
    category: "/language:${{matrix.language}}"
    upload: true
    output: sarif-results
```

### 5. Results Processing
- **SARIF Upload**: Results uploaded to GitHub Security tab
- **Artifact Storage**: 30-day retention for analysis results
- **Severity Assessment**: High-severity findings trigger PR blocks

## 🛡️ Security Gate Implementation

### PR Protection Rules

#### High-Severity Blocking
```bash
# Scan for high-severity security findings
HIGH_SEV_COUNT=$(find sarif-results -name "*.sarif" -exec jq -r '
  .runs[]?.results[]? | 
  select(.level == "error" and (.ruleId | contains("security"))) |
  .level
' {} \; | wc -l)

# Block PR if high-severity issues found
if [ "$HIGH_SEV_COUNT" -gt 0 ]; then
  echo "❌ Found $HIGH_SEV_COUNT high-severity security finding(s)"
  exit 1
fi
```

#### Status Checks
- **codeql-status**: Overall CodeQL analysis status
- **analyze (java)**: Java-specific analysis results  
- **analyze (javascript)**: TypeScript/JavaScript analysis results

### Branch Protection Integration
```yaml
# Required status checks for main branch
required_status_checks:
  - "CodeQL Status Check"
  - "CodeQL Analysis (java)"
  - "CodeQL Analysis (javascript)"
```

## 📊 Results & Reporting

### Security Tab Integration
All CodeQL findings are automatically uploaded to:
```
https://github.com/Ikey168/Modulo/security/code-scanning
```

### Automated PR Comments
```markdown
## 🔒 CodeQL Security Scan - ✅ PASSED

**Status**: All security checks completed successfully
**Languages Analyzed**: Java, TypeScript/JavaScript
**Query Suite**: security-and-quality

✅ No high-severity security findings detected
✅ Code is safe to merge from security perspective
```

### Artifact Retention
- **SARIF Results**: 30-day retention for compliance
- **Analysis Logs**: Available in workflow run details
- **Historical Data**: Trends available in Security insights

## 🚨 Alert Management

### Severity Levels

| Severity | Action Required | PR Impact | Examples |
|----------|----------------|-----------|----------|
| **Error/High** | Immediate fix | ❌ Blocks merge | SQL injection, XSS, RCE |
| **Warning/Medium** | Review recommended | ⚠️ Warning only | Weak crypto, info disclosure |
| **Note/Low** | Optional fix | ✅ No impact | Code quality, best practices |

### Alert Triage Process

#### 1. Immediate Response (High-Severity)
```bash
# PR automatically blocked
echo "❌ High-severity security findings detected"
echo "🛡️ Security gate: Must resolve before merge"
```

#### 2. Developer Actions
1. **Review findings** in Security tab
2. **Analyze false positives** using CodeQL query console
3. **Implement fixes** for legitimate issues
4. **Suppress alerts** for confirmed false positives
5. **Re-run analysis** to verify fixes

#### 3. Security Team Review
- **Weekly triage** of all findings
- **False positive validation** 
- **Query customization** for project-specific patterns
- **Baseline establishment** for existing code

## 🔧 Configuration Management

### Query Customization
File: `.github/codeql/codeql-config.yml`

```yaml
# Custom path filters
paths:
  - "backend/src"
  - "frontend/src"

# Excluded paths
paths-ignore:
  - "**/test/**"
  - "**/node_modules"
  - "**/target"
```

### Language-Specific Settings

#### Java Configuration
```yaml
packs:
  java:
    - "codeql/java-queries:Security/CWE/CWE-079"  # XSS
    - "codeql/java-queries:Security/CWE/CWE-089"  # SQL Injection
    - "codeql/java-queries:Security/CWE/CWE-502"  # Deserialization
```

#### TypeScript Configuration
```yaml
packs:
  javascript:
    - "codeql/javascript-queries:Security/CWE/CWE-079"  # XSS
    - "codeql/javascript-queries:Security/CWE/CWE-601"  # Open Redirect
    - "codeql/javascript-queries:Security/CWE/CWE-116"  # Encoding
```

## 📈 Performance & Optimization

### Analysis Timing
| Component | Typical Duration | Timeout |
|-----------|-----------------|---------|
| **Java Analysis** | 5-8 minutes | 10 minutes |
| **TypeScript Analysis** | 3-5 minutes | 10 minutes |
| **Total Workflow** | 10-15 minutes | 30 minutes |

### Resource Usage
- **CPU**: 2 vCPUs per language analysis
- **Memory**: 4-6 GB RAM recommended
- **Storage**: ~500MB SARIF artifacts per run
- **Concurrency**: Matrix strategy for parallel execution

### Optimization Strategies
```yaml
# Build optimization
- name: Build with debug info
  run: mvn compile -DskipTests -Dmaven.compiler.debug=true

# Cache optimization  
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
```

## 🛠️ Local Development

### Running CodeQL Locally

#### Prerequisites
```bash
# Install CodeQL CLI
gh extension install github/gh-codeql

# Download CodeQL bundle
codeql pack download codeql/java-queries
codeql pack download codeql/javascript-queries
```

#### Local Analysis
```bash
# Create CodeQL database (Java)
codeql database create java-db --language=java --source-root=backend

# Create CodeQL database (JavaScript)  
codeql database create js-db --language=javascript --source-root=frontend

# Run security queries
codeql database analyze java-db codeql/java-queries:Security/
codeql database analyze js-db codeql/javascript-queries:Security/
```

### IDE Integration

#### VS Code Extension
```json
{
  "codeql.cli.executablePath": "/path/to/codeql",
  "codeql.runningQueries.numberOfThreads": 2,
  "codeql.runningTests.numberOfThreads": 2
}
```

#### IntelliJ IDEA Plugin
- **CodeQL Plugin**: Available in JetBrains Marketplace
- **Query Development**: .ql file syntax highlighting
- **Database Exploration**: Direct CodeQL database access

## 🔍 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Java compilation issues
Error: Could not find or load main class
Solution: Ensure JAVA_HOME and Maven are properly configured

# TypeScript build issues  
Error: Module not found
Solution: Run npm ci to ensure dependencies are installed
```

#### False Positives
```yaml
# Suppress false positive alerts
# Add to .github/codeql/codeql-config.yml
query-filters:
  - exclude:
      id: java/path-injection
      paths: "src/test/**"
```

#### Performance Issues
```yaml
# Reduce analysis scope
paths-ignore:
  - "**/generated/**"
  - "**/vendor/**"
  - "**/third-party/**"
```

### Debug Commands
```bash
# Check CodeQL version
codeql version

# Validate configuration
codeql resolve languages --format=json

# Database inspection
codeql database info <database-path>

# Query testing
codeql query run <query-file> --database=<database-path>
```

## 📋 Compliance & Reporting

### Security Standards
- **OWASP Top 10**: Comprehensive coverage
- **CWE/SANS 25**: Most dangerous software errors
- **NIST Cybersecurity Framework**: Identify and protect functions
- **SOC 2 Type II**: Continuous monitoring requirements

### Audit Trails
- **SARIF Results**: Machine-readable security findings
- **Workflow Logs**: Complete analysis execution history  
- **Git Integration**: Security findings linked to specific commits
- **Retention Policy**: 30-day artifact storage for compliance

### Metrics Dashboard
```
GitHub Security Tab → Code Scanning → Metrics
- Alert trends over time
- Language-specific finding distribution  
- Mean time to resolution (MTTR)
- Security debt accumulation
```

## 🚀 Advanced Features

### Custom Query Development
```ql
/**
 * @name Custom Spring Security vulnerability detection
 * @description Detects potential security misconfigurations in Spring Security
 * @kind problem
 * @problem.severity error
 * @security-severity 8.1
 * @precision high
 * @id java/spring-security-misconfiguration
 */

import java
import semmle.code.java.frameworks.spring.SpringSecurity

from MethodAccess call
where call.getMethod().hasName("permitAll")
  and call.getEnclosingCallable().getDeclaringType().hasQualifiedName("SecurityConfig")
select call, "Potential security misconfiguration: overly permissive access control"
```

### Integration with External Tools
```yaml
# SARIF to external SIEM
- name: Upload to Splunk
  run: |
    curl -X POST "https://splunk.example.com/api/ingest" \
      -H "Authorization: Bearer ${{ secrets.SPLUNK_TOKEN }}" \
      --data-binary @sarif-results/*.sarif
```

### Baseline Management
```bash
# Create security baseline
codeql database analyze db --format=sarif-latest --output=baseline.sarif

# Compare against baseline
codeql database diff baseline.sarif current.sarif
```

## 🎯 Best Practices

### Development Workflow
1. **Pre-commit**: Run local CodeQL checks
2. **Feature branches**: Continuous security scanning
3. **Code review**: Include security finding review
4. **Merge gates**: Require security approval
5. **Release**: Final security validation

### Security Integration
- **Security Champions**: Trained developers in each team
- **Shift-Left**: Early security testing in development
- **Continuous Monitoring**: Ongoing security posture assessment
- **Incident Response**: Security finding escalation procedures

### Query Maintenance
- **Regular Updates**: Keep CodeQL queries current
- **Custom Rules**: Project-specific security patterns
- **False Positive Management**: Continuous tuning
- **Performance Optimization**: Efficient query development

---

## 📞 Support & Resources

- **GitHub CodeQL Documentation**: https://codeql.github.com/
- **Security Team**: security@modulo.dev
- **CodeQL Community**: https://github.com/github/codeql
- **Internal Wiki**: Security analysis runbooks and procedures
