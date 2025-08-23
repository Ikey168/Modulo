const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Automated Security Scanner for Smart Contracts
 * Performs static analysis and common vulnerability checks
 */
class SmartContractSecurityScanner {
    constructor() {
        this.vulnerabilities = [];
        this.gasOptimizations = [];
        this.securityScore = 100;
    }

    /**
     * Main scan function
     */
    async scanContracts() {
        console.log("🔍 Starting automated security scan...");
        
        // Get all contract files
        const contractsDir = path.join(__dirname, "../contracts");
        const contractFiles = fs.readdirSync(contractsDir).filter(file => file.endsWith(".sol"));
        
        for (const file of contractFiles) {
            console.log(`📄 Scanning ${file}...`);
            await this.scanContract(path.join(contractsDir, file));
        }
        
        // Generate report
        this.generateSecurityReport();
        
        return {
            vulnerabilities: this.vulnerabilities,
            gasOptimizations: this.gasOptimizations,
            securityScore: this.securityScore
        };
    }

    /**
     * Scan individual contract file
     */
    async scanContract(filePath) {
        const content = fs.readFileSync(filePath, "utf8");
        const fileName = path.basename(filePath);
        
        // Static analysis checks
        this.checkAccessControl(content, fileName);
        this.checkReentrancy(content, fileName);
        this.checkIntegerOverflow(content, fileName);
        this.checkInputValidation(content, fileName);
        this.checkGasOptimization(content, fileName);
        this.checkEventSecurity(content, fileName);
        this.checkStorageOptimization(content, fileName);
    }

    /**
     * Check access control patterns
     */
    checkAccessControl(content, fileName) {
        const checks = [
            {
                pattern: /function\s+\w+\s*\([^)]*\)\s+external\s+(?!.*(?:onlyOwner|onlyMinter|hasPermission))/g,
                severity: "MEDIUM",
                message: "External function lacks access control modifier",
                fix: "Add appropriate access control modifier (onlyOwner, onlyMinter, etc.)"
            },
            {
                pattern: /msg\.sender\s*==\s*owner\(\)/g,
                severity: "LOW",
                message: "Direct owner comparison instead of modifier",
                fix: "Use onlyOwner modifier instead of inline owner check"
            },
            {
                pattern: /require\s*\(\s*msg\.sender\s*==\s*owner/g,
                severity: "LOW", 
                message: "Inline ownership check instead of modifier",
                fix: "Replace with onlyOwner modifier for consistency"
            }
        ];

        this.runPatternChecks(content, fileName, checks, "Access Control");
    }

    /**
     * Check reentrancy vulnerabilities
     */
    checkReentrancy(content, fileName) {
        const checks = [
            {
                pattern: /external\s+.*\{[^}]*\w+\.call\s*\([^}]*\}/g,
                severity: "HIGH",
                message: "Potential reentrancy vulnerability with external call",
                fix: "Use ReentrancyGuard or CEI pattern (Checks-Effects-Interactions)"
            },
            {
                pattern: /external\s+.*\{[^}]*transfer\s*\([^}]*(?!nonReentrant)/g,
                severity: "MEDIUM",
                message: "External function with transfer lacks reentrancy protection",
                fix: "Add nonReentrant modifier or use CEI pattern"
            },
            {
                pattern: /ReentrancyGuard/g,
                severity: "INFO",
                message: "✅ ReentrancyGuard detected - good security practice",
                fix: null
            }
        ];

