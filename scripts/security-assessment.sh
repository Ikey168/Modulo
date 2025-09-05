#!/bin/bash

# Vulnerability Assessment Script for Modulo Cloud Deployment
# Addresses Issue #51: Conduct Security Testing on Cloud Deployment

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-https://api.modulo.com}"
SECURITY_API_KEY="${SECURITY_API_KEY:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
OUTPUT_DIR="${OUTPUT_DIR:-./security-reports}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Report files
VULNERABILITY_REPORT="${OUTPUT_DIR}/vulnerability_scan_${TIMESTAMP}.json"
RATE_LIMIT_REPORT="${OUTPUT_DIR}/rate_limit_test_${TIMESTAMP}.json"
SQL_INJECTION_REPORT="${OUTPUT_DIR}/sql_injection_test_${TIMESTAMP}.json"
XSS_REPORT="${OUTPUT_DIR}/xss_test_${TIMESTAMP}.json"
SUMMARY_REPORT="${OUTPUT_DIR}/security_summary_${TIMESTAMP}.txt"

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed. Please install curl to run security tests."
        exit 1
    fi
    
    # Check if jq is available for JSON processing
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. JSON reports will not be formatted."
    fi
    
    # Check if API key is provided
    if [[ -z "${SECURITY_API_KEY}" ]]; then
        log_error "SECURITY_API_KEY environment variable is not set."
        log_info "Export your security testing API key: export SECURITY_API_KEY=your-api-key"
        exit 1
    fi
    
    # Check if admin token is provided
    if [[ -z "${ADMIN_TOKEN}" ]]; then
        log_error "ADMIN_TOKEN environment variable is not set."
        log_info "Export your admin token: export ADMIN_TOKEN=your-admin-token"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to test API connectivity
test_connectivity() {
    log_info "Testing API connectivity..."
    
    local health_check_url="${API_BASE_URL}/actuator/health"
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" "${health_check_url}" || echo "000")
    
    if [[ "${response_code}" == "200" ]]; then
        log_success "API is accessible at ${API_BASE_URL}"
    else
        log_error "API is not accessible. Response code: ${response_code}"
        log_info "Please check the API_BASE_URL: ${API_BASE_URL}"
        exit 1
    fi
}

# Function to run comprehensive vulnerability scan
run_vulnerability_scan() {
    log_info "Running comprehensive vulnerability scan..."
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/security/testing/vulnerability-scan" \
        -H "X-Security-Testing-Key: ${SECURITY_API_KEY}" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" \
        -H "Content-Type: application/json" \
        -w "HTTP_CODE:%{http_code}")
    
    local http_code=$(echo "${response}" | grep "HTTP_CODE:" | cut -d: -f2)
    local body=$(echo "${response}" | sed 's/HTTP_CODE:.*//g')
    
    if [[ "${http_code}" == "200" ]]; then
        log_success "Vulnerability scan completed successfully"
        echo "${body}" > "${VULNERABILITY_REPORT}"
        
        # Extract key metrics if jq is available
        if command -v jq &> /dev/null; then
            local security_score=$(echo "${body}" | jq -r '.overallSecurityScore // "N/A"')
            local total_tests=$(echo "${body}" | jq -r '.totalTests // "N/A"')
            local passed_tests=$(echo "${body}" | jq -r '.passedTests // "N/A"')
            
            log_info "Security Score: ${security_score}%"
            log_info "Tests Passed: ${passed_tests}/${total_tests}"
        fi
    else
        log_error "Vulnerability scan failed. HTTP Code: ${http_code}"
        echo "${body}" > "${VULNERABILITY_REPORT}.error"
        return 1
    fi
}

