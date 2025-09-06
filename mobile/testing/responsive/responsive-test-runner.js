const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * 📱 Responsive Design Testing Framework
 * Tests mobile app responsiveness across different devices and screen sizes
 */

class ResponsiveTestRunner {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = [];
    
    // Device configurations for testing
    this.devices = [
      // Mobile Phones
      { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      { name: 'iPhone 12', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
      { name: 'iPhone 14 Pro Max', width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
      { name: 'Samsung Galaxy S21', width: 360, height: 800, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
      { name: 'Samsung Galaxy Note 20', width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
      { name: 'Google Pixel 5', width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
      
      // Tablets
      { name: 'iPad', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      { name: 'iPad Pro 11"', width: 834, height: 1194, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      { name: 'iPad Pro 12.9"', width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      { name: 'Samsung Galaxy Tab S7', width: 753, height: 1037, deviceScaleFactor: 2.25, isMobile: true, hasTouch: true },
      
      // Foldable Devices
      { name: 'Samsung Galaxy Z Fold3 (Folded)', width: 374, height: 819, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true },
      { name: 'Samsung Galaxy Z Fold3 (Unfolded)', width: 768, height: 882, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true },
      
      // Desktop (for reference)
      { name: 'Desktop 1920x1080', width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
      { name: 'Desktop 1366x768', width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    ];

    this.baseURL = process.env.MOBILE_TEST_URL || 'http://localhost:3000';
    this.outputDir = path.join(__dirname, '../../results/responsive');
  }

  async initialize() {
    console.log('🚀 Initializing Responsive Design Testing Framework');
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    this.page = await this.browser.newPage();
  }

  async runResponsiveTests() {
    console.log('📱 Running Responsive Design Tests');
    
    for (const device of this.devices) {
      await this.testDevice(device);
    }
    
    await this.generateReport();
    console.log(`📊 Responsive test results saved to: ${this.outputDir}`);
  }

  async testDevice(device) {
    console.log(`📱 Testing device: ${device.name} (${device.width}x${device.height})`);
    
    const testResult = {
      device: device.name,
      dimensions: `${device.width}x${device.height}`,
      timestamp: new Date().toISOString(),
      tests: {},
      screenshots: [],
      issues: []
    };

    try {
      // Set device viewport
      await this.page.setViewport({
        width: device.width,
        height: device.height,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: device.hasTouch
      });

      // Set user agent for mobile devices
      if (device.isMobile) {
        await this.page.setUserAgent(this.getMobileUserAgent(device.name));
      }

      // Load the application
      await this.page.goto(this.baseURL, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.page.waitForTimeout(2000); // Allow time for responsive adjustments

      // Test 1: Layout Integrity
      testResult.tests.layout = await this.testLayout(device);
      
      // Test 2: Navigation Usability
      testResult.tests.navigation = await this.testNavigation(device);
      
      // Test 3: Content Readability
      testResult.tests.readability = await this.testReadability(device);
      
      // Test 4: Interactive Elements
      testResult.tests.interactivity = await this.testInteractivity(device);
      
      // Test 5: Performance on Device
      testResult.tests.performance = await this.testPerformance(device);
      
      // Test 6: Touch Target Sizes (Mobile only)
      if (device.isMobile) {
        testResult.tests.touchTargets = await this.testTouchTargets(device);
      }

      // Capture screenshots
      const screenshotPath = path.join(this.outputDir, `${device.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        type: 'png',
        quality: 90
      });
      testResult.screenshots.push(screenshotPath);

    } catch (error) {
      console.error(`❌ Error testing device ${device.name}:`, error.message);
      testResult.issues.push({
        type: 'error',
        message: error.message,
        stack: error.stack
      });
    }

    this.results.push(testResult);
  }

  async testLayout(device) {
    const layoutTest = {
      passed: true,
      issues: []
    };

    try {
      // Test main container visibility
      const mainContainer = await this.page.$('[data-testid="main-container"], .main-container, main');
      if (!mainContainer) {
        layoutTest.passed = false;
        layoutTest.issues.push('Main container not found');
      }

      // Test header/navigation visibility
      const header = await this.page.$('[data-testid="header"], header, .header, nav');
      if (!header) {
        layoutTest.passed = false;
        layoutTest.issues.push('Header/navigation not found');
      }

      // Test content area visibility
      const content = await this.page.$('[data-testid="content"], .content, .main-content');
      if (!content) {
        layoutTest.passed = false;
        layoutTest.issues.push('Main content area not found');
      }

      // Test for horizontal scrollbars (generally bad on mobile)
      const hasHorizontalScroll = await this.page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasHorizontalScroll && device.isMobile) {
        layoutTest.passed = false;
        layoutTest.issues.push('Horizontal scrollbar detected on mobile device');
      }

      // Test viewport meta tag
      const hasViewportMeta = await this.page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        return viewport && viewport.content.includes('width=device-width');
      });

      if (!hasViewportMeta && device.isMobile) {
        layoutTest.passed = false;
        layoutTest.issues.push('Missing or incorrect viewport meta tag');
      }

    } catch (error) {
      layoutTest.passed = false;
      layoutTest.issues.push(`Layout test error: ${error.message}`);
    }

    return layoutTest;
  }

  async testNavigation(device) {
    const navTest = {
      passed: true,
      issues: []
    };

    try {
      // Test mobile menu visibility/accessibility
      if (device.isMobile) {
        const mobileMenu = await this.page.$('[data-testid="mobile-menu"], .mobile-menu, .hamburger-menu');
        if (!mobileMenu) {
          navTest.passed = false;
          navTest.issues.push('Mobile menu not found');
        } else {
          // Test menu interaction
          const isMenuVisible = await this.page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }, mobileMenu);

          if (!isMenuVisible && device.width < 768) {
            navTest.passed = false;
            navTest.issues.push('Mobile menu not visible on small screens');
          }
        }
      }

      // Test navigation links accessibility
      const navLinks = await this.page.$$('nav a, [role="navigation"] a');
      for (const link of navLinks) {
        const isAccessible = await this.page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, link);

        if (!isAccessible) {
          navTest.issues.push('Navigation link not accessible');
        }
      }

    } catch (error) {
      navTest.passed = false;
      navTest.issues.push(`Navigation test error: ${error.message}`);
    }

    return navTest;
  }

  async testReadability(device) {
    const readabilityTest = {
      passed: true,
      issues: []
    };

    try {
      // Test font sizes
      const textElements = await this.page.$$('p, h1, h2, h3, h4, h5, h6, span, div');
      
      for (const element of textElements.slice(0, 10)) { // Test first 10 elements
        const fontSize = await this.page.evaluate(el => {
          const style = window.getComputedStyle(el);
          return parseFloat(style.fontSize);
        }, element);

        // Minimum font size recommendations for mobile
        const minFontSize = device.isMobile ? 16 : 14;
        
        if (fontSize < minFontSize && fontSize > 0) {
          readabilityTest.issues.push(`Small font size detected: ${fontSize}px (minimum: ${minFontSize}px)`);
        }
      }

      // Test line height
      const paragraphs = await this.page.$$('p');
      for (const p of paragraphs.slice(0, 5)) {
        const lineHeight = await this.page.evaluate(el => {
          const style = window.getComputedStyle(el);
          return parseFloat(style.lineHeight);
        }, p);

        if (lineHeight < 1.4 && lineHeight > 0) {
          readabilityTest.issues.push(`Low line height detected: ${lineHeight} (recommended: 1.4+)`);
        }
      }

    } catch (error) {
      readabilityTest.passed = false;
      readabilityTest.issues.push(`Readability test error: ${error.message}`);
    }

    return readabilityTest;
  }

  async testInteractivity(device) {
    const interactivityTest = {
      passed: true,
      issues: []
    };

    try {
      // Test button interactions
      const buttons = await this.page.$$('button, [role="button"], input[type="button"], input[type="submit"]');
      
      for (const button of buttons.slice(0, 5)) {
        const isInteractive = await this.page.evaluate(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.pointerEvents !== 'none' && 
            rect.width > 0 && 
            rect.height > 0 &&
            !el.disabled
          );
        }, button);

        if (!isInteractive) {
          interactivityTest.issues.push('Non-interactive button detected');
        }
      }

      // Test form elements
      const inputs = await this.page.$$('input, textarea, select');
      for (const input of inputs.slice(0, 5)) {
        const isUsable = await this.page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, input);

        if (!isUsable) {
          interactivityTest.issues.push('Form element not properly visible');
        }
      }

    } catch (error) {
      interactivityTest.passed = false;
      interactivityTest.issues.push(`Interactivity test error: ${error.message}`);
    }

    return interactivityTest;
  }

  async testPerformance(device) {
    const performanceTest = {
      passed: true,
      metrics: {},
      issues: []
    };

    try {
      // Get performance metrics
      const performanceMetrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          loadTime: navigation.loadEventEnd - navigation.fetchStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
        };
      });

      performanceTest.metrics = performanceMetrics;

      // Performance thresholds (more lenient for mobile)
      const maxLoadTime = device.isMobile ? 3000 : 2000; // 3s mobile, 2s desktop
      const maxDOMContentLoaded = device.isMobile ? 2000 : 1500; // 2s mobile, 1.5s desktop

      if (performanceMetrics.loadTime > maxLoadTime) {
        performanceTest.passed = false;
        performanceTest.issues.push(`Slow load time: ${performanceMetrics.loadTime}ms (max: ${maxLoadTime}ms)`);
      }

      if (performanceMetrics.domContentLoaded > maxDOMContentLoaded) {
        performanceTest.passed = false;
        performanceTest.issues.push(`Slow DOM ready: ${performanceMetrics.domContentLoaded}ms (max: ${maxDOMContentLoaded}ms)`);
      }

    } catch (error) {
      performanceTest.passed = false;
      performanceTest.issues.push(`Performance test error: ${error.message}`);
    }

    return performanceTest;
  }

  async testTouchTargets(device) {
    const touchTest = {
      passed: true,
      issues: []
    };

    try {
      // Test interactive elements for adequate touch target size
      const interactiveElements = await this.page.$$('button, a, input, [role="button"], [onclick]');
      
      for (const element of interactiveElements.slice(0, 10)) {
        const dimensions = await this.page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }, element);

        // Minimum touch target size: 44px x 44px (iOS) / 48dp (Android)
        const minSize = 44;
        
        if (dimensions.width < minSize || dimensions.height < minSize) {
          touchTest.passed = false;
          touchTest.issues.push(`Touch target too small: ${dimensions.width}x${dimensions.height}px (minimum: ${minSize}x${minSize}px)`);
        }
      }

    } catch (error) {
      touchTest.passed = false;
      touchTest.issues.push(`Touch target test error: ${error.message}`);
    }

    return touchTest;
  }

  getMobileUserAgent(deviceName) {
    const userAgents = {
      'iPhone SE': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      'iPhone 12': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'iPhone 14 Pro Max': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Samsung Galaxy S21': 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36',
      'Samsung Galaxy Note 20': 'Mozilla/5.0 (Linux; Android 10; SM-N981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
      'Google Pixel 5': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36'
    };
    
    return userAgents[deviceName] || 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Mobile Safari/537.36';
  }

  async generateReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDevices: this.results.length,
        passedDevices: this.results.filter(r => Object.values(r.tests).every(test => test.passed)).length,
        failedDevices: this.results.filter(r => Object.values(r.tests).some(test => !test.passed)).length
      },
      results: this.results
    };

    // Generate JSON report
    const jsonReportPath = path.join(this.outputDir, 'responsive-test-report.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLReport(reportData);
    const htmlReportPath = path.join(this.outputDir, 'responsive-test-report.html');
    await fs.writeFile(htmlReportPath, htmlReport);

    console.log(`📊 Reports generated:`);
    console.log(`   JSON: ${jsonReportPath}`);
    console.log(`   HTML: ${htmlReportPath}`);
  }

  generateHTMLReport(data) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Responsive Design Test Report - ${data.timestamp}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .summary-number { font-size: 2em; font-weight: bold; color: #333; }
        .device-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; }
        .device-card { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .device-header { padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e9ecef; }
        .device-name { font-size: 1.2em; font-weight: bold; margin: 0; }
        .device-dimensions { color: #6c757d; margin: 5px 0 0 0; }
        .test-results { padding: 20px; }
        .test-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f3f4; }
        .test-name { font-weight: 500; }
        .test-status { padding: 4px 12px; border-radius: 20px; font-size: 0.85em; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .issues { margin-top: 15px; }
        .issue { background: #fff3cd; color: #856404; padding: 8px 12px; border-radius: 4px; margin: 5px 0; font-size: 0.9em; }
        .screenshot { margin-top: 15px; text-align: center; }
        .screenshot img { max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 Responsive Design Test Report</h1>
            <p>Generated: ${new Date(data.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <div class="summary-number">${data.summary.totalDevices}</div>
                <div>Total Devices</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #28a745;">${data.summary.passedDevices}</div>
                <div>Passed</div>
            </div>
            <div class="summary-card">
                <div class="summary-number" style="color: #dc3545;">${data.summary.failedDevices}</div>
                <div>Failed</div>
            </div>
        </div>

        <div class="device-grid">
            ${data.results.map(device => `
                <div class="device-card">
                    <div class="device-header">
                        <h3 class="device-name">${device.device}</h3>
                        <p class="device-dimensions">${device.dimensions}</p>
                    </div>
                    <div class="test-results">
                        ${Object.entries(device.tests).map(([testName, result]) => `
                            <div class="test-item">
                                <span class="test-name">${testName.charAt(0).toUpperCase() + testName.slice(1)}</span>
                                <span class="test-status ${result.passed ? 'passed' : 'failed'}">
                                    ${result.passed ? '✓ Pass' : '✗ Fail'}
                                </span>
                            </div>
                            ${result.issues && result.issues.length > 0 ? `
                                <div class="issues">
                                    ${result.issues.map(issue => `<div class="issue">${issue}</div>`).join('')}
                                </div>
                            ` : ''}
                        `).join('')}
                        ${device.issues && device.issues.length > 0 ? `
                            <div class="issues">
                                <strong>Device Issues:</strong>
                                ${device.issues.map(issue => `<div class="issue">${issue.message}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const runner = new ResponsiveTestRunner();
  
  try {
    await runner.initialize();
    await runner.runResponsiveTests();
  } catch (error) {
    console.error('❌ Responsive testing failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = ResponsiveTestRunner;
