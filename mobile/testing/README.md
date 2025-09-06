# 📱 Mobile App Testing Framework

## Overview

The **Mobile App Testing Framework** provides comprehensive testing capabilities for the Modulo mobile application across multiple dimensions:

- **🧪 E2E Testing** - Cross-platform end-to-end testing with Detox
- **📐 Responsive Testing** - Multi-device responsive design validation
- **⚡ Performance Testing** - Mobile performance and Core Web Vitals analysis
- **♿ Accessibility Testing** - WCAG compliance and mobile accessibility
- **🔒 Security Testing** - OWASP Mobile Top 10 compliance validation

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm 9+
- **Java JDK** 8+ (for Android testing)
- **Android SDK** (for Android testing)
- **Xcode** (for iOS testing - macOS only)
- **Chrome/Chromium** (for web-based testing)

### Installation

1. **Clone and navigate to testing directory:**
   ```bash
   cd mobile/testing
   ```

2. **Run setup script:**
   ```bash
   ./setup.sh
   ```

3. **Install dependencies manually (if setup script fails):**
   ```bash
   npm install
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your specific configuration
   ```

### Basic Usage

```bash
# Run all mobile tests
npm run test:mobile:all

# Run specific test types
npm run test:e2e:android          # Android E2E tests
npm run test:e2e:ios             # iOS E2E tests
npm run test:responsive          # Responsive design tests
npm run test:performance         # Performance tests
npm run test:accessibility       # Accessibility tests
npm run test:security           # Security tests
```

## 📋 Testing Framework Components

### 1. End-to-End Testing (Detox)

**Location:** `e2e/mobile-app.e2e.js`

**Features:**
- Cross-platform mobile app testing (Android/iOS)
- Authentication flow testing
- Notes management functionality
- Synchronization testing
- Performance validation
- UI/UX testing
- Accessibility compliance
- Security validation

**Configuration:** `.detoxrc.js`

**Usage:**
```bash
# Android testing
npm run test:e2e:android

# iOS testing (macOS only)
npm run test:e2e:ios

# Build apps for testing
npm run build:e2e:android
npm run build:e2e:ios
```

**Test Scenarios:**
- 🔐 Authentication & Authorization
- 📝 Notes CRUD Operations
- 🏷️ Tags & Categories
- 🔄 Data Synchronization
- ⚡ Performance Validation
- 🎨 UI/UX Testing
- 🔔 Notifications
- 🔒 Security Features
- ♿ Accessibility Support

### 2. Responsive Design Testing

**Location:** `responsive/responsive-test-runner.js`

**Features:**
- Multi-device testing (phones, tablets, foldables)
- Layout integrity validation
- Touch target size verification
- Navigation usability testing
- Content readability assessment
- Interactive element validation
- Performance across devices
- Visual regression testing

**Supported Devices:**
- **Mobile:** iPhone SE, iPhone 12, iPhone 14 Pro Max, Galaxy S21, Pixel 5
- **Tablets:** iPad, iPad Pro, Galaxy Tab S7
- **Foldable:** Galaxy Z Fold3 (folded/unfolded)
- **Desktop:** Reference testing at various resolutions

**Usage:**
```bash
npm run test:responsive
```

**Test Coverage:**
- Layout responsiveness across screen sizes
- Touch target accessibility (minimum 44×44px)
- Text readability and contrast
- Navigation patterns for mobile/tablet
- Performance impact of responsive design
- Visual consistency across devices

### 3. Performance Testing (Lighthouse)

**Location:** `performance/mobile-performance-test.js`

**Features:**
- Core Web Vitals measurement
- Network condition simulation
- Battery usage analysis
- Memory usage monitoring
- App startup time measurement
- Scroll performance testing
- Touch responsiveness validation

**Test Configurations:**
- **Mobile 3G Slow** - Simulates slow 3G networks
- **Mobile 3G Fast** - Simulates fast 3G networks  
- **Mobile 4G** - Simulates 4G networks
- **Mobile WiFi** - Simulates WiFi connectivity

**Performance Thresholds:**
- **First Contentful Paint:** < 2 seconds
- **Speed Index:** < 3 seconds
- **Largest Contentful Paint:** < 3 seconds
- **Time to Interactive:** < 5 seconds
- **Total Blocking Time:** < 300ms
- **Cumulative Layout Shift:** < 0.1

**Usage:**
```bash
npm run test:performance
```

### 4. Accessibility Testing

**Location:** `accessibility/accessibility-test-runner.js`