# Function to test rate limiting
test_rate_limiting() {
    log_info "Testing rate limiting functionality..."
    
    local test_requests=150
    local response=$(curl -s -X POST "${API_BASE_URL}/api/security/testing/test-rate-limiting" \
        -H "X-Security-Testing-Key: ${SECURITY_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"requestCount\": ${test_requests}}" \
        -w "HTTP_CODE:%{http_code}")
    
    local http_code=$(echo "${response}" | grep "HTTP_CODE:" | cut -d: -f2)
    local body=$(echo "${response}" | sed 's/HTTP_CODE:.*//g')
    
    if [[ "${http_code}" == "200" ]]; then
        log_success "Rate limiting test completed successfully"
        echo "${body}" > "${RATE_LIMIT_REPORT}"
        
        if command -v jq &> /dev/null; then
            local successful_requests=$(echo "${body}" | jq -r '.successfulRequests // "N/A"')
            local rate_limited_requests=$(echo "${body}" | jq -r '.rateLimitedRequests // "N/A"')
            local effective=$(echo "${body}" | jq -r '.rateLimitingEffective // false')
            
            log_info "Successful Requests: ${successful_requests}"
            log_info "Rate Limited Requests: ${rate_limited_requests}"
            
            if [[ "${effective}" == "true" ]]; then
                log_success "Rate limiting is working effectively"
            else
                log_warning "Rate limiting may not be working as expected"
            fi
        fi
    else
        log_error "Rate limiting test failed. HTTP Code: ${http_code}"
        echo "${body}" > "${RATE_LIMIT_REPORT}.error"
        return 1
    fi
}

# Function to test SQL injection vulnerabilities
test_sql_injection() {
    log_info "Testing SQL injection vulnerabilities..."
    
    local payload='{
        "username": "admin'\''--",
        "password": "'\'' OR 1=1 --",
        "search": "'\'' UNION SELECT * FROM users --",
        "id": "1; DROP TABLE users; --"
    }'
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/security/testing/test-sql-injection" \
        -H "X-Security-Testing-Key: ${SECURITY_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "${payload}" \
        -w "HTTP_CODE:%{http_code}")
    
    local http_code=$(echo "${response}" | grep "HTTP_CODE:" | cut -d: -f2)
    local body=$(echo "${response}" | sed 's/HTTP_CODE:.*//g')
    
    if [[ "${http_code}" == "200" ]]; then
        log_success "SQL injection test completed successfully"
        echo "${body}" > "${SQL_INJECTION_REPORT}"
        
        if command -v jq &> /dev/null; then
            local vulnerabilities_found=$(echo "${body}" | jq -r '.vulnerabilitiesFound // "N/A"')
            local is_secure=$(echo "${body}" | jq -r '.isSecure // false')
            
            log_info "SQL Injection Vulnerabilities Found: ${vulnerabilities_found}"
            
            if [[ "${is_secure}" == "true" ]]; then
                log_success "Application is secure against SQL injection"
            else
                log_error "SQL injection vulnerabilities detected!"
            fi
        fi
    else
        log_error "SQL injection test failed. HTTP Code: ${http_code}"
        echo "${body}" > "${SQL_INJECTION_REPORT}.error"
        return 1
    fi
}

# Function to test XSS vulnerabilities
test_xss_vulnerabilities() {
    log_info "Testing XSS vulnerabilities..."
    
    local response=$(curl -s -X POST "${API_BASE_URL}/api/security/testing/test-xss" \
        -H "X-Security-Testing-Key: ${SECURITY_API_KEY}" \
        -H "Content-Type: application/json" \
        -w "HTTP_CODE:%{http_code}")
    
    local http_code=$(echo "${response}" | grep "HTTP_CODE:" | cut -d: -f2)
    local body=$(echo "${response}" | sed 's/HTTP_CODE:.*//g')
    
    if [[ "${http_code}" == "200" ]]; then
        log_success "XSS vulnerability test completed successfully"
        echo "${body}" > "${XSS_REPORT}"
        
        if command -v jq &> /dev/null; then
            local vulnerabilities_found=$(echo "${body}" | jq -r '.vulnerabilitiesFound // "N/A"')
            local is_secure=$(echo "${body}" | jq -r '.isSecure // false')
            
            log_info "XSS Vulnerabilities Found: ${vulnerabilities_found}"
            
            if [[ "${is_secure}" == "true" ]]; then
                log_success "Application is secure against XSS attacks"
            else
                log_error "XSS vulnerabilities detected!"
            fi
        fi
    else
        log_error "XSS vulnerability test failed. HTTP Code: ${http_code}"
        echo "${body}" > "${XSS_REPORT}.error"
        return 1
    fi
}

