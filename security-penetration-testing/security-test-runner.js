#!/usr/bin/env node

const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;
const { createMultiBar } = require('./utils/progress-utils');
const SecurityReporter = require('./utils/security-reporter');

// Import all test runners
const OWASPTestRunner = require('./tests/owasp-top-10/owasp-test-runner');
const InjectionTestRunner = require('./tests/injection/injection-test-runner');
const AuthSecurityTest = require('./tests/authentication/auth-security-test');
const NetworkSecurityTest = require('./tests/network/network-security-test');
const APISecurityTest = require('./tests/api/api-security-test');
const DynamicSecurityTest = require('./tests/dynamic/dast-test-runner');

/**
 * Main Security Penetration Testing Runner
 * Orchestrates all security test suites and generates comprehensive reports
 */
class SecurityPenetrationTestRunner {
    constructor(config = {}) {
        this.config = {
            baseUrl: config.baseUrl || process.env.TEST_TARGET_URL || 'http://localhost:3000',
            apiUrl: config.apiUrl || process.env.API_TARGET_URL || 'http://localhost:8080',
            apiKey: config.apiKey || process.env.API_KEY || 'test-api-key',
            timeout: config.timeout || 30000,
            parallel: config.parallel || false,
            outputDir: config.outputDir || './results',
            ...config
        };
        
        this.testSuites = [
            { name: 'OWASP Top 10', runner: OWASPTestRunner },
            { name: 'Injection Vulnerabilities', runner: InjectionTestRunner },
            { name: 'Authentication Security', runner: AuthSecurityTest },
            { name: 'Network Security', runner: NetworkSecurityTest },
            { name: 'API Security', runner: APISecurityTest },
            { name: 'Dynamic Application Security Testing', runner: DynamicSecurityTest }
        ];
        
        this.results = {
            suiteResults: [],
            overallScore: 0,
            status: 'UNKNOWN',
            vulnerabilities: [],
            summary: {},
            timestamp: new Date().toISOString(),
            config: this.config
        };
        
        this.reporter = new SecurityReporter();
    }

    async runAllTests() {
        console.log(chalk.blue.bold('\n🛡️  SECURITY PENETRATION TESTING FRAMEWORK\n'));
        console.log(chalk.white(`Target Application: ${this.config.baseUrl}`));
        console.log(chalk.white(`API Endpoint: ${this.config.apiUrl}`));
        console.log(chalk.white(`Test Suites: ${this.testSuites.length}`));
        console.log(chalk.white(`Parallel Execution: ${this.config.parallel ? 'Enabled' : 'Disabled'}\n`));
        
        const startTime = Date.now();
        
        try {
            // Create output directory
            await fs.mkdir(this.config.outputDir, { recursive: true });
            
            if (this.config.parallel) {
                await this.runTestsParallel();
            } else {
                await this.runTestsSequential();
            }
            
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            
            await this.calculateOverallResults();
            await this.generateFinalReport(duration);
            
            return this.results;
            
        } catch (error) {
            console.error(chalk.red.bold(`\n❌ Security testing failed: ${error.message}`));
            throw error;
        }
    }

    async runTestsSequential() {
        console.log(chalk.yellow('🔄 Running security tests sequentially...\n'));
        
        const multiBar = createMultiBar('Security Test Suites Progress');
        const progressBars = {};
        
        // Initialize progress bars for each test suite
        this.testSuites.forEach(suite => {
            progressBars[suite.name] = multiBar.create(100, 0, {
                suite: suite.name.padEnd(35),
                status: 'Waiting...'
            });
        });
        
        for (const [index, testSuite] of this.testSuites.entries()) {
            const progressBar = progressBars[testSuite.name];
            
            try {
                progressBar.update(10, { status: 'Starting...' });
                
                console.log(chalk.blue(`\n📋 Running ${testSuite.name} Tests...`));
                
                const runner = new testSuite.runner(this.config);
                
                progressBar.update(30, { status: 'Running...' });
                
                const suiteResults = await runner.runAllTests();
                
                progressBar.update(90, { status: 'Completing...' });
                
                this.results.suiteResults.push({
                    suiteName: testSuite.name,
                    ...suiteResults
                });
                
                progressBar.update(100, { 
                    status: suiteResults.overallScore >= 80 ? 'PASSED' : 'FAILED' 
                });
                
                console.log(chalk.green(`✅ ${testSuite.name} completed: ${suiteResults.overallScore}%`));
                
            } catch (error) {
                progressBar.update(100, { status: 'ERROR' });
                console.error(chalk.red(`❌ ${testSuite.name} failed: ${error.message}`));
                
                this.results.suiteResults.push({
                    suiteName: testSuite.name,
                    overallScore: 0,
                    status: 'ERROR',
                    error: error.message,
                    testResults: [],
                    vulnerabilities: []
                });
            }
        }
        
        multiBar.stop();
    }