**Features:**
- WCAG 2.1 AA compliance validation
- Screen reader support testing
- Touch target size verification
- Color contrast analysis
- Focus management testing
- Content size adaptability
- Gesture support validation
- Orientation support testing

**Test Scenarios:**
- **Automated WCAG Testing** - Using Axe accessibility engine
- **Touch Targets** - Minimum 44×44px validation
- **Screen Reader** - ARIA labels and semantic markup
- **Focus Management** - Logical tab order and focus indicators
- **Content Sizes** - Support for Dynamic Type/font scaling
- **Gestures** - Alternative input methods for gestures
- **Orientation** - Portrait/landscape support

**Usage:**
```bash
npm run test:accessibility
```

### 5. Security Testing

**Location:** `security/mobile-security-test.js`

**Features:**
- OWASP Mobile Top 10 compliance
- Authentication security testing
- Data protection validation
- Network security assessment
- Input validation testing
- Session management verification
- Cryptography validation
- Platform security testing
- Privacy compliance checking

**Security Categories:**
1. **Authentication** - Password policies, MFA, biometrics
2. **Authorization** - Role-based access, permissions
3. **Data Protection** - Encryption, sensitive data handling
4. **Network Security** - TLS, certificate validation, API security
5. **Input Validation** - XSS, SQL injection, path traversal protection
6. **Session Management** - Secure sessions, timeouts, fixation
7. **Cryptography** - Strong algorithms, key management
8. **Platform Security** - App permissions, secure storage, code protection
9. **Privacy Compliance** - GDPR, CCPA, consent management

**Usage:**
```bash
npm run test:security
```

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Test Target Configuration
MOBILE_TEST_URL=http://localhost:3000
API_KEY=test-api-key

# Device Configuration
ANDROID_AVD=Pixel_3a_API_30_x86
IOS_SIMULATOR=iPhone 14

# Performance Budgets
PERFORMANCE_BUDGET_FCP=2000     # First Contentful Paint (ms)
PERFORMANCE_BUDGET_LCP=3000     # Largest Contentful Paint (ms)
PERFORMANCE_BUDGET_CLS=0.1      # Cumulative Layout Shift

# Security Testing
SECURITY_SCAN_LEVEL=standard
OWASP_COMPLIANCE=true

# Test Execution
DEFAULT_TIMEOUT=30000
STRICT_MODE=false

# Reporting
GENERATE_HTML_REPORTS=true
GENERATE_JSON_REPORTS=true
REPORT_OUTPUT_DIR=./results
```

### Detox Configuration (.detoxrc.js)

The framework includes comprehensive Detox configuration for:
- Android APK testing
- iOS Simulator testing
- Device management
- Build configurations
- Test runner setup

## 📊 Test Reports

All testing frameworks generate comprehensive reports in multiple formats:

### Report Locations
```
results/
├── e2e/                    # E2E test results and screenshots
├── responsive/             # Responsive design test reports
│   ├── responsive-test-report.html
│   └── device-screenshots/
├── performance/            # Performance test reports
│   ├── mobile-performance-report.html
│   └── lighthouse-*.html
├── accessibility/          # Accessibility test reports
│   ├── accessibility-test-report.html
│   └── accessibility-test-report.json
└── security/              # Security test reports
    ├── mobile-security-report.html
    ├── mobile-security-report.json
    └── owasp-mobile-top10-report.json
```

### Report Features
- **HTML Reports** - Interactive, visual reports with charts and graphs
- **JSON Reports** - Machine-readable data for CI/CD integration
- **Screenshots** - Visual validation and regression detection
- **Metrics Tracking** - Performance trends and compliance tracking
- **Issue Tracking** - Detailed issue descriptions and remediation advice

## 🏗️ Architecture

```
mobile/testing/
├── package.json              # Dependencies and scripts
├── setup.sh                 # Automated setup script
├── .detoxrc.js              # Detox configuration
├── .env                     # Environment configuration
├── e2e/                     # End-to-end tests
│   ├── mobile-app.e2e.js    # Main E2E test suite
│   ├── .mocharc.yml         # Mocha configuration
│   └── init.js              # Test initialization
├── responsive/              # Responsive design tests
│   └── responsive-test-runner.js
├── performance/             # Performance tests
│   └── mobile-performance-test.js
├── accessibility/           # Accessibility tests
│   └── accessibility-test-runner.js
├── security/               # Security tests
│   └── mobile-security-test.js
└── results/                # Test output directory
    ├── responsive/
    ├── performance/
    ├── accessibility/
    └── security/