# Function to test security headers
test_security_headers() {
    log_info "Testing security headers..."
    
    local response=$(curl -s -I "${API_BASE_URL}/api/health/status")
    
    # Check for essential security headers
    local headers_check=""
    
    if echo "${response}" | grep -qi "strict-transport-security"; then
        log_success "✓ HSTS header present"
        headers_check="${headers_check}HSTS: PASS\n"
    else
        log_warning "✗ HSTS header missing"
        headers_check="${headers_check}HSTS: FAIL\n"
    fi
    
    if echo "${response}" | grep -qi "x-content-type-options"; then
        log_success "✓ X-Content-Type-Options header present"
        headers_check="${headers_check}X-Content-Type-Options: PASS\n"
    else
        log_warning "✗ X-Content-Type-Options header missing"
        headers_check="${headers_check}X-Content-Type-Options: FAIL\n"
    fi
    
    if echo "${response}" | grep -qi "x-frame-options"; then
        log_success "✓ X-Frame-Options header present"
        headers_check="${headers_check}X-Frame-Options: PASS\n"
    else
        log_warning "✗ X-Frame-Options header missing"
        headers_check="${headers_check}X-Frame-Options: FAIL\n"
    fi
    
    if echo "${response}" | grep -qi "content-security-policy"; then
        log_success "✓ Content-Security-Policy header present"
        headers_check="${headers_check}Content-Security-Policy: PASS\n"
    else
        log_warning "✗ Content-Security-Policy header missing"
        headers_check="${headers_check}Content-Security-Policy: FAIL\n"
    fi
    
    echo -e "${headers_check}" >> "${SUMMARY_REPORT}"
}

# Function to generate security summary report
generate_summary_report() {
    log_info "Generating security summary report..."
    
    cat > "${SUMMARY_REPORT}" << EOF
# Security Assessment Summary Report
Generated: $(date)
API Base URL: ${API_BASE_URL}
Test Timestamp: ${TIMESTAMP}

## Test Results Overview

EOF

    # Add individual test results if files exist
    if [[ -f "${VULNERABILITY_REPORT}" ]]; then
        echo "### Vulnerability Scan: COMPLETED" >> "${SUMMARY_REPORT}"
        if command -v jq &> /dev/null; then
            local score=$(jq -r '.overallSecurityScore // "N/A"' "${VULNERABILITY_REPORT}")
            echo "Security Score: ${score}%" >> "${SUMMARY_REPORT}"
        fi
        echo "" >> "${SUMMARY_REPORT}"
    fi
    
    if [[ -f "${RATE_LIMIT_REPORT}" ]]; then
        echo "### Rate Limiting Test: COMPLETED" >> "${SUMMARY_REPORT}"
        if command -v jq &> /dev/null; then
            local effective=$(jq -r '.rateLimitingEffective // false' "${RATE_LIMIT_REPORT}")
            echo "Rate Limiting Effective: ${effective}" >> "${SUMMARY_REPORT}"
        fi
        echo "" >> "${SUMMARY_REPORT}"
    fi
    
    if [[ -f "${SQL_INJECTION_REPORT}" ]]; then
        echo "### SQL Injection Test: COMPLETED" >> "${SUMMARY_REPORT}"
        if command -v jq &> /dev/null; then
            local secure=$(jq -r '.isSecure // false' "${SQL_INJECTION_REPORT}")
            echo "SQL Injection Secure: ${secure}" >> "${SUMMARY_REPORT}"
        fi
        echo "" >> "${SUMMARY_REPORT}"
    fi
    
    if [[ -f "${XSS_REPORT}" ]]; then
        echo "### XSS Vulnerability Test: COMPLETED" >> "${SUMMARY_REPORT}"
        if command -v jq &> /dev/null; then
            local secure=$(jq -r '.isSecure // false' "${XSS_REPORT}")
            echo "XSS Secure: ${secure}" >> "${SUMMARY_REPORT}"
        fi
        echo "" >> "${SUMMARY_REPORT}"
    fi
    
    cat >> "${SUMMARY_REPORT}" << EOF

## Report Files Generated:
- Vulnerability Scan: ${VULNERABILITY_REPORT}
- Rate Limiting Test: ${RATE_LIMIT_REPORT}
- SQL Injection Test: ${SQL_INJECTION_REPORT}
- XSS Test: ${XSS_REPORT}
- Summary Report: ${SUMMARY_REPORT}

## Next Steps:
1. Review detailed test results in individual report files
2. Address any identified vulnerabilities
3. Re-run tests after implementing fixes
4. Schedule regular security assessments

For questions or support, contact: security@modulo.com
EOF

    log_success "Summary report generated: ${SUMMARY_REPORT}"
}

