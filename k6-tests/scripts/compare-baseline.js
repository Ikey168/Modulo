#!/usr/bin/env node

/**
 * 🔍 Compare Performance Against Baseline Script
 * 
 * This script compares current k6 test results against established baselines
 * and fails CI/CD if performance regressions are detected.
 */

const fs = require('fs');
const path = require('path');
const { parseK6Results, SLO_THRESHOLDS } = require('./save-baseline');

// 📁 Configuration
const BASELINES_DIR = path.join(__dirname, '..', 'baselines');
const RESULTS_DIR = path.join(__dirname, '..', 'results');
const BASELINE_FILE = path.join(BASELINES_DIR, 'performance-baselines.json');

// 🎯 Regression Detection Thresholds
const REGRESSION_THRESHOLDS = {
  latency_degradation: 15,    // % increase in latency considered regression
  error_rate_increase: 2,     // % increase in error rate considered regression
  throughput_decrease: 10,    // % decrease in throughput considered regression
};

/**
 * 📈 Load baseline data
 */
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(`❌ Baseline file not found: ${BASELINE_FILE}`);
    console.log('💡 Run "npm run baseline:save" first to establish baselines');
    process.exit(1);
  }
  
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ Failed to load baseline:', error.message);
    process.exit(1);
  }
}

/**
 * 🔍 Compare current results against baseline
 */
