#!/bin/bash

# JaCoCo Coverage Analysis Script for Modulo Backend
# This script provides easy commands to run coverage analysis

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"

echo -e "${BLUE}🎯 Modulo Backend JaCoCo Coverage Analysis${NC}"
echo "============================================="

# Function to print usage
print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  test       - Run tests and generate basic coverage report"
    echo "  coverage   - Run comprehensive coverage analysis with stricter thresholds"
    echo "  ci         - Run CI-compatible coverage check with build failure on low coverage"
    echo "  clean      - Clean previous coverage reports"
    echo "  view       - Open HTML coverage report in browser"
    echo "  help       - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 test        # Basic coverage"
    echo "  $0 coverage    # Detailed analysis"
    echo "  $0 ci         # CI pipeline check"
}

# Function to clean coverage reports
clean_reports() {
    echo -e "${YELLOW}🧹 Cleaning previous coverage reports...${NC}"
    rm -rf "$BACKEND_DIR/target/site/jacoco"*
    rm -rf "$BACKEND_DIR/target/jacoco"*
    rm -f "$BACKEND_DIR/target"/*.exec
    echo -e "${GREEN}✅ Coverage reports cleaned${NC}"
}

# Function to run basic tests with coverage
run_tests() {
    echo -e "${BLUE}🧪 Running tests with basic coverage analysis...${NC}"
    cd "$BACKEND_DIR"
    
    if mvn clean test jacoco:report; then
        echo -e "${GREEN}✅ Tests completed successfully${NC}"
        show_coverage_summary
    else
        echo -e "${RED}❌ Tests failed${NC}"
        exit 1
    fi
}

# Function to run comprehensive coverage analysis
run_coverage_analysis() {
    echo -e "${BLUE}📊 Running comprehensive coverage analysis...${NC}"
    cd "$BACKEND_DIR"
    
    if mvn clean verify -Pcoverage; then
        echo -e "${GREEN}✅ Coverage analysis completed successfully${NC}"
        show_coverage_summary
        echo -e "${BLUE}📈 Detailed coverage reports generated${NC}"
    else
        echo -e "${RED}❌ Coverage analysis failed${NC}"
        exit 1
    fi
}

# Function to run CI coverage check
run_ci_check() {
    echo -e "${BLUE}🔍 Running CI coverage check...${NC}"
    cd "$BACKEND_DIR"
    
    if mvn clean verify -Pci; then
        echo -e "${GREEN}✅ CI coverage check passed${NC}"
        show_coverage_summary
    else
        echo -e "${RED}❌ CI coverage check failed - Coverage below threshold${NC}"
        echo -e "${YELLOW}💡 Check the coverage reports to identify areas needing more tests${NC}"
        exit 1
    fi
}

# Function to show coverage summary
show_coverage_summary() {
    echo ""
    echo -e "${BLUE}📋 Coverage Reports Generated:${NC}"
    
    if [ -d "$BACKEND_DIR/target/site/jacoco" ]; then
        echo -e "${GREEN}  📄 Unit Test Coverage: target/site/jacoco/index.html${NC}"
    fi
    
    if [ -d "$BACKEND_DIR/target/site/jacoco-merged" ]; then
        echo -e "${GREEN}  📄 Complete Coverage: target/site/jacoco-merged/index.html${NC}"
    fi
    
    if [ -d "$BACKEND_DIR/target/site/jacoco-analysis" ]; then
        echo -e "${GREEN}  📄 Detailed Analysis: target/site/jacoco-analysis/index.html${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 Tip: Use '$0 view' to open the coverage report in your browser${NC}"
}

# Function to open coverage report
view_report() {
    local report_path=""
    
    # Check for different report types in order of preference
    if [ -f "$BACKEND_DIR/target/site/jacoco-merged/index.html" ]; then
        report_path="$BACKEND_DIR/target/site/jacoco-merged/index.html"
        echo -e "${BLUE}Opening complete coverage report...${NC}"
    elif [ -f "$BACKEND_DIR/target/site/jacoco-analysis/index.html" ]; then
        report_path="$BACKEND_DIR/target/site/jacoco-analysis/index.html"
        echo -e "${BLUE}Opening detailed analysis report...${NC}"
    elif [ -f "$BACKEND_DIR/target/site/jacoco/index.html" ]; then
        report_path="$BACKEND_DIR/target/site/jacoco/index.html"
        echo -e "${BLUE}Opening unit test coverage report...${NC}"
    else
        echo -e "${RED}❌ No coverage reports found${NC}"
        echo -e "${YELLOW}💡 Run '$0 test' or '$0 coverage' first to generate reports${NC}"
        exit 1
    fi
    
    # Open in browser
    if command -v xdg-open > /dev/null; then
        xdg-open "$report_path"
    elif command -v open > /dev/null; then
        open "$report_path"
    else
        echo -e "${GREEN}✅ Coverage report is available at: $report_path${NC}"
    fi
}

# Main script logic
case "${1:-help}" in
    "test")
        run_tests
        ;;
    "coverage")
        run_coverage_analysis
        ;;
    "ci")
        run_ci_check
        ;;
    "clean")
        clean_reports
        ;;
    "view")
        view_report
        ;;
    "help"|*)
        print_usage
        ;;
esac

echo -e "${BLUE}🎯 JaCoCo Coverage Analysis Complete${NC}"
