#!/bin/bash

# AuthN/Z Performance Test Runner
# This script runs comprehensive performance and resilience tests for the AuthN/Z path

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8081}"
ENVOY_URL="${ENVOY_URL:-http://localhost:8080}"
RESULTS_DIR="results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AuthN/Z Performance & Resilience Tests${NC}"
echo "=================================================="
echo "Base URL: $BASE_URL"
echo "Envoy URL: $ENVOY_URL"
echo "Results Directory: $RESULTS_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to check if services are running
check_services() {
    echo -e "${YELLOW}🔍 Checking service availability...${NC}"
    
    # Check backend
    if curl -s -f "$BASE_URL/actuator/health" > /dev/null; then
        echo -e "${GREEN}✅ Backend service is running${NC}"
    else
        echo -e "${RED}❌ Backend service is not available at $BASE_URL${NC}"
        exit 1
    fi
    
    # Check Envoy (optional for some tests)
    if curl -s -f "$ENVOY_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Envoy proxy is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Envoy proxy not available - some tests will be skipped${NC}"
    fi
    echo ""
}

# Function to run a specific test scenario
run_test() {
    local scenario=$1
    local description=$2
    local additional_options=$3
    
    echo -e "${BLUE}📊 Running $description...${NC}"
    echo "Scenario: $scenario"
    
    local result_file="$RESULTS_DIR/authz-${scenario}-${TIMESTAMP}.json"
    local log_file="$RESULTS_DIR/authz-${scenario}-${TIMESTAMP}.log"
    
    # Run k6 test
    if k6 run \
        --env BASE_URL="$BASE_URL" \
        --env ENVOY_URL="$ENVOY_URL" \
        --env TEST_SCENARIO="$scenario" \
        --out json="$result_file" \
        $additional_options \
        k6-tests/authz-performance.js 2>&1 | tee "$log_file"; then
        echo -e "${GREEN}✅ $description completed successfully${NC}"
    else
        echo -e "${RED}❌ $description failed${NC}"
        return 1
    fi
    
    echo ""
}

# Function to analyze results
analyze_results() {
    echo -e "${BLUE}📈 Analyzing test results...${NC}"
    
    # Look for the latest benchmark results
    local latest_results=$(ls -t "$RESULTS_DIR"/authz-*-"$TIMESTAMP".json 2>/dev/null | head -1)
    
    if [[ -n "$latest_results" && -f "$latest_results" ]]; then
        echo "Latest results file: $latest_results"
        
        # Extract key metrics using jq if available
        if command -v jq >/dev/null 2>&1; then
            echo -e "${YELLOW}Key Metrics Summary:${NC}"
            
            # Authorization overhead
            authz_p95=$(jq -r '.metrics.authz_overhead.values["p(95)"] // "N/A"' "$latest_results")
            echo "  Authorization Overhead (p95): ${authz_p95}ms"
            
            # Login latency
            login_p95=$(jq -r '.metrics.login_latency.values["p(95)"] // "N/A"' "$latest_results")
            echo "  Login Latency (p95): ${login_p95}ms"
            
            # CRUD latency
            crud_p95=$(jq -r '.metrics.crud_latency.values["p(95)"] // "N/A"' "$latest_results")
            echo "  CRUD Latency (p95): ${crud_p95}ms"
            
            # Error rate
            error_rate=$(jq -r '.metrics.http_req_failed.values.rate // "N/A"' "$latest_results")
            echo "  Error Rate: $(echo "$error_rate * 100" | bc -l 2>/dev/null || echo "N/A")%"
            
        else
            echo "jq not available - install jq for detailed metrics analysis"
        fi
    else
        echo "No results files found"
    fi
    echo ""
}

# Function to generate report
generate_report() {
    echo -e "${BLUE}📋 Generating comprehensive report...${NC}"
    
    local report_file="$RESULTS_DIR/authz-performance-report-${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# AuthN/Z Performance Test Report

**Generated:** $(date)  
**Test Run ID:** $TIMESTAMP

## Test Configuration

- **Base URL:** $BASE_URL
- **Envoy URL:** $ENVOY_URL
- **Test Duration:** Multiple scenarios (30s - 9m)
- **Results Directory:** $RESULTS_DIR

## Test Scenarios Executed

1. **Smoke Test**: Basic functionality validation (1 user, 30s)
2. **Normal Load**: Expected production load (10 users, 9m)
3. **Stress Test**: High load testing (50 users, 5m)
4. **Failure Injection**: Resilience testing (5 users, 2m)

## Results Summary

See individual JSON result files for detailed metrics:

EOF

    # List all result files
    ls -la "$RESULTS_DIR"/*-"$TIMESTAMP".* | while read -r line; do
        echo "- $(basename "${line##* }")" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## SLA Validation

| Metric | SLA | Status | Notes |
|--------|-----|--------|-------|
| Authorization Overhead (p95) | < 20ms | TBD | Check JSON results |
| Login Latency (p95) | < 1000ms | TBD | Check JSON results |
| CRUD Operations (p95) | < 500ms | TBD | Check JSON results |
| Error Rate | < 10% | TBD | Check JSON results |
| Graceful Degradation | > 90% | TBD | Check JSON results |

## Next Steps

1. Review detailed metrics in JSON result files
2. Compare with baseline performance
3. Investigate any SLA violations
4. Update performance tuning if needed

---

*Report generated by authz-performance-test.sh*
EOF

    echo "Report generated: $report_file"
    echo ""
}

# Main execution flow
main() {
    echo -e "${BLUE}Starting performance test suite...${NC}"
    
    # Check prerequisites
    check_services
    
    # Check for k6
    if ! command -v k6 >/dev/null 2>&1; then
        echo -e "${RED}❌ k6 is not installed. Please install k6 load testing tool.${NC}"
        echo "Visit: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
    echo ""
    
    # Run test scenarios
    echo -e "${YELLOW}🧪 Running test scenarios...${NC}"
    
    # 1. Smoke test
    run_test "smoke" "Smoke Test (Basic Validation)"
    
    # 2. Normal load test
    run_test "normal" "Normal Load Test" 
    
    # 3. Stress test
    run_test "stress" "Stress Test"
    
    # 4. Failure injection test (if chaos mode is enabled)
    if [[ "${CHAOS_MODE:-false}" == "true" ]]; then
        echo -e "${YELLOW}🔥 Chaos mode enabled - running failure injection tests${NC}"
        run_test "failure" "Failure Injection Test" "--env CHAOS_MODE=true"
    else
        echo -e "${YELLOW}⚠️  Chaos mode disabled - skipping failure injection tests${NC}"
        echo "Set CHAOS_MODE=true to enable failure injection testing"
    fi
    
    # Analyze results
    analyze_results
    
    # Generate report
    generate_report
    
    echo -e "${GREEN}🎉 Performance testing completed!${NC}"
    echo ""
    echo "Results available in: $RESULTS_DIR"
    echo "View the benchmark documentation: docs/perf/authz-benchmark.md"
    echo ""
    echo -e "${BLUE}To view detailed results:${NC}"
    echo "  cat $RESULTS_DIR/authz-performance-report-${TIMESTAMP}.md"
    echo ""
    echo -e "${BLUE}To run with chaos mode:${NC}"
    echo "  CHAOS_MODE=true $0"
}

# Run main function
main "$@"
