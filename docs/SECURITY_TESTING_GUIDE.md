# Security Testing Guide for Cloud Deployment

## Issue #51: Conduct Security Testing on Cloud Deployment

This document outlines the comprehensive security testing procedures and vulnerability remediation implemented for the Modulo application's cloud deployment.

## Table of Contents
1. [Security Testing Overview](#security-testing-overview)
2. [Implemented Security Measures](#implemented-security-measures)
3. [Penetration Testing Procedures](#penetration-testing-procedures)
4. [Vulnerability Assessment](#vulnerability-assessment)
5. [Security Configuration](#security-configuration)
6. [Testing Endpoints](#testing-endpoints)
7. [Security Monitoring](#security-monitoring)
8. [Deployment Hardening](#deployment-hardening)

## Security Testing Overview

The security testing implementation addresses cloud deployment vulnerabilities through:
- **Automated vulnerability scanning**
- **Penetration testing capabilities**
- **Rate limiting and DoS protection**
- **Comprehensive security headers**
- **Authentication and authorization hardening**
- **Session security enhancements**
- **Audit logging and monitoring**

## Implemented Security Measures

### 1. Cloud Security Configuration (`CloudSecurityConfig.java`)
- **Stateless session management** for cloud scalability
- **Enhanced CORS configuration** with restricted origins
- **Comprehensive security headers** (HSTS, CSP, X-Frame-Options, etc.)
- **OAuth2 authentication** with proper authorization rules
- **Rate limiting integration**
- **Security event logging**

### 2. Rate Limiting Protection (`RateLimitingFilter.java`)
- **Per-IP rate limiting** (configurable requests per minute)
- **Global rate limiting** for overall API protection
- **Burst capacity handling** for legitimate traffic spikes
- **Exemptions for health checks** and static resources
- **Suspicious activity detection**
- **Rate limit headers** for client information

### 3. Security Audit Logging (`SecurityAuditLogger.java`)
- **Structured JSON logging** for security events
- **Authentication success/failure tracking**
- **Authorization violation logging**
- **Suspicious activity detection**
- **Vulnerability detection alerts**
- **CORS violation tracking**
- **Session management events**

### 4. Penetration Testing Controller (`SecurityTestingController.java`)
- **Automated vulnerability scanning**
- **SQL injection testing**
- **XSS vulnerability testing**
- **Rate limiting validation**
- **Security header verification**
- **Authentication security assessment**

## Penetration Testing Procedures

### 1. Vulnerability Scan Execution
```bash
# Enable security testing (development only)
export SECURITY_TESTING_ENABLED=true
export SECURITY_TESTING_API_KEY=your-secure-api-key

# Run comprehensive vulnerability scan
curl -X POST "https://api.modulo.com/api/security/testing/vulnerability-scan" \
  -H "X-Security-Testing-Key: your-secure-api-key" \
  -H "Authorization: Bearer admin-token"
```

### 2. Rate Limiting Tests
```bash
# Test rate limiting effectiveness
curl -X POST "https://api.modulo.com/api/security/testing/test-rate-limiting" \
  -H "X-Security-Testing-Key: your-secure-api-key" \
  -d '{"requestCount": 150}'
```

### 3. SQL Injection Testing
```bash
# Test SQL injection vulnerabilities
curl -X POST "https://api.modulo.com/api/security/testing/test-sql-injection" \
  -H "X-Security-Testing-Key: your-secure-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin'\''--",
    "search": "' OR 1=1 --"
  }'
```

### 4. XSS Vulnerability Testing
```bash
# Test XSS vulnerabilities
curl -X POST "https://api.modulo.com/api/security/testing/test-xss" \
  -H "X-Security-Testing-Key: your-secure-api-key"
```

## Vulnerability Assessment

### High Priority Vulnerabilities Fixed:
1. **Missing Security Headers**
   - ✅ Implemented HSTS (HTTP Strict Transport Security)
   - ✅ Added Content Security Policy (CSP)
   - ✅ Configured X-Frame-Options (Clickjacking protection)
   - ✅ Set X-Content-Type-Options (MIME sniffing prevention)
   - ✅ Added X-XSS-Protection header

2. **CSRF Vulnerability**
   - ✅ CSRF protection disabled for stateless API
   - ✅ Implemented proper CORS restrictions
   - ✅ Added SameSite cookie attributes

3. **Rate Limiting Missing**
   - ✅ Implemented per-IP rate limiting
   - ✅ Added global rate limiting
   - ✅ Configured burst capacity handling

4. **Session Security Issues**
   - ✅ Implemented stateless sessions
   - ✅ Configured secure cookie attributes
   - ✅ Added session timeout controls

### Medium Priority Vulnerabilities Fixed:
1. **Insufficient Logging**
   - ✅ Comprehensive security audit logging
   - ✅ Structured JSON log format
   - ✅ Security event correlation

2. **CORS Misconfiguration**
   - ✅ Restricted allowed origins
   - ✅ Limited HTTP methods
   - ✅ Controlled credential handling

## Security Configuration

### Environment-Specific Settings

#### Production (`application-security.properties`)
```properties
# Rate Limiting
modulo.security.rate-limit.enabled=true
modulo.security.rate-limit.requests-per-minute=100

# Security Headers
modulo.security.headers.hsts.enabled=true
modulo.security.headers.hsts.max-age=31536000

# CORS (Production domains only)
modulo.security.cors.allowed-origins=https://modulo-app.com

# Security Testing (DISABLED)
modulo.security.testing.enabled=false
```

#### Development
```properties
# Rate Limiting (Relaxed)
modulo.security.rate-limit.requests-per-minute=1000

# CORS (Allow localhost)
modulo.security.cors.allowed-origins=http://localhost:3000,http://localhost:8080

# Security Testing (ENABLED)
modulo.security.testing.enabled=true
modulo.security.testing.api-key=dev-testing-key
```

## Testing Endpoints

### Security Testing API (Development Only)

#### 1. Vulnerability Scan
- **Endpoint**: `POST /api/security/testing/vulnerability-scan`
- **Auth**: Admin role required + API key
- **Response**: Comprehensive security assessment with score

#### 2. Rate Limiting Test
- **Endpoint**: `POST /api/security/testing/test-rate-limiting`
- **Parameters**: `requestCount` (number of requests to simulate)
- **Response**: Rate limiting effectiveness report

#### 3. SQL Injection Test
- **Endpoint**: `POST /api/security/testing/test-sql-injection`
- **Body**: Test payloads to validate
- **Response**: Vulnerability detection results

#### 4. XSS Test
- **Endpoint**: `POST /api/security/testing/test-xss`
- **Response**: XSS vulnerability assessment

## Security Monitoring

### Audit Log Analysis
Security events are logged in structured JSON format:
```json
{
  "eventId": "uuid",
  "timestamp": "2023-12-08T10:15:30Z",
  "eventType": "AUTHENTICATION_FAILURE",
  "username": "attacker",
  "clientIp": "192.168.1.100",
  "userAgent": "curl/7.68.0",
  "riskLevel": "HIGH",
  "outcome": "BLOCKED"
}
```

### Key Metrics to Monitor:
- **Authentication failure rate**
- **Rate limiting activations**
- **Suspicious activity patterns**
- **Vulnerability detection events**
- **CORS violations**

### Alert Triggers:
- Multiple authentication failures from same IP
- Rate limiting exceeded repeatedly
- SQL injection or XSS attempts detected
- Security configuration changes
- Critical vulnerability detections

## Deployment Hardening

### Infrastructure Security
1. **HTTPS Enforcement**
   - TLS 1.2+ only
   - Strong cipher suites
   - HSTS headers

2. **Network Security**
   - WAF (Web Application Firewall)
   - DDoS protection
   - IP allowlisting for admin endpoints

3. **Database Security**
   - Connection encryption
   - Query parameterization
   - Access logging

### Container Security
```dockerfile
# Use non-root user
RUN addgroup -g 1001 -S modulo && \
    adduser -u 1001 -S modulo -G modulo
USER modulo

# Security scanning
RUN apk add --no-cache ca-certificates
```

### Kubernetes Security
```yaml
apiVersion: v1
kind: SecurityContext
spec:
  runAsNonRoot: true
  runAsUser: 1001
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true
```

## Security Testing Checklist

### Pre-Deployment
- [ ] Vulnerability scan shows >95% security score
- [ ] Rate limiting properly configured and tested
- [ ] Security headers verified
- [ ] Authentication/authorization tested
- [ ] SSL/TLS configuration validated
- [ ] Audit logging functional

### Post-Deployment
- [ ] Penetration testing completed
- [ ] Security monitoring active
- [ ] Log analysis configured
- [ ] Alert systems operational
- [ ] Incident response procedures tested

### Ongoing Maintenance
- [ ] Regular vulnerability scans
- [ ] Security patch management
- [ ] Log review and analysis
- [ ] Security configuration updates
- [ ] Threat intelligence integration

## Contact and Support

For security-related issues or questions:
- **Security Team**: security@modulo.com
- **Emergency**: security-incident@modulo.com
- **Documentation**: https://docs.modulo.com/security

---

**Note**: Security testing endpoints must be disabled in production environments. The security testing API key should be kept secure and rotated regularly.