    async runTestsParallel() {
        console.log(chalk.yellow('🔄 Running security tests in parallel...\n'));
        
        const multiBar = createMultiBar('Security Test Suites Progress');
        const progressBars = {};
        
        // Initialize progress bars for each test suite
        this.testSuites.forEach(suite => {
            progressBars[suite.name] = multiBar.create(100, 0, {
                suite: suite.name.padEnd(35),
                status: 'Starting...'
            });
        });
        
        const testPromises = this.testSuites.map(async (testSuite) => {
            const progressBar = progressBars[testSuite.name];
            
            try {
                progressBar.update(20, { status: 'Running...' });
                
                const runner = new testSuite.runner(this.config);
                const suiteResults = await runner.runAllTests();
                
                progressBar.update(100, { 
                    status: suiteResults.overallScore >= 80 ? 'PASSED' : 'FAILED' 
                });
                
                return {
                    suiteName: testSuite.name,
                    ...suiteResults
                };
                
            } catch (error) {
                progressBar.update(100, { status: 'ERROR' });
                console.error(chalk.red(`❌ ${testSuite.name} failed: ${error.message}`));
                
                return {
                    suiteName: testSuite.name,
                    overallScore: 0,
                    status: 'ERROR',
                    error: error.message,
                    testResults: [],
                    vulnerabilities: []
                };
            }
        });
        
        this.results.suiteResults = await Promise.all(testPromises);
        multiBar.stop();
    }

    async calculateOverallResults() {
        // Calculate overall score
        const validSuites = this.results.suiteResults.filter(suite => !suite.error);
        const totalScore = validSuites.reduce((sum, suite) => sum + suite.overallScore, 0);
        this.results.overallScore = validSuites.length > 0 ? Math.round(totalScore / validSuites.length) : 0;
        
        // Determine overall status
        this.results.status = this.results.overallScore >= 80 ? 'PASS' : 'FAIL';
        
        // Aggregate vulnerabilities
        this.results.vulnerabilities = this.results.suiteResults
            .flatMap(suite => (suite.vulnerabilities || []).map(vuln => ({
                ...vuln,
                suite: suite.suiteName
            })));
        
        // Create summary
        this.results.summary = {
            totalSuites: this.testSuites.length,
            passedSuites: this.results.suiteResults.filter(s => s.overallScore >= 80).length,
            failedSuites: this.results.suiteResults.filter(s => s.overallScore < 80 && !s.error).length,
            errorSuites: this.results.suiteResults.filter(s => s.error).length,
            totalVulnerabilities: this.results.vulnerabilities.length,
            criticalVulnerabilities: this.results.vulnerabilities.filter(v => v.severity === 'Critical').length,
            highVulnerabilities: this.results.vulnerabilities.filter(v => v.severity === 'High').length,
            mediumVulnerabilities: this.results.vulnerabilities.filter(v => v.severity === 'Medium').length,
            lowVulnerabilities: this.results.vulnerabilities.filter(v => v.severity === 'Low').length
        };
    }

