const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * Security test reporting utilities
 */
class SecurityReporter {
    constructor(testSuite) {
        this.testSuite = testSuite;
        this.startTime = Date.now();
        this.results = [];
    }

    addResult(result) {
        this.results.push({
            ...result,
            timestamp: new Date().toISOString()
        });
    }

    async generateHTMLReport() {
        const endTime = Date.now();
        const duration = Math.round((endTime - this.startTime) / 1000);
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.testSuite} - Security Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f7fa;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            border-bottom: 2px solid #e1e8ed;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1a365d;
            margin: 0 0 10px 0;
        }
        .header .meta {
            color: #718096;
            font-size: 14px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 24px;
        }
        .summary-card p {
            margin: 0;
            opacity: 0.9;
        }
        .test-results {
            margin-bottom: 30px;
        }
        .test-category {
            margin-bottom: 30px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
        }
        .category-header {
            background: #edf2f7;
            padding: 15px 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        .category-header h3 {
            margin: 0;
            color: #2d3748;
        }
        .category-score {
            float: right;
            font-weight: bold;
        }
        .score-excellent { color: #38a169; }
        .score-good { color: #3182ce; }
        .score-warning { color: #d69e2e; }
        .score-poor { color: #e53e3e; }
        .test-item {
            padding: 15px 20px;
            border-bottom: 1px solid #f7fafc;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .test-item:last-child {
            border-bottom: none;
        }
        .test-name {
            font-weight: 500;
        }
        .test-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-pass {
            background: #c6f6d5;
            color: #276749;
        }
        .status-fail {
            background: #fed7d7;
            color: #9b2c2c;
        }
        .test-details {
            color: #718096;
            font-size: 14px;
            margin-top: 5px;
        }
        .vulnerability-section {
            background: #fed7d7;
            border: 1px solid #feb2b2;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .vulnerability-section h3 {
            color: #9b2c2c;
            margin: 0 0 15px 0;
        }
        .vulnerability-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #f56565;
        }
        .severity-critical { border-left-color: #e53e3e; }
        .severity-high { border-left-color: #f56565; }
        .severity-medium { border-left-color: #ed8936; }
        .severity-low { border-left-color: #ecc94b; }
        .footer {
            text-align: center;
            color: #718096;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.testSuite} Security Test Report</h1>
            <div class="meta">
                Generated on ${new Date().toLocaleString()} | Duration: ${duration}s
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>${this.results.length}</h3>
                <p>Total Tests</p>
            </div>
            <div class="summary-card">
                <h3>${this.results.filter(r => r.passed).length}</h3>
                <p>Tests Passed</p>
            </div>
            <div class="summary-card">
                <h3>${this.results.filter(r => !r.passed).length}</h3>
                <p>Vulnerabilities</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round((this.results.filter(r => r.passed).length / this.results.length) * 100)}%</h3>
                <p>Overall Score</p>
            </div>
        </div>
        
        <div class="test-results">
            <h2>Test Results</h2>
            ${this.generateTestResultsHTML()}
        </div>
        
        ${this.generateVulnerabilitiesHTML()}
        
        <div class="footer">
            <p>Security Test Report generated by Modulo Security Testing Framework</p>
        </div>
    </div>
</body>
</html>`;
        
        const resultsDir = path.join(__dirname, '../results');
        await fs.mkdir(resultsDir, { recursive: true });
        await fs.writeFile(
            path.join(resultsDir, `${this.testSuite.toLowerCase().replace(/\s+/g, '-')}-report.html`),
            html
        );
        
        return html;
    }

    generateTestResultsHTML() {
        // Group results by category
        const categories = {};
        this.results.forEach(result => {
            if (!categories[result.category]) {
                categories[result.category] = [];
            }
            categories[result.category].push(result);
        });
        
        return Object.entries(categories).map(([category, tests]) => {
            const passedTests = tests.filter(t => t.passed).length;
            const score = Math.round((passedTests / tests.length) * 100);
            const scoreClass = score >= 90 ? 'score-excellent' : 
                              score >= 75 ? 'score-good' : 
                              score >= 50 ? 'score-warning' : 'score-poor';
            
            return `
                <div class="test-category">
                    <div class="category-header">
                        <h3>
                            ${category}
                            <span class="category-score ${scoreClass}">${score}%</span>
                        </h3>
                    </div>
                    ${tests.map(test => `
                        <div class="test-item">
                            <div>
                                <div class="test-name">${test.name}</div>
                                ${test.details ? `<div class="test-details">${test.details}</div>` : ''}
                            </div>
                            <div class="test-status ${test.passed ? 'status-pass' : 'status-fail'}">
                                ${test.passed ? 'PASS' : 'FAIL'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
    }

    generateVulnerabilitiesHTML() {
        const vulnerabilities = this.results.filter(r => !r.passed);
        
        if (vulnerabilities.length === 0) {
            return '<div class="vulnerability-section"><h3>🎉 No Vulnerabilities Found!</h3><p>All security tests passed successfully.</p></div>';
        }
        
        return `
            <div class="vulnerability-section">
                <h3>⚠️ Vulnerabilities Found (${vulnerabilities.length})</h3>
                ${vulnerabilities.map(vuln => `
                    <div class="vulnerability-item severity-${vuln.severity?.toLowerCase() || 'medium'}">
                        <strong>${vuln.name}</strong>
                        <span style="float: right; color: #666;">${vuln.severity || 'Medium'}</span>
                        <div style="margin-top: 5px; color: #666;">${vuln.details}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async generateJSONReport() {
        const endTime = Date.now();
        const report = {
            testSuite: this.testSuite,
            timestamp: new Date().toISOString(),
            duration: Math.round((endTime - this.startTime) / 1000),
            summary: {
                totalTests: this.results.length,
                passedTests: this.results.filter(r => r.passed).length,
                failedTests: this.results.filter(r => !r.passed).length,
                overallScore: Math.round((this.results.filter(r => r.passed).length / this.results.length) * 100)
            },
            results: this.results,
            vulnerabilities: this.results.filter(r => !r.passed),
            recommendations: this.generateRecommendations()
        };
        
        const resultsDir = path.join(__dirname, '../results');
        await fs.mkdir(resultsDir, { recursive: true });
        await fs.writeFile(
            path.join(resultsDir, `${this.testSuite.toLowerCase().replace(/\s+/g, '-')}-report.json`),
            JSON.stringify(report, null, 2)
        );
        
        return report;
    }

    generateRecommendations() {
        const vulnerabilities = this.results.filter(r => !r.passed);
        const recommendations = [];
        
        vulnerabilities.forEach(vuln => {
            const recommendation = this.getRecommendation(vuln);
            if (recommendation) {
                recommendations.push(recommendation);
            }
        });
        
        return recommendations;
    }

    getRecommendation(vulnerability) {
        const recommendations = {
            'SQL Injection': {
                priority: 'Critical',
                action: 'Use parameterized queries and input validation',
                description: 'Implement prepared statements and validate all user inputs'
            },
            'XSS': {
                priority: 'High',
                action: 'Implement output encoding and Content Security Policy',
                description: 'Encode all user-generated content and implement CSP headers'
            },
            'Authentication Bypass': {
                priority: 'Critical',
                action: 'Review authentication implementation',
                description: 'Ensure proper authentication checks on all protected endpoints'
            },
            'Session Fixation': {
                priority: 'High',
                action: 'Regenerate session IDs after login',
                description: 'Implement session ID regeneration upon successful authentication'
            }
        };
        
        const vulnType = Object.keys(recommendations).find(type => 
            vulnerability.name.toLowerCase().includes(type.toLowerCase())
        );
        
        if (vulnType) {
            return {
                vulnerability: vulnerability.name,
                ...recommendations[vulnType]
            };
        }
        
        return {
            vulnerability: vulnerability.name,
            priority: vulnerability.severity || 'Medium',
            action: 'Review and fix security implementation',
            description: 'Address the identified security vulnerability'
        };
    }

    logResult(result) {
        const status = result.passed ? chalk.green('PASS') : chalk.red('FAIL');
        const severity = result.severity ? chalk.yellow(`[${result.severity}]`) : '';
        
        console.log(`  ${status} ${severity} ${result.name}`);
        if (result.details) {
            console.log(`    ${chalk.gray(result.details)}`);
        }
    }

    logSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;
        const score = Math.round((passed / total) * 100);
        
        console.log(chalk.blue.bold('\n📊 Security Test Summary:'));
        console.log(chalk.white(`Total Tests: ${total}`));
        console.log(chalk.green(`Passed: ${passed}`));
        console.log(chalk.red(`Failed: ${failed}`));
        console.log(chalk.white(`Overall Score: ${score}%`));
        
        if (failed > 0) {
            console.log(chalk.red.bold('\n⚠️  Security Issues Found:'));
            this.results.filter(r => !r.passed).forEach(vuln => {
                console.log(chalk.red(`  • ${vuln.name} (${vuln.severity || 'Unknown'}): ${vuln.details}`));
            });
        } else {
            console.log(chalk.green.bold('\n✅ No security vulnerabilities detected!'));
        }
    }
}

module.exports = {
    SecurityReporter
};