# Function to display usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  --help              Show this help message"
    echo "  --vulnerability     Run only vulnerability scan"
    echo "  --rate-limit        Run only rate limiting test"
    echo "  --sql-injection     Run only SQL injection test"
    echo "  --xss               Run only XSS test"
    echo "  --headers           Run only security headers test"
    echo "  --all               Run all tests (default)"
    echo ""
    echo "Environment Variables:"
    echo "  API_BASE_URL        Base URL of the API (default: https://api.modulo.com)"
    echo "  SECURITY_API_KEY    Security testing API key (required)"
    echo "  ADMIN_TOKEN         Admin authentication token (required)"
    echo "  OUTPUT_DIR          Output directory for reports (default: ./security-reports)"
    echo ""
    echo "Examples:"
    echo "  export SECURITY_API_KEY=your-api-key"
    echo "  export ADMIN_TOKEN=your-admin-token"
    echo "  $0 --all"
    echo "  $0 --vulnerability"
}

# Main execution function
main() {
    local run_vulnerability=false
    local run_rate_limit=false
    local run_sql_injection=false
    local run_xss=false
    local run_headers=false
    local run_all=true
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_usage
                exit 0
                ;;
            --vulnerability)
                run_vulnerability=true
                run_all=false
                ;;
            --rate-limit)
                run_rate_limit=true
                run_all=false
                ;;
            --sql-injection)
                run_sql_injection=true
                run_all=false
                ;;
            --xss)
                run_xss=true
                run_all=false
                ;;
            --headers)
                run_headers=true
                run_all=false
                ;;
            --all)
                run_all=true
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
        shift
    done
    
    # Run checks
    check_prerequisites
    test_connectivity
    
    log_info "Starting security assessment..."
    log_info "Output directory: ${OUTPUT_DIR}"
    
    # Run selected tests
    local test_failures=0
    
    if [[ "${run_all}" == "true" ]] || [[ "${run_vulnerability}" == "true" ]]; then
        run_vulnerability_scan || ((test_failures++))
    fi
    
    if [[ "${run_all}" == "true" ]] || [[ "${run_rate_limit}" == "true" ]]; then
        test_rate_limiting || ((test_failures++))
    fi
    
    if [[ "${run_all}" == "true" ]] || [[ "${run_sql_injection}" == "true" ]]; then
        test_sql_injection || ((test_failures++))
    fi
    
    if [[ "${run_all}" == "true" ]] || [[ "${run_xss}" == "true" ]]; then
        test_xss_vulnerabilities || ((test_failures++))
    fi
    
    if [[ "${run_all}" == "true" ]] || [[ "${run_headers}" == "true" ]]; then
        test_security_headers || ((test_failures++))
    fi
    
    # Generate summary report
    generate_summary_report
    
    # Final results
    if [[ "${test_failures}" -eq 0 ]]; then
        log_success "All security tests completed successfully!"
        log_info "Review the summary report: ${SUMMARY_REPORT}"
    else
        log_error "${test_failures} security tests failed!"
        log_info "Check the error files in ${OUTPUT_DIR}"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