```

## 🔌 CI/CD Integration

### GitHub Actions Example

```yaml
name: Mobile Testing
on: [push, pull_request]

jobs:
  mobile-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Setup Mobile Testing
        run: |
          cd mobile/testing
          npm install
      
      - name: Run Mobile Tests
        run: |
          cd mobile/testing
          npm run test:mobile:all
        env:
          MOBILE_TEST_URL: ${{ secrets.TEST_URL }}
          API_KEY: ${{ secrets.API_KEY }}
      
      - name: Upload Test Reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: mobile-test-reports
          path: mobile/testing/results/
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('Setup') {
            steps {
                sh 'cd mobile/testing && npm install'
            }
        }
        
        stage('Mobile Tests') {
            parallel {
                stage('Responsive') {
                    steps {
                        sh 'cd mobile/testing && npm run test:responsive'
                    }
                }
                stage('Performance') {
                    steps {
                        sh 'cd mobile/testing && npm run test:performance'
                    }
                }
                stage('Accessibility') {
                    steps {
                        sh 'cd mobile/testing && npm run test:accessibility'
                    }
                }
                stage('Security') {
                    steps {
                        sh 'cd mobile/testing && npm run test:security'
                    }
                }
            }
        }
    }
    
    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'mobile/testing/results',
                reportFiles: '**/*.html',
                reportName: 'Mobile Test Reports'
            ])
        }
    }
}
```

## 🚦 Best Practices

### Test Organization
- **Separate Concerns** - Each testing framework focuses on specific aspects
- **Reusable Components** - Common utilities shared across test types
- **Comprehensive Coverage** - Tests cover functionality, performance, accessibility, and security
- **Clear Naming** - Descriptive test names and organized test suites

### Performance Optimization
- **Parallel Execution** - Run independent tests in parallel
- **Resource Management** - Proper cleanup of browser instances and resources
- **Selective Testing** - Target specific test scenarios based on changes
- **Caching** - Cache dependencies and build artifacts

### Maintenance
- **Regular Updates** - Keep testing dependencies up to date
- **Threshold Tuning** - Adjust performance and quality thresholds based on requirements
- **Device Coverage** - Update device configurations to match target audience
- **Documentation** - Maintain comprehensive documentation and examples

## 🔍 Troubleshooting

### Common Issues

**1. Android Emulator Not Starting**
```bash
# Check available AVDs
emulator -list-avds

# Start emulator manually
emulator -avd Pixel_3a_API_30_x86

# Check ANDROID_HOME
echo $ANDROID_HOME
```

**2. iOS Simulator Issues (macOS)**
```bash
# List available simulators
xcrun simctl list devices available

# Boot specific simulator
xcrun simctl boot "iPhone 14"

# Reset simulator
xcrun simctl erase all
```

**3. Chrome/Puppeteer Issues**
```bash
# Install Chrome dependencies (Linux)
sudo apt-get install -y libgbm-dev

# Check Chrome installation
google-chrome --version
which google-chrome
```

**4. Network/Timeout Issues**
- Increase timeouts in `.env` configuration
- Check network connectivity
- Verify test URLs are accessible
- Configure proxy settings if needed

**5. Permission Issues**
```bash
# Make setup script executable
chmod +x setup.sh

# Fix npm permissions
sudo npm config set unsafe-perm true
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Environment variable
DEBUG=1 npm run test:mobile:all

# Or in .env file
DEBUG_MODE=true
VERBOSE_LOGGING=true
```

### Performance Issues

- **Reduce concurrent tests** - Lower parallelization for resource-constrained environments
- **Increase timeouts** - Adjust timeout values for slower systems
- **Skip visual tests** - Disable screenshot capture for faster execution
- **Use headless mode** - Enable headless browser mode

## 📚 Additional Resources

- **Detox Documentation** - https://github.com/wix/Detox/tree/master/docs
- **Lighthouse Documentation** - https://developers.google.com/web/tools/lighthouse
- **Axe Accessibility** - https://github.com/dequelabs/axe-core
- **OWASP Mobile Top 10** - https://owasp.org/www-project-mobile-top-10/
- **WCAG Guidelines** - https://www.w3.org/WAI/WCAG21/quickref/

## 🤝 Contributing

1. Follow existing code patterns and naming conventions
2. Add comprehensive test coverage for new features
3. Update documentation for any configuration changes
4. Test across multiple devices and platforms
5. Ensure all tests pass before submitting changes

## 📝 License

This mobile testing framework is part of the Modulo project and follows the same MIT license terms.