function compareWithBaseline() {
  const baseline = loadBaseline();
  
  if (!fs.existsSync(RESULTS_DIR)) {
    console.error(`❌ Results directory not found: ${RESULTS_DIR}`);
    process.exit(1);
  }
  
  // Find latest test results
  const resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => ({
      name: file,
      path: path.join(RESULTS_DIR, file),
      stat: fs.statSync(path.join(RESULTS_DIR, file))
    }))
    .sort((a, b) => b.stat.mtime - a.stat.mtime);
    
  if (resultFiles.length === 0) {
    console.error('❌ No current test results found');
    process.exit(1);
  }
  
  console.log('🔍 Comparing performance against baseline...\n');
  console.log(`📊 Baseline created: ${baseline.metadata.created}`);
  console.log(`🔄 Current test run: ${new Date().toISOString()}\n`);
  
  let hasRegressions = false;
  let hasSLOViolations = false;
  const comparisonResults = {};
  
  // Process each result file
  resultFiles.forEach(file => {
    console.log(`📄 Analyzing: ${file.name}`);
    const currentMetrics = parseK6Results(file.path);
    
    if (!currentMetrics) {
      console.log('  ⚠️ Failed to parse results');
      return;
    }
    
    const testType = file.name.replace('.json', '').replace(/-\\d+$/, '');
    comparisonResults[testType] = {
      file: file.name,
      metrics: currentMetrics,
      comparisons: {},
      regressions: [],
      slo_violations: []
    };
    
    // Compare each metric against baseline
    Object.keys(currentMetrics).forEach(metric => {
      const currentValue = currentMetrics[metric];
      const baselineData = baseline.baselines[metric];
      
      if (!baselineData || currentValue === null) {
        return;
      }
      
      const baselineValue = baselineData.p95; // Use P95 for comparison
      let regression = false;
      let severity = 'info';
      
      // Determine if this is a regression
      if (metric.includes('latency') || metric.includes('duration')) {
        // For latency metrics, higher is worse
        const increase = ((currentValue - baselineValue) / baselineValue) * 100;
        if (increase > REGRESSION_THRESHOLDS.latency_degradation) {
          regression = true;
          severity = 'error';
        } else if (increase > REGRESSION_THRESHOLDS.latency_degradation / 2) {
          severity = 'warning';
        }
        
        comparisonResults[testType].comparisons[metric] = {
          current: currentValue,
          baseline: baselineValue,
          change_percent: increase,
          regression,
          severity
        };
        
      } else if (metric.includes('error') || metric.includes('failed')) {
        // For error rates, higher is worse
        const increase = currentValue - baselineValue;
        if (increase > REGRESSION_THRESHOLDS.error_rate_increase) {
          regression = true;
          severity = 'error';
        } else if (increase > REGRESSION_THRESHOLDS.error_rate_increase / 2) {
          severity = 'warning';
        }
        
        comparisonResults[testType].comparisons[metric] = {
          current: currentValue,
          baseline: baselineValue,
          change_percent: increase,
          regression,
          severity
        };
        
      } else if (metric.includes('throughput') || metric.includes('rate')) {
        // For throughput, lower is worse (unless it's error rate)
        const decrease = ((baselineValue - currentValue) / baselineValue) * 100;
        if (decrease > REGRESSION_THRESHOLDS.throughput_decrease) {
          regression = true;
          severity = 'error';
        } else if (decrease > REGRESSION_THRESHOLDS.throughput_decrease / 2) {
          severity = 'warning';
        }
        
        comparisonResults[testType].comparisons[metric] = {
          current: currentValue,
          baseline: baselineValue,
          change_percent: -decrease, // Negative means decrease
          regression,
          severity
        };
      }
      
      if (regression) {
        hasRegressions = true;
        comparisonResults[testType].regressions.push(metric);
      }
    });
    
    // 🎯 Check SLO Compliance
    console.log(`\\n  🎯 SLO Compliance Check:`);
    Object.keys(SLO_THRESHOLDS).forEach(sloMetric => {
      const threshold = SLO_THRESHOLDS[sloMetric];
      const currentValue = currentMetrics[sloMetric];
      
      if (currentValue !== undefined && currentValue !== null) {
        const compliant = sloMetric.includes('rate') || sloMetric.includes('availability')
          ? currentValue >= threshold
          : currentValue <= threshold;
          
        const status = compliant ? '✅' : '❌';
        const comparison = sloMetric.includes('rate') || sloMetric.includes('availability')
          ? `${currentValue.toFixed(2)}% >= ${threshold}%`
          : `${currentValue.toFixed(2)}ms <= ${threshold}ms`;
          
        console.log(`    ${status} ${sloMetric}: ${comparison}`);
        
        if (!compliant) {
          hasSLOViolations = true;
          comparisonResults[testType].slo_violations.push({
            metric: sloMetric,
            current: currentValue,
            threshold,
            compliant: false
          });
        }
      }
    });
    
    // Print regression summary for this test
    const regressionCount = comparisonResults[testType].regressions.length;
    if (regressionCount > 0) {
      console.log(`\\n  ❌ ${regressionCount} performance regression(s) detected:`);
      comparisonResults[testType].regressions.forEach(metric => {
        const comp = comparisonResults[testType].comparisons[metric];
        console.log(`    • ${metric}: ${comp.change_percent.toFixed(1)}% degradation`);
      });
    } else {
      console.log(`\\n  ✅ No performance regressions detected`);
    }
    
    console.log('\\n' + '─'.repeat(60) + '\\n');
  });
  
  // 📊 Overall Summary
  console.log('📊 PERFORMANCE ANALYSIS SUMMARY');
  console.log('═'.repeat(50));
  
  const totalTests = Object.keys(comparisonResults).length;
  const testsWithRegressions = Object.values(comparisonResults)
    .filter(result => result.regressions.length > 0).length;
  const testsWithSLOViolations = Object.values(comparisonResults)
    .filter(result => result.slo_violations.length > 0).length;
    
  console.log(`📈 Tests Analyzed: ${totalTests}`);
  console.log(`❌ Tests with Regressions: ${testsWithRegressions}`);
  console.log(`🎯 Tests with SLO Violations: ${testsWithSLOViolations}`);
  
  // Detailed regression report
  if (hasRegressions) {
    console.log('\\n❌ PERFORMANCE REGRESSIONS DETECTED:');
    Object.keys(comparisonResults).forEach(testType => {
      const result = comparisonResults[testType];
      if (result.regressions.length > 0) {
        console.log(`\\n  📄 ${testType}:`);
        result.regressions.forEach(metric => {
          const comp = result.comparisons[metric];
          console.log(`    • ${metric}: ${comp.current.toFixed(2)} vs ${comp.baseline.toFixed(2)} (${comp.change_percent.toFixed(1)}% change)`);
        });
      }
    });
  }
  
  // SLO violations report
  if (hasSLOViolations) {
    console.log('\\n🎯 SLO VIOLATIONS DETECTED:');
    Object.keys(comparisonResults).forEach(testType => {
      const result = comparisonResults[testType];
      if (result.slo_violations.length > 0) {
        console.log(`\\n  📄 ${testType}:`);
        result.slo_violations.forEach(violation => {
          console.log(`    • ${violation.metric}: ${violation.current.toFixed(2)} violates threshold ${violation.threshold}`);
        });
      }
    });
  }
  
  // Save comparison results
  const comparisonFile = path.join(RESULTS_DIR, `comparison-${Date.now()}.json`);
  fs.writeFileSync(comparisonFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseline_metadata: baseline.metadata,
    comparison_results: comparisonResults,
    summary: {
      has_regressions: hasRegressions,
      has_slo_violations: hasSLOViolations,
      tests_analyzed: totalTests,
      tests_with_regressions: testsWithRegressions,
      tests_with_slo_violations: testsWithSLOViolations
    }
  }, null, 2));
  
  console.log(`\\n💾 Comparison results saved: ${comparisonFile}`);
  
  // Exit with appropriate code
  if (hasSLOViolations) {
    console.log('\\n🚨 FAILING BUILD: SLO violations detected');
    process.exit(2); // SLO violations are more critical than regressions
  } else if (hasRegressions) {
    console.log('\\n⚠️ FAILING BUILD: Performance regressions detected');
    process.exit(1);
  } else {
    console.log('\\n✅ PASSING: No performance issues detected');
    process.exit(0);
  }
}

// 🚀 Main execution
if (require.main === module) {
  console.log('🔍 Comparing Performance Against Baseline...\\n');
  
  try {
    compareWithBaseline();
  } catch (error) {
    console.error('❌ Failed to compare baseline:', error.message);
    process.exit(1);
  }
}

module.exports = { compareWithBaseline, loadBaseline, REGRESSION_THRESHOLDS };
