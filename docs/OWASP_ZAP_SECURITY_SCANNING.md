# OWASP ZAP Security Scanning Guide

## Overview

This document provides comprehensive guidance for OWASP ZAP (Zed Attack Proxy) security scanning implemented in the Modulo project. ZAP is an open-source web application security scanner that helps identify security vulnerabilities in web applications and APIs.

## Table of Contents

- [Scan Types](#scan-types)
- [Security Gates](#security-gates)  
- [Workflow Configuration](#workflow-configuration)
- [Understanding Results](#understanding-results)
- [Remediation Guidelines](#remediation-guidelines)
- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)
- [Security Standards](#security-standards)

## Scan Types

### 1. Baseline Scan (Passive)

**Purpose**: Passive security analysis that doesn't modify application state
**Duration**: 5-10 minutes
**Triggered**: Every push and pull request

**What it checks**:
- Security headers (CSP, HSTS, X-Frame-Options)
- Cookie security attributes
- Information disclosure vulnerabilities
- SSL/TLS configuration
- Directory traversal attempts (passive)
- Cross-site scripting (passive detection)

**Example findings**:
```
- Missing X-Content-Type-Options header
- Cookie without HttpOnly flag
- Information disclosure in error messages
- Insecure SSL/TLS configuration
```

### 2. Active Scan (Active Testing)

**Purpose**: Active vulnerability testing that interacts with the application
**Duration**: 15-30 minutes
**Triggered**: Pull requests to main, scheduled weekly scans

**What it checks**:
- SQL injection vulnerabilities
- Cross-site scripting (XSS)
- Command injection
- Path traversal attacks
- Authentication bypass
- Session management flaws
- CSRF vulnerabilities

**Example findings**:
```
- SQL injection in login form
- Reflected XSS in search parameter
- Directory traversal in file download
- Session fixation vulnerability
```

### 3. API Security Scan

**Purpose**: REST API-specific security testing
**Duration**: 10-20 minutes  
**Triggered**: With active scans

**What it checks**:
- API authentication mechanisms
- Input validation on API endpoints
- Authorization bypass
- Rate limiting
- API-specific injection attacks
- Swagger/OpenAPI security

**Example findings**:
```
- Missing API authentication
- SQL injection in API parameters
- Insecure direct object references
- Missing rate limiting
```

## Security Gates

### High-Risk Blocking

The security gate **blocks** PR merges when high-risk vulnerabilities are detected:

#### Critical Issues (Auto-Block)
- **SQL Injection**: Database manipulation vulnerabilities
- **Remote Code Execution**: Server-side code execution
- **Authentication Bypass**: Login mechanism flaws
- **Cross-Site Scripting (XSS)**: Client-side code injection
- **Command Injection**: Operating system command execution
- **Path Traversal**: Unauthorized file system access

#### High-Severity Issues (Auto-Block)
- **Session Management**: Session fixation, hijacking
- **CSRF**: Cross-site request forgery
- **Information Disclosure**: Sensitive data exposure
- **XML External Entity (XXE)**: XML processing vulnerabilities
- **LDAP Injection**: Directory service manipulation

### Medium-Risk Warnings

Medium-risk findings generate warnings but don't block merges:

- Missing security headers (CSP, HSTS)
- Insecure cookie configuration
- Vulnerable JavaScript libraries
- Information leakage (non-sensitive)
- Weak encryption algorithms

### Security Gate Logic

```yaml
# Security gate decision matrix
if high_risk_count > 0:
  status = "FAILED - Block merge"
  action = "Require fixes before merge"
elif medium_risk_count > 5:
  status = "WARNING - Review recommended" 
  action = "Allow merge with review"
else:
  status = "PASSED - Safe to merge"
  action = "Proceed with merge"
```

## Workflow Configuration

### Automatic Triggers

```yaml
# Push events
on:
  push:
    branches: [main, develop, 'feature/*', 'release/*']
  
# Pull requests  
on:
  pull_request:
    branches: [main, develop]
    
# Scheduled scans
on:
  schedule:
    - cron: '0 3 * * 0'  # Weekly Sundays 3 AM UTC
```

### Manual Triggers

Run manual scans via GitHub Actions:

1. **Workflow Dispatch**:
   - Go to Actions → OWASP ZAP Security Scan
   - Click "Run workflow"
   - Select scan type: baseline, active, or full
   - Optionally specify custom target URL

2. **Custom Target Scanning**:
   ```bash
   # Scan external staging environment
   gh workflow run owasp-zap.yml \
     -f scan_type=full \
     -f target_url=https://staging.modulo.example.com
   ```

### Environment Configuration

The workflow automatically creates a staging environment:

```bash
# Staging environment variables
POSTGRES_DB=modulodb_staging
POSTGRES_USER=postgres_staging  
POSTGRES_PASSWORD=<random-generated>
SPRING_PROFILES_ACTIVE=staging
VITE_API_URL=http://localhost:8080
```

**Services started**:
- Frontend (React + Vite): http://localhost:80
- Backend (Spring Boot): http://localhost:8080
- Database (PostgreSQL): localhost:5432
- Neo4j (Graph DB): localhost:7474/7687

## Understanding Results

### Report Formats

ZAP generates multiple report formats:

1. **HTML Report** (`zap-*-report.html`)
   - Human-readable vulnerability details
   - Screenshots and proof-of-concept
   - Remediation recommendations

2. **JSON Report** (`zap-*-report.json`)
   - Machine-readable results
   - Structured vulnerability data
   - Integration with security tools

3. **Markdown Report** (`zap-*-report.md`)
   - GitHub-friendly documentation format
   - Summary statistics
   - Categorized findings

### Risk Levels

| Risk Level | Score | Description | Action Required |
|------------|-------|-------------|-----------------|
| **Critical** | 4 | Immediate exploitation possible | ❌ Block merge |
| **High** | 3 | Significant security impact | ❌ Block merge |
| **Medium** | 2 | Moderate security concern | ⚠️ Review recommended |
| **Low** | 1 | Minor security issue | ℹ️ Informational |
| **Info** | 0 | Security observation | ℹ️ Informational |

### Finding Categories

#### Web Application Vulnerabilities
- **A01: Broken Access Control**
  - Missing authentication
  - Insecure direct object references
  - Privilege escalation

- **A03: Injection**
  - SQL injection
  - NoSQL injection  
  - Command injection
  - LDAP injection

- **A07: Cross-Site Scripting (XSS)**
  - Reflected XSS
  - Stored XSS
  - DOM-based XSS

#### API Security Issues
- **API01: Broken Object Level Authorization**
- **API02: Broken User Authentication**
- **API03: Excessive Data Exposure**
- **API04: Lack of Resources & Rate Limiting**
- **API05: Broken Function Level Authorization**

#### Configuration Issues
- **Security Headers Missing**
  - Content-Security-Policy
  - Strict-Transport-Security
  - X-Frame-Options
  - X-Content-Type-Options

- **SSL/TLS Configuration**
  - Weak cipher suites
  - Invalid certificates
  - Mixed content

## Remediation Guidelines

### SQL Injection

**Problem**: User input not properly sanitized before database queries

**Solution**:
```java
// ❌ Vulnerable code
String sql = "SELECT * FROM users WHERE id = " + userId;
Statement stmt = connection.createStatement();
ResultSet rs = stmt.executeQuery(sql);

// ✅ Secure code - Use prepared statements
String sql = "SELECT * FROM users WHERE id = ?";
PreparedStatement stmt = connection.prepareStatement(sql);
stmt.setInt(1, userId);
ResultSet rs = stmt.executeQuery();

// ✅ Secure code - Use JPA/Hibernate
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findById(Long id);
}
```

### Cross-Site Scripting (XSS)

**Problem**: User input rendered without proper encoding

**Solution**:
```typescript
// ❌ Vulnerable code
function displayMessage(message: string) {
  document.getElementById('output').innerHTML = message;
}

// ✅ Secure code - Use textContent
function displayMessage(message: string) {
  document.getElementById('output').textContent = message;
}

// ✅ Secure code - Use React (auto-escaping)
function MessageComponent({ message }: { message: string }) {
  return <div>{message}</div>;
}

// ✅ Secure code - Manual HTML escaping
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

### Security Headers

**Problem**: Missing security headers expose application to attacks

**Solution** (Spring Boot):
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.headers(headers -> headers
            .frameOptions().deny()
            .contentTypeOptions().and()
            .httpStrictTransportSecurity(hstsConfig -> hstsConfig
                .maxAgeInSeconds(31536000)
                .includeSubdomains(true))
            .contentSecurityPolicy("default-src 'self'; script-src 'self'")
        );
        return http.build();
    }
}
```

**Solution** (Nginx):
```nginx
# nginx.conf
server {
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
```

### Cookie Security

**Problem**: Insecure cookie configuration

**Solution**:
```java
// Spring Boot application.yml
server:
  servlet:
    session:
      cookie:
        secure: true
        http-only: true
        same-site: strict

// Or programmatically
@Bean
public CookieSameSiteSupplier cookieSameSiteSupplier() {
    return CookieSameSiteSupplier.ofStrict();
}
```

### Authentication Issues

**Problem**: Weak authentication mechanisms

**Solution**:
```java
// ✅ Secure authentication with Spring Security
@Service
public class AuthenticationService {
    
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    
    public AuthenticationResponse authenticate(LoginRequest request) {
        // Rate limiting
        if (isRateLimited(request.getEmail())) {
            throw new TooManyAttemptsException();
        }
        
        // Secure password verification
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
            
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            recordFailedAttempt(request.getEmail());
            throw new BadCredentialsException("Invalid credentials");
        }
        
        // Generate secure JWT
        String token = jwtTokenProvider.generateToken(user);
        return new AuthenticationResponse(token);
    }
}
```

## Local Development

### Installing ZAP CLI

```bash
# Install ZAP CLI
pip install zapcli

# Or use Docker
docker pull ghcr.io/zaproxy/zaproxy:stable
```

### Running Local Scans

```bash
# Start local application
docker-compose -f docker-compose.dev.yml up -d

# Run baseline scan
docker run --rm \
  --network=host \
  -v $(pwd)/zap-results:/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://localhost:3000 -r zap-baseline-report.html

# Run active scan  
docker run --rm \
  --network=host \
  -v $(pwd)/zap-results:/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py -t http://localhost:3000 -r zap-active-report.html

# Run API scan
docker run --rm \
  --network=host \
  -v $(pwd)/zap-results:/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py -t http://localhost:8080/api -r zap-api-report.html
```

### ZAP Desktop (GUI)

```bash
# Download ZAP Desktop
wget https://github.com/zaproxy/zaproxy/releases/download/v2.14.0/ZAP_2_14_0_unix.sh

# Install and run
chmod +x ZAP_2_14_0_unix.sh
./ZAP_2_14_0_unix.sh

# Configure proxy in browser
# Proxy: localhost:8080
# Import ZAP certificate for HTTPS scanning
```

### IDE Integration

**VS Code ZAP Extension**:
```json
{
  "zap.proxy.host": "localhost",
  "zap.proxy.port": 8080,
  "zap.api.key": "your-api-key",
  "zap.scan.baseline": true,
  "zap.scan.active": false
}
```

## Troubleshooting

### Common Issues

#### 1. Staging Environment Startup Failures

**Problem**: Services fail to start or become healthy

**Solutions**:
```bash
# Check Docker logs
docker-compose --env-file .env.staging logs

# Verify port availability
netstat -tlnp | grep -E ':(80|8080|5432|7474|7687)'

# Increase startup timeout
# In workflow: timeout 600 bash -c '...'

# Check resource usage
docker stats
```

#### 2. ZAP Scan Timeouts

**Problem**: Scans exceed time limits

**Solutions**:
```bash
# Increase scan timeout
-T 900  # 15 minutes instead of default 5

# Reduce scan scope
-I excludefile.txt  # Exclude certain paths

# Use faster scan policies
-P baseline-policy.policy
```

#### 3. False Positives

**Problem**: ZAP reports non-issues as vulnerabilities

**Solutions**:
```bash
# Update rules file (.github/zap/zap-baseline-rules.tsv)
IGNORE	10001	False positive finding

# Use context files for authentication
-n context.context

# Exclude specific URLs
-I /health,/metrics,/static/*
```

#### 4. Authentication Issues

**Problem**: ZAP can't access authenticated areas

**Solutions**:
```bash
# Use authentication context
-n auth-context.context

# Include session tokens
-H "Authorization: Bearer token"

# Use form-based authentication
-x auth-config.xml
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
# Add to ZAP command
-d  # Debug mode

# View detailed logs
-v  # Verbose output

# Save detailed reports
-J detailed-report.json
-X detailed-report.xml
```

### Performance Tuning

```bash
# Optimize for speed
-T 300              # Shorter timeout
-m 5                # Fewer threads  
-z "-config view.mode=protect"  # Protection mode

# Optimize for coverage
-T 1800             # Longer timeout
-m 20               # More threads
-z "-config spider.maxDepth=10"  # Deeper crawling
```

## Security Standards

### Compliance Frameworks

#### OWASP Top 10 (2021)
- **A01**: Broken Access Control
- **A02**: Cryptographic Failures  
- **A03**: Injection
- **A04**: Insecure Design
- **A05**: Security Misconfiguration
- **A06**: Vulnerable Components
- **A07**: Identification & Authentication Failures
- **A08**: Software & Data Integrity Failures
- **A09**: Security Logging & Monitoring Failures
- **A10**: Server-Side Request Forgery

#### OWASP API Security Top 10
- **API1**: Broken Object Level Authorization
- **API2**: Broken User Authentication
- **API3**: Excessive Data Exposure
- **API4**: Lack of Resources & Rate Limiting
- **API5**: Broken Function Level Authorization
- **API6**: Mass Assignment
- **API7**: Security Misconfiguration
- **API8**: Injection
- **API9**: Improper Assets Management
- **API10**: Insufficient Logging & Monitoring

#### CWE Coverage

ZAP detects vulnerabilities from these CWE categories:

| CWE ID | Category | Examples |
|--------|----------|----------|
| CWE-20 | Input Validation | SQL injection, XSS |
| CWE-79 | Cross-site Scripting | Reflected, stored, DOM XSS |
| CWE-89 | SQL Injection | Database manipulation |
| CWE-94 | Code Injection | Remote code execution |
| CWE-287 | Authentication | Weak login mechanisms |
| CWE-352 | CSRF | Cross-site request forgery |
| CWE-22 | Path Traversal | Directory traversal |
| CWE-78 | Command Injection | OS command execution |

### Security Metrics

Track security posture with these metrics:

```bash
# Vulnerability trends
- High-risk findings per month
- Medium-risk findings per month  
- Time to remediation
- Scan coverage percentage

# Security gate effectiveness
- PRs blocked by security findings
- False positive rate
- Mean time to fix (MTTF)
- Security debt accumulation
```

### Reporting

Generate executive security reports:

```bash
# Monthly security dashboard
- Total vulnerabilities found: X
- Critical vulnerabilities: X (blocked Y PRs)
- Remediation rate: X% 
- Top vulnerability types
- Security trend analysis
```

## Integration Points

### GitHub Security Tab

ZAP results automatically appear in:
- Security → Code scanning alerts
- Pull request security checks
- Security advisory database
- Dependabot integration

### SARIF Upload

Results uploaded in SARIF format for:
- GitHub native security tooling
- Third-party security platforms
- Compliance reporting
- Trend analysis

### Artifact Storage

Scan artifacts retained for:
- Compliance audits (30 days)
- Historical trend analysis
- Security team review
- Developer training

## Best Practices

### Development Workflow

1. **Run local scans** before pushing code
2. **Review security findings** in PR comments
3. **Fix high-risk issues** before merge
4. **Monitor security trends** over time
5. **Update security rules** based on new threats

### Team Collaboration

1. **Security champions** in each team
2. **Regular security training** on common vulnerabilities
3. **Shared responsibility** for security fixes
4. **Security review** for architectural changes

### Continuous Improvement

1. **Regular rule updates** for new vulnerability types
2. **False positive tuning** to reduce noise
3. **Performance optimization** for faster scans
4. **Integration enhancement** with other security tools

---

## Additional Resources

- [OWASP ZAP Documentation](https://owasp.org/www-project-zap/)
- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [GitHub Security Features](https://docs.github.com/en/code-security)

**Security Team Contact**: security@modulo.example.com
**Emergency Security Issues**: security-emergency@modulo.example.com