    async generateFinalReport(duration) {
        console.log(chalk.blue.bold('\n📊 SECURITY PENETRATION TESTING RESULTS\n'));
        console.log(chalk.white('═'.repeat(60)));
        console.log(chalk.white(`Overall Security Score: ${this.getScoreColor(this.results.overallScore)}${this.results.overallScore}%${chalk.white}`));
        console.log(chalk.white(`Overall Status: ${this.results.status === 'PASS' ? chalk.green('PASS') : chalk.red('FAIL')}`));
        console.log(chalk.white(`Test Duration: ${duration}s`));
        console.log(chalk.white('═'.repeat(60)));
        
        // Test Suite Results
        console.log(chalk.blue.bold('\n📋 Test Suite Results:'));
        this.results.suiteResults.forEach(suite => {
            const status = suite.error ? chalk.red('ERROR') : 
                          suite.overallScore >= 80 ? chalk.green('PASS') : chalk.red('FAIL');
            const score = suite.error ? 'N/A' : `${this.getScoreColor(suite.overallScore)}${suite.overallScore}%${chalk.white}`;
            console.log(chalk.white(`  • ${suite.suiteName.padEnd(35)} ${score} ${status}`));
        });
        
        // Summary Statistics
        console.log(chalk.blue.bold('\n📈 Summary Statistics:'));
        console.log(chalk.white(`  • Total Test Suites: ${this.results.summary.totalSuites}`));
        console.log(chalk.white(`  • Passed Suites: ${chalk.green(this.results.summary.passedSuites)}`));
        console.log(chalk.white(`  • Failed Suites: ${chalk.red(this.results.summary.failedSuites)}`));
        if (this.results.summary.errorSuites > 0) {
            console.log(chalk.white(`  • Error Suites: ${chalk.red(this.results.summary.errorSuites)}`));
        }
        
        // Vulnerability Summary
        if (this.results.vulnerabilities.length > 0) {
            console.log(chalk.red.bold('\n⚠️  Vulnerability Summary:'));
            console.log(chalk.white(`  • Total Vulnerabilities: ${this.results.summary.totalVulnerabilities}`));
            if (this.results.summary.criticalVulnerabilities > 0) {
                console.log(chalk.white(`  • Critical: ${chalk.red(this.results.summary.criticalVulnerabilities)}`));
            }
            if (this.results.summary.highVulnerabilities > 0) {
                console.log(chalk.white(`  • High: ${chalk.red(this.results.summary.highVulnerabilities)}`));
            }
            if (this.results.summary.mediumVulnerabilities > 0) {
                console.log(chalk.white(`  • Medium: ${chalk.yellow(this.results.summary.mediumVulnerabilities)}`));
            }
            if (this.results.summary.lowVulnerabilities > 0) {
                console.log(chalk.white(`  • Low: ${chalk.blue(this.results.summary.lowVulnerabilities)}`));
            }
            
            // Show top vulnerabilities
            const topVulnerabilities = this.results.vulnerabilities
                .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
                .slice(0, 5);
            
            console.log(chalk.red.bold('\n🔍 Top Vulnerabilities:'));
            topVulnerabilities.forEach((vuln, index) => {
                console.log(chalk.red(`  ${index + 1}. ${vuln.name} (${vuln.severity}) - ${vuln.suite}`));
                console.log(chalk.gray(`     ${vuln.details}`));
            });
        } else {
            console.log(chalk.green.bold('\n✅ No vulnerabilities found!'));
        }
        
        // Generate comprehensive reports
        await this.generateJSONReport();
        await this.generateHTMLReport();
        
        console.log(chalk.blue.bold('\n📄 Reports Generated:'));
        console.log(chalk.white(`  • JSON Report: ${path.join(this.config.outputDir, 'penetration-test-report.json')}`));
        console.log(chalk.white(`  • HTML Report: ${path.join(this.config.outputDir, 'penetration-test-report.html')}`));
        
        // Exit with appropriate code
        if (this.results.status === 'FAIL' || this.results.summary.criticalVulnerabilities > 0) {
            console.log(chalk.red.bold('\n🚨 Security testing completed with failures or critical vulnerabilities!'));
            if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
                process.exit(1);
            }
        } else {
            console.log(chalk.green.bold('\n🎉 Security testing completed successfully!'));
        }
    }

    async generateJSONReport() {
        const reportPath = path.join(this.config.outputDir, 'penetration-test-report.json');
        await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    }

    async generateHTMLReport() {
        const htmlReport = await this.reporter.generateHTMLReport(this.results);
        const reportPath = path.join(this.config.outputDir, 'penetration-test-report.html');
        await fs.writeFile(reportPath, htmlReport);
    }

    getScoreColor(score) {
        if (score >= 90) return chalk.green;
        if (score >= 80) return chalk.yellow;
        if (score >= 60) return chalk.orange;
        return chalk.red;
    }

    getSeverityWeight(severity) {
        const weights = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        return weights[severity] || 0;
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const config = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];
        
        switch (flag) {
            case '--base-url':
                config.baseUrl = value;
                break;
            case '--api-url':
                config.apiUrl = value;
                break;
            case '--api-key':
                config.apiKey = value;
                break;
            case '--output-dir':
                config.outputDir = value;
                break;
            case '--parallel':
                config.parallel = true;
                i--; // No value for this flag
                break;
            case '--timeout':
                config.timeout = parseInt(value);
                break;
            case '--help':
                console.log(`
Security Penetration Testing Framework

Usage: node security-test-runner.js [options]

Options:
  --base-url <url>     Base URL of the web application (default: http://localhost:3000)
  --api-url <url>      API URL for backend testing (default: http://localhost:8080)
  --api-key <key>      API key for authentication (default: test-api-key)
  --output-dir <dir>   Output directory for reports (default: ./results)
  --parallel           Run tests in parallel (default: false)
  --timeout <ms>       Request timeout in milliseconds (default: 30000)
  --help               Show this help message

Environment Variables:
  TEST_TARGET_URL      Base URL of the web application
  API_TARGET_URL       API URL for backend testing
  API_KEY              API key for authentication

Examples:
  node security-test-runner.js --base-url http://localhost:3000 --api-url http://localhost:8080
  node security-test-runner.js --parallel --output-dir ./security-results
`);
                process.exit(0);
                break;
        }
    }
    
    const runner = new SecurityPenetrationTestRunner(config);
    runner.runAllTests().catch(error => {
        console.error(chalk.red.bold('\n❌ Security testing failed:'));
        console.error(chalk.red(error.message));
        if (error.stack) {
            console.error(chalk.gray(error.stack));
        }
        process.exit(1);
    });
}

module.exports = SecurityPenetrationTestRunner;
