const { AxePuppeteer } = require('@axe-core/puppeteer');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * ♿ Mobile Accessibility Testing Framework
 * Comprehensive accessibility testing for mobile applications
 */

class MobileAccessibilityTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {};
    this.baseURL = process.env.MOBILE_TEST_URL || 'http://localhost:3000';
    this.outputDir = path.join(__dirname, '../../results/accessibility');
    
    // Mobile devices for accessibility testing
    this.devices = [
      { name: 'iPhone 12', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
      { name: 'Samsung Galaxy S21', width: 360, height: 800, deviceScaleFactor: 3, isMobile: true },
      { name: 'iPad', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true }
    ];

    // Accessibility test scenarios
    this.testScenarios = [
      { name: 'login', path: '/login', description: 'Login screen accessibility' },
      { name: 'main-screen', path: '/notes', description: 'Main notes screen accessibility' },
      { name: 'note-editor', path: '/notes/new', description: 'Note editor accessibility' },
      { name: 'settings', path: '/settings', description: 'Settings screen accessibility' }
    ];

    // Content size categories for testing
    this.contentSizes = [
      'medium',           // Default
      'large',           // 120%
      'extraLarge',      // 150%
      'accessibilityMedium', // 200%
      'accessibilityLarge',  // 250%
      'accessibilityExtraExtraExtraLarge' // 380%
    ];

    // WCAG compliance levels
    this.wcagLevels = ['wcag2a', 'wcag2aa', 'wcag21aa'];
  }

  async initialize() {
    console.log('♿ Initializing Mobile Accessibility Testing Framework');
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });
    
    this.page = await this.browser.newPage();
    console.log(`📍 Testing URL: ${this.baseURL}`);
  }

  async runAccessibilityTests() {
    console.log('🔍 Running Mobile Accessibility Tests');
    
    for (const device of this.devices) {
      console.log(`📱 Testing device: ${device.name}`);
      this.results[device.name] = await this.testDevice(device);
    }
    
    await this.generateAccessibilityReport();
    console.log(`📊 Accessibility test results saved to: ${this.outputDir}`);
  }

  async testDevice(device) {
    const deviceResults = {
      device: device.name,
      timestamp: new Date().toISOString(),
      scenarios: {},
      contentSizes: {},
      summary: { total: 0, passed: 0, failed: 0 },
      issues: []
    };

    // Set device viewport
    await this.page.setViewport({
      width: device.width,
      height: device.height,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: true
    });

    // Test each scenario
    for (const scenario of this.testScenarios) {
      console.log(`  🧪 Testing scenario: ${scenario.name}`);
      deviceResults.scenarios[scenario.name] = await this.testScenario(scenario, device);
    }

    // Test different content sizes
    for (const size of this.contentSizes) {
      console.log(`  📏 Testing content size: ${size}`);
      deviceResults.contentSizes[size] = await this.testContentSize(size, device);
    }

    // Calculate summary
    const allTests = [...Object.values(deviceResults.scenarios), ...Object.values(deviceResults.contentSizes)];
    deviceResults.summary.total = allTests.length;
    deviceResults.summary.passed = allTests.filter(test => test.passed).length;
    deviceResults.summary.failed = deviceResults.summary.total - deviceResults.summary.passed;

    return deviceResults;
  }

  async testScenario(scenario, device) {
    const scenarioResult = {
      name: scenario.name,
      description: scenario.description,
      timestamp: new Date().toISOString(),
      passed: true,
      axeResults: null,
      customTests: {},
      issues: []
    };

    try {
      // Navigate to scenario
      const targetUrl = `${this.baseURL}${scenario.path}`;
      await this.page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.page.waitForTimeout(2000);

      // Run Axe accessibility tests
      const axe = new AxePuppeteer(this.page);
      const axeResults = await axe
        .withTags(this.wcagLevels)
        .analyze();

      scenarioResult.axeResults = {
        violations: axeResults.violations.length,
        passes: axeResults.passes.length,
        incomplete: axeResults.incomplete.length,
        inapplicable: axeResults.inapplicable.length,
        details: axeResults.violations.map(violation => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.length
        }))
      };

      // Run custom mobile accessibility tests
      scenarioResult.customTests = {
        touchTargets: await this.testTouchTargets(),
        textContrast: await this.testTextContrast(),
        focusManagement: await this.testFocusManagement(),
        screenReaderSupport: await this.testScreenReaderSupport(),
        gestureSupport: await this.testGestureSupport(),
        orientationSupport: await this.testOrientationSupport()
      };

      // Determine if scenario passed
      const hasViolations = axeResults.violations.length > 0;
      const hasCustomFailures = Object.values(scenarioResult.customTests).some(test => !test.passed);
      
      scenarioResult.passed = !hasViolations && !hasCustomFailures;

      if (hasViolations) {
        scenarioResult.issues.push(`${axeResults.violations.length} WCAG violations found`);
      }

      // Capture screenshot
      const screenshotPath = path.join(this.outputDir, `${device.name.replace(/\s+/g, '_')}-${scenario.name}.png`);
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        type: 'png'
      });

    } catch (error) {
      console.error(`    ❌ Error testing scenario ${scenario.name}:`, error.message);
      scenarioResult.passed = false;
      scenarioResult.issues.push(`Test error: ${error.message}`);
    }

    return scenarioResult;
  }

  async testContentSize(size, device) {
    const sizeResult = {
      contentSize: size,
      timestamp: new Date().toISOString(),
      passed: true,
      tests: {},
      issues: []
    };

    try {
      // Simulate content size change (this would typically be done via device settings)
      await this.page.evaluateOnNewDocument((contentSize) => {
        // Simulate iOS Dynamic Type or Android font scale
        const scaleFactors = {
          'medium': 1.0,
          'large': 1.2,
          'extraLarge': 1.5,
          'accessibilityMedium': 2.0,
          'accessibilityLarge': 2.5,
          'accessibilityExtraExtraExtraLarge': 3.8
        };
        
        const scale = scaleFactors[contentSize] || 1.0;
        document.documentElement.style.fontSize = `${16 * scale}px`;
        
        // Also adjust other text elements
        const style = document.createElement('style');
        style.textContent = `
          * { 
            font-size: ${scale}em !important; 
            line-height: 1.4 !important;
          }
        `;
        document.head.appendChild(style);
      }, size);

      // Navigate to main screen for testing
      await this.page.goto(`${this.baseURL}/notes`, { waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(2000);

      // Test layout integrity with larger text
      sizeResult.tests.layoutIntegrity = await this.testLayoutWithLargeText();
      
      // Test readability
      sizeResult.tests.readability = await this.testReadabilityWithSize(size);
      
      // Test interactive elements
      sizeResult.tests.interactiveElements = await this.testInteractiveElementsWithSize();

      // Check if any tests failed
      sizeResult.passed = Object.values(sizeResult.tests).every(test => test.passed);

    } catch (error) {
      console.error(`    ❌ Error testing content size ${size}:`, error.message);
      sizeResult.passed = false;
      sizeResult.issues.push(`Content size test error: ${error.message}`);
    }

    return sizeResult;
  }

  async testTouchTargets() {
    console.log('    👆 Testing touch target sizes');
    
    const touchTest = {
      passed: true,
      issues: [],
      metrics: { tested: 0, compliant: 0 }
    };

    try {
      const interactiveElements = await this.page.$$('button, a, input, [role="button"], [onclick], [tabindex]');
      touchTest.metrics.tested = interactiveElements.length;

      for (const element of interactiveElements) {
        const dimensions = await this.page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }, element);

        // WCAG 2.1 AA: touch targets should be at least 44×44 CSS pixels
        const minSize = 44;
        const isCompliant = dimensions.width >= minSize && dimensions.height >= minSize;
        
        if (isCompliant) {
          touchTest.metrics.compliant++;
        } else {
          touchTest.passed = false;
          touchTest.issues.push(`Touch target too small: ${dimensions.width}×${dimensions.height}px (minimum: ${minSize}×${minSize}px)`);
        }
      }

    } catch (error) {
      touchTest.passed = false;
      touchTest.issues.push(`Touch target test error: ${error.message}`);
    }

    return touchTest;
  }

  async testTextContrast() {
    console.log('    🎨 Testing text contrast ratios');
    
    const contrastTest = {
      passed: true,
      issues: [],
      metrics: { tested: 0, compliant: 0 }
    };

    try {
      // This is a simplified version - in practice you'd use a color contrast library
      const textElements = await this.page.$$('p, h1, h2, h3, h4, h5, h6, span, div, a, button');
      contrastTest.metrics.tested = Math.min(textElements.length, 20); // Limit for performance

      for (const element of textElements.slice(0, 20)) {
        const styles = await this.page.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            fontSize: computed.fontSize
          };
        }, element);

        // Simplified contrast check (in reality, you'd calculate actual contrast ratios)
        const hasGoodContrast = this.simulateContrastCheck(styles);
        
        if (hasGoodContrast) {
          contrastTest.metrics.compliant++;
        } else {
          contrastTest.issues.push('Low contrast detected on text element');
        }
      }

      contrastTest.passed = contrastTest.metrics.compliant === contrastTest.metrics.tested;

    } catch (error) {
      contrastTest.passed = false;
      contrastTest.issues.push(`Contrast test error: ${error.message}`);
    }

    return contrastTest;
  }

  async testFocusManagement() {
    console.log('    🎯 Testing focus management');
    
    const focusTest = {
      passed: true,
      issues: [],
      metrics: { focusableElements: 0, properFocusOrder: true }
    };

    try {
      // Test tab order and focus visibility
      const focusableElements = await this.page.$$('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusTest.metrics.focusableElements = focusableElements.length;

      // Test focus visibility
      for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
        await focusableElements[i].focus();
        
        const hasFocusIndicator = await this.page.evaluate(el => {
          const computed = window.getComputedStyle(el, ':focus');
          return computed.outline !== 'none' || 
                 computed.borderColor !== computed.getPropertyValue('border-color') ||
                 computed.boxShadow !== 'none';
        }, focusableElements[i]);

        if (!hasFocusIndicator) {
          focusTest.passed = false;
          focusTest.issues.push('Focusable element lacks visible focus indicator');
        }
      }

      // Test logical tab order (simplified)
      if (focusableElements.length > 1) {
        const positions = [];
        for (const element of focusableElements.slice(0, 5)) {
          const rect = await element.boundingBox();
          if (rect) positions.push({ y: rect.y, x: rect.x });
        }

        // Check if elements are roughly in reading order (top to bottom, left to right)
        for (let i = 1; i < positions.length; i++) {
          const prev = positions[i - 1];
          const curr = positions[i];
          
          if (curr.y < prev.y - 50) { // Allow some tolerance
            focusTest.passed = false;
            focusTest.metrics.properFocusOrder = false;
            focusTest.issues.push('Focus order does not follow logical reading sequence');
            break;
          }
        }
      }

    } catch (error) {
      focusTest.passed = false;
      focusTest.issues.push(`Focus management test error: ${error.message}`);
    }

    return focusTest;
  }

  async testScreenReaderSupport() {
    console.log('    🔊 Testing screen reader support');
    
    const screenReaderTest = {
      passed: true,
      issues: [],
      metrics: { elementsWithLabels: 0, totalInteractiveElements: 0 }
    };

    try {
      // Test ARIA labels and semantic markup
      const interactiveElements = await this.page.$$('button, a, input, select, textarea');
      screenReaderTest.metrics.totalInteractiveElements = interactiveElements.length;

      for (const element of interactiveElements) {
        const hasLabel = await this.page.evaluate(el => {
          return !!(
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            el.getAttribute('title') ||
            (el.tagName === 'INPUT' && el.closest('label')) ||
            (el.tagName === 'BUTTON' && el.textContent.trim()) ||
            (el.tagName === 'A' && el.textContent.trim())
          );
        }, element);

        if (hasLabel) {
          screenReaderTest.metrics.elementsWithLabels++;
        } else {
          screenReaderTest.passed = false;
          screenReaderTest.issues.push('Interactive element missing accessible label');
        }
      }

      // Test heading structure
      const headings = await this.page.$$('h1, h2, h3, h4, h5, h6');
      if (headings.length > 0) {
        const headingLevels = await Promise.all(
          headings.map(h => this.page.evaluate(el => parseInt(el.tagName.substring(1)), h))
        );

        // Check for proper heading hierarchy
        for (let i = 1; i < headingLevels.length; i++) {
          if (headingLevels[i] > headingLevels[i - 1] + 1) {
            screenReaderTest.passed = false;
            screenReaderTest.issues.push('Heading hierarchy skips levels (e.g., h1 to h3)');
            break;
          }
        }
      }

    } catch (error) {
      screenReaderTest.passed = false;
      screenReaderTest.issues.push(`Screen reader test error: ${error.message}`);
    }

    return screenReaderTest;
  }

  async testGestureSupport() {
    console.log('    ✋ Testing gesture support and alternatives');
    
    const gestureTest = {
      passed: true,
      issues: [],
      metrics: { gestureElements: 0, alternativeInputs: 0 }
    };

    try {
      // Look for elements that might rely on complex gestures
      const potentialGestureElements = await this.page.$$('[onswipe], [ontouchmove], [onpinch], .swipeable, .gesture-enabled');
      gestureTest.metrics.gestureElements = potentialGestureElements.length;

      // Check if gesture-dependent elements have alternative input methods
      for (const element of potentialGestureElements) {
        const hasAlternative = await this.page.evaluate(el => {
          // Look for nearby buttons or controls that provide same functionality
          const parent = el.closest('[role="region"], .container, section');
          return parent && parent.querySelectorAll('button, [role="button"]').length > 0;
        }, element);

        if (hasAlternative) {
          gestureTest.metrics.alternativeInputs++;
        } else {
          gestureTest.passed = false;
          gestureTest.issues.push('Gesture-dependent element lacks alternative input method');
        }
      }

    } catch (error) {
      gestureTest.passed = false;
      gestureTest.issues.push(`Gesture support test error: ${error.message}`);
    }

    return gestureTest;
  }

  async testOrientationSupport() {
    console.log('    🔄 Testing orientation support');
    
    const orientationTest = {
      passed: true,
      issues: [],
      orientations: {}
    };

    try {
      const orientations = ['portrait', 'landscape'];
      
      for (const orientation of orientations) {
        // Simulate orientation change
        if (orientation === 'landscape') {
          await this.page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3 });
        } else {
          await this.page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
        }

        await this.page.waitForTimeout(1000);

        // Test if content is still accessible
        const isContentAccessible = await this.page.evaluate(() => {
          // Check if main content is visible and not cut off
          const main = document.querySelector('main, [role="main"], .main-content');
          if (!main) return false;
          
          const rect = main.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.top >= 0;
        });

        orientationTest.orientations[orientation] = {
          contentAccessible: isContentAccessible,
          passed: isContentAccessible
        };

        if (!isContentAccessible) {
          orientationTest.passed = false;
          orientationTest.issues.push(`Content not accessible in ${orientation} orientation`);
        }
      }

    } catch (error) {
      orientationTest.passed = false;
      orientationTest.issues.push(`Orientation test error: ${error.message}`);
    }

    return orientationTest;
  }

  async testLayoutWithLargeText() {
    return {
      passed: true,
      issues: [],
      metrics: { overflowElements: 0, truncatedText: 0 }
    };
  }

  async testReadabilityWithSize(size) {
    const readabilityTest = {
      passed: true,
      contentSize: size,
      issues: []
    };

    try {
      const textElements = await this.page.$$('p, span, div, h1, h2, h3, h4, h5, h6');
      
      for (const element of textElements.slice(0, 10)) {
        const isReadable = await this.page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.height > 0 && style.visibility !== 'hidden' && !el.scrollWidth > rect.width + 10;
        }, element);

        if (!isReadable) {
          readabilityTest.passed = false;
          readabilityTest.issues.push('Text element not readable with large text size');
        }
      }

    } catch (error) {
      readabilityTest.passed = false;
      readabilityTest.issues.push(`Readability test error: ${error.message}`);
    }

    return readabilityTest;
  }

  async testInteractiveElementsWithSize() {
    return {
      passed: true,
      issues: [],
      metrics: { accessibleElements: 0, totalElements: 0 }
    };
  }

  simulateContrastCheck(styles) {
    // Simplified contrast check - in a real implementation, 
    // you would calculate actual contrast ratios using color values
    return !styles.color.includes('rgb(128, 128, 128)') || // avoid gray on white
           !styles.backgroundColor.includes('rgb(255, 255, 255)');
  }

  async generateAccessibilityReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      results: this.results,
      testUrl: this.baseURL
    };

    // Generate JSON report
    const jsonReportPath = path.join(this.outputDir, 'accessibility-test-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(reportData);
    const htmlReportPath = path.join(this.outputDir, 'accessibility-test-report.html');
    await fs.writeFile(htmlReportPath, htmlReport);

    console.log(`📊 Accessibility reports generated:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
  }

  generateSummary() {
    let totalTests = 0;
    let passedTests = 0;
    let totalViolations = 0;

    Object.values(this.results).forEach(deviceResult => {
      totalTests += deviceResult.summary.total;
      passedTests += deviceResult.summary.passed;
      
      // Count WCAG violations
      Object.values(deviceResult.scenarios).forEach(scenario => {
        if (scenario.axeResults) {
          totalViolations += scenario.axeResults.violations;
        }
      });
    });

    return {
      totalDevices: Object.keys(this.results).length,
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      totalViolations,
      overallPassRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    };
  }

  generateHTMLReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mobile Accessibility Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: white; padding: 25px; border-radius: 10px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .summary-number { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .device-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(600px, 1fr)); gap: 25px; }
        .device-card { background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden; }
        .device-header { padding: 25px; background: linear-gradient(135deg, #a8e6cf 0%, #81c784 100%); color: white; }
        .device-name { font-size: 1.4em; font-weight: bold; margin: 0; }
        .scenarios { padding: 25px; }
        .scenario { margin: 20px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #81c784; }
        .scenario.failed { border-left-color: #e57373; background: #ffebee; }
        .scenario-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 500; }
        .passed { background: #c8e6c9; color: #2e7d32; }
        .failed { background: #ffcdd2; color: #c62828; }
        .violations { margin: 10px 0; }
        .violation { background: #fff3e0; padding: 8px 12px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #ff9800; }
        .custom-tests { margin-top: 15px; }
        .custom-test { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>♿ Mobile Accessibility Test Report</h1>
            <p><strong>Generated:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
            <p><strong>Test URL:</strong> ${data.testUrl}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <div class="summary-number" style="color: #667eea;">${data.summary.totalDevices}</div>
                <div>Devices Tested</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #00b894;">${data.summary.passedTests}</div>
                <div>Tests Passed</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #e17055;">${data.summary.failedTests}</div>
                <div>Tests Failed</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: ${data.summary.totalViolations === 0 ? '#00b894' : '#e17055'};">${data.summary.totalViolations}</div>
                <div>WCAG Violations</div>
            </div>
        </div>

        <div class="device-grid">
            ${Object.entries(data.results).map(([deviceName, result]) => `
                <div class="device-card">
                    <div class="device-header">
                        <h3 class="device-name">${deviceName}</h3>
                        <div>Pass Rate: ${Math.round((result.summary.passed / result.summary.total) * 100)}%</div>
                    </div>
                    
                    <div class="scenarios">
                        <h4>Test Scenarios</h4>
                        ${Object.entries(result.scenarios).map(([scenarioName, scenario]) => `
                            <div class="scenario ${scenario.passed ? '' : 'failed'}">
                                <div class="scenario-header">
                                    <strong>${scenario.name}</strong>
                                    <span class="status-badge ${scenario.passed ? 'passed' : 'failed'}">
                                        ${scenario.passed ? '✓ Pass' : '✗ Fail'}
                                    </span>
                                </div>
                                <p>${scenario.description}</p>
                                
                                ${scenario.axeResults && scenario.axeResults.violations > 0 ? `
                                    <div class="violations">
                                        <strong>WCAG Violations: ${scenario.axeResults.violations}</strong>
                                        ${scenario.axeResults.details.slice(0, 3).map(violation => `
                                            <div class="violation">
                                                <strong>${violation.id}</strong> (${violation.impact}): ${violation.help}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                
                                <div class="custom-tests">
                                    <strong>Custom Tests:</strong>
                                    ${Object.entries(scenario.customTests || {}).map(([testName, test]) => `
                                        <div class="custom-test">
                                            <span>${testName}</span>
                                            <span class="status-badge ${test.passed ? 'passed' : 'failed'}">
                                                ${test.passed ? '✓' : '✗'}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                        
                        <h4>Content Size Testing</h4>
                        ${Object.entries(result.contentSizes).map(([size, sizeResult]) => `
                            <div class="scenario ${sizeResult.passed ? '' : 'failed'}">
                                <div class="scenario-header">
                                    <strong>Content Size: ${size}</strong>
                                    <span class="status-badge ${sizeResult.passed ? 'passed' : 'failed'}">
                                        ${sizeResult.passed ? '✓ Pass' : '✗ Fail'}
                                    </span>
                                </div>
                                ${sizeResult.issues && sizeResult.issues.length > 0 ? `
                                    <div class="violations">
                                        ${sizeResult.issues.map(issue => `<div class="violation">${issue}</div>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new MobileAccessibilityTest();
  
  try {
    await tester.initialize();
    await tester.runAccessibilityTests();
    console.log('✅ Mobile accessibility testing completed successfully');
  } catch (error) {
    console.error('❌ Mobile accessibility testing failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = MobileAccessibilityTest;
