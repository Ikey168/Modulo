package com.modulo.contract;

import org.junit.platform.suite.api.SelectPackages;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

/**
 * Contract Test Suite
 * Runs all contract tests including OpenAPI, Pact, and JSON Schema validation
 */
@Suite
@SuiteDisplayName("API Contract Test Suite")
@SelectPackages("com.modulo.contract")
public class ContractTestSuite {
    // This class serves as a test suite runner
    // All contract tests in the com.modulo.contract package will be executed
}
