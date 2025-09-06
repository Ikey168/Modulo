package com.modulo.integration;

import org.junit.platform.suite.api.IncludeClassNamePatterns;
import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Integration Test Suite
 * Runs all end-to-end integration tests in the correct order
 */
@Suite
@SuiteDisplayName("End-to-End Integration Test Suite")
@SelectPackages("com.modulo.integration")
@IncludeClassNamePatterns(".*IntegrationTest")
class IntegrationTestSuite {
    
    // Test execution order:
    // 1. DatabaseIntegrationTest - Tests core database functionality
    // 2. ExternalServicesIntegrationTest - Tests external service interactions
    // 3. BlockchainServiceIntegrationTest - Tests blockchain service integration
    // 4. FullStackIntegrationTest - Tests complete application workflows
    // 5. MultiServiceIntegrationTest - Tests complex multi-service scenarios
    
    // The @Suite annotation will automatically discover and run all tests
    // matching the package and naming pattern
}