        this.runPatternChecks(content, fileName, checks, "Reentrancy");
    }

    /**
     * Check integer overflow protection
     */
    checkIntegerOverflow(content, fileName) {
        const checks = [
            {
                pattern: /unchecked\s*\{[^}]*\+\+/g,
                severity: "LOW",
                message: "Unchecked increment - ensure overflow is impossible",
                fix: "Verify that overflow cannot occur or use checked arithmetic"
            },
            {
                pattern: /unchecked\s*\{[^}]*\-\-/g,
                severity: "LOW",
                message: "Unchecked decrement - ensure underflow is impossible", 
                fix: "Verify that underflow cannot occur or use checked arithmetic"
            },
            {
                pattern: /pragma solidity \^0\.8\./g,
                severity: "INFO",
                message: "✅ Using Solidity ^0.8.x with built-in overflow protection",
                fix: null
            }
        ];

        this.runPatternChecks(content, fileName, checks, "Integer Safety");
    }

    /**
     * Check input validation
     */
    checkInputValidation(content, fileName) {
        const checks = [
            {
                pattern: /function\s+\w+\s*\([^)]*address\s+\w+[^)]*\)\s+external[^{]*\{(?![^}]*require[^}]*!=\s*address\(0\))/g,
                severity: "MEDIUM",
                message: "External function with address parameter lacks zero address check",
                fix: "Add require(address != address(0)) validation"
            },
            {
                pattern: /function\s+\w+\s*\([^)]*uint256\s+\w+[^)]*\)\s+external[^{]*\{(?![^}]*require[^}]*>\s*0)/g,
                severity: "LOW",
                message: "External function with uint parameter might lack validation",
                fix: "Consider adding require(amount > 0) if appropriate"
            },
            {
                pattern: /bytes32\s+\w+[^{]*\{(?![^}]*require[^}]*!=\s*0)/g,
                severity: "MEDIUM",
                message: "bytes32 parameter might lack empty check",
                fix: "Add require(hash != 0) or equivalent validation"
            }
        ];

        this.runPatternChecks(content, fileName, checks, "Input Validation");
    }

    /**
     * Check gas optimization opportunities
     */
    checkGasOptimization(content, fileName) {
        const optimizations = [
            {
                pattern: /require\s*\([^,]+,\s*"[^"]+"\s*\)/g,
                severity: "GAS",
                message: "Using string error messages instead of custom errors",
                fix: "Replace with custom errors to save ~50% gas on reverts",
                savings: "50% gas on failed transactions"
            },
            {
                pattern: /string\s+memory\s+\w+/g,
                severity: "GAS",
                message: "Using 'memory' for string parameters",
                fix: "Use 'calldata' for read-only string parameters",
                savings: "10-15% gas"
            },
            {
                pattern: /uint256\[\]\s+memory\s+\w+/g,
                severity: "GAS",
                message: "Using 'memory' for array parameters",
                fix: "Use 'calldata' for read-only array parameters",
                savings: "15-20% gas"
            },
            {
                pattern: /for\s*\(\s*uint256\s+\w+\s*=\s*0;\s*\w+\s*<\s*\w+\.length;\s*\w+\+\+\s*\)/g,
                severity: "GAS",
                message: "Inefficient loop pattern",
                fix: "Cache array length and use unchecked increment",
                savings: "5-10% gas per iteration"
            }
        ];

        this.runPatternChecks(content, fileName, optimizations, "Gas Optimization");
    }

    /**
     * Check event security
     */
    checkEventSecurity(content, fileName) {
        const checks = [
            {
                pattern: /event\s+\w+\s*\([^)]*address\s+\w+(?!\s+indexed)/g,
                severity: "LOW",
                message: "Address parameter in event not indexed",
                fix: "Add 'indexed' keyword to address parameters for better filtering"
            },
            {
                pattern: /event\s+\w+\s*\([^)]*uint256\s+\w+(?!\s+indexed)/g,
                severity: "LOW",
                message: "Important uint256 parameter not indexed",
                fix: "Consider indexing important uint256 parameters (max 3 indexed per event)"
            }
        ];

        this.runPatternChecks(content, fileName, checks, "Event Security");
    }

    /**
     * Check storage optimization
     */
    checkStorageOptimization(content, fileName) {
        const optimizations = [
            {
                pattern: /struct\s+\w+\s*\{[^}]*address\s+\w+;\s*uint256\s+\w+;/g,
                severity: "GAS",
                message: "Struct could be packed more efficiently",
                fix: "Consider using smaller uint types (uint96, uint128) to pack with address",
                savings: "20-30% storage gas"
            },
            {
                pattern: /mapping\s*\([^)]+\s*=>\s*uint256\[\]\s*\)/g,
                severity: "GAS",
                message: "Dynamic array in mapping can cause DOS",
                fix: "Consider using nested mapping instead of arrays",
                savings: "Prevents DOS, 30-40% gas savings"
            },
            {
                pattern: /bool\s+\w+;\s*uint256\s+\w+;/g,
                severity: "GAS",
                message: "Bool and uint256 could be packed",
                fix: "Group small types together or use uint256 flags",
                savings: "10-15% storage gas"
            }
        ];

        this.runPatternChecks(content, fileName, optimizations, "Storage Optimization");
    }

    /**
     * Run pattern checks against content
     */
    runPatternChecks(content, fileName, checks, category) {
        for (const check of checks) {
            const matches = content.match(check.pattern);
            if (matches) {
                const finding = {
                    file: fileName,
                    category: category,
                    severity: check.severity,
                    message: check.message,
                    fix: check.fix,
                    savings: check.savings,
                    occurrences: matches.length
                };

                if (check.severity === "GAS") {
                    this.gasOptimizations.push(finding);
                } else if (check.severity !== "INFO") {
                    this.vulnerabilities.push(finding);
                    this.adjustSecurityScore(check.severity);
                }

                // Log findings
                const emoji = this.getSeverityEmoji(check.severity);
                console.log(`  ${emoji} ${check.severity}: ${check.message}`);
                if (check.fix) {
                    console.log(`    💡 Fix: ${check.fix}`);
                }
                if (check.savings) {
                    console.log(`    💰 Savings: ${check.savings}`);
                }
            }
        }
    }

    /**
     * Adjust security score based on findings
     */
    adjustSecurityScore(severity) {
        const penalties = {
            "HIGH": 20,
            "MEDIUM": 10,
            "LOW": 5
        };
        this.securityScore = Math.max(0, this.securityScore - (penalties[severity] || 0));
    }

    /**
     * Get emoji for severity level
     */
    getSeverityEmoji(severity) {
        const emojis = {
            "HIGH": "🔴",
            "MEDIUM": "🟡",
            "LOW": "🟢",
            "GAS": "⛽",
            "INFO": "ℹ️"
        };
        return emojis[severity] || "❓";
    }

    /**
     * Generate comprehensive security report
     */
    generateSecurityReport() {
        const timestamp = new Date().toISOString();
        
        const report = {
            scanDate: timestamp,
            securityScore: this.securityScore,
            summary: {
                totalVulnerabilities: this.vulnerabilities.length,
                highSeverity: this.vulnerabilities.filter(v => v.severity === "HIGH").length,
                mediumSeverity: this.vulnerabilities.filter(v => v.severity === "MEDIUM").length,
                lowSeverity: this.vulnerabilities.filter(v => v.severity === "LOW").length,
                gasOptimizations: this.gasOptimizations.length
            },
            vulnerabilities: this.vulnerabilities,
            gasOptimizations: this.gasOptimizations,
            recommendations: this.generateRecommendations()
        };

        // Save report
        const reportsDir = path.join(__dirname, "../security-reports");
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportPath = path.join(reportsDir, `security-scan-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate markdown report
        this.generateMarkdownReport(report, reportsDir);

        console.log(`\n📊 Security scan completed!`);
        console.log(`🔒 Security Score: ${this.securityScore}/100`);
        console.log(`📁 Report saved to: ${reportPath}`);
    }

    /**
     * Generate recommendations based on findings
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.vulnerabilities.some(v => v.severity === "HIGH")) {
            recommendations.push("🚨 HIGH PRIORITY: Fix high severity vulnerabilities before deployment");
        }

        if (this.vulnerabilities.some(v => v.category === "Access Control")) {
            recommendations.push("🔐 Implement comprehensive access control testing");
        }

        if (this.gasOptimizations.length > 5) {
            recommendations.push("⛽ Consider implementing gas optimizations for better user experience");
        }

        if (this.securityScore < 80) {
            recommendations.push("🔍 Consider external security audit before mainnet deployment");
        }

        recommendations.push("✅ Implement automated security testing in CI/CD pipeline");
        recommendations.push("📊 Set up monitoring and alerting for deployed contracts");

        return recommendations;
    }

    /**
     * Generate markdown report
     */
    generateMarkdownReport(report, reportsDir) {
        const markdownReport = `# Smart Contract Security Scan Report

**Scan Date:** ${report.scanDate}
**Security Score:** ${report.securityScore}/100

## Summary

- **Total Vulnerabilities:** ${report.summary.totalVulnerabilities}
  - High Severity: ${report.summary.highSeverity}
  - Medium Severity: ${report.summary.mediumSeverity}
  - Low Severity: ${report.summary.lowSeverity}
- **Gas Optimizations:** ${report.summary.gasOptimizations}

## Vulnerabilities

${report.vulnerabilities.map(v => `
### ${v.severity} - ${v.category}
**File:** ${v.file}
**Issue:** ${v.message}
**Fix:** ${v.fix}
**Occurrences:** ${v.occurrences}
`).join('\n')}

## Gas Optimizations

${report.gasOptimizations.map(o => `
### ${o.category}
**File:** ${o.file}
**Issue:** ${o.message}
**Fix:** ${o.fix}
**Potential Savings:** ${o.savings || 'N/A'}
**Occurrences:** ${o.occurrences}
`).join('\n')}

## Recommendations

${report.recommendations.map(r => `- ${r}`).join('\n')}

## Next Steps

1. Address high and medium severity issues
2. Implement gas optimizations
3. Add comprehensive test coverage
4. Consider external security audit
5. Set up monitoring and alerting
`;

        const markdownPath = path.join(reportsDir, 'latest-security-report.md');
        fs.writeFileSync(markdownPath, markdownReport);
        console.log(`📄 Markdown report saved to: ${markdownPath}`);
    }
}

// Export for use in scripts
module.exports = SmartContractSecurityScanner;

// Run scanner if called directly
if (require.main === module) {
    async function main() {
        const scanner = new SmartContractSecurityScanner();
        await scanner.scanContracts();
    }

    main().catch(console.error);
}
