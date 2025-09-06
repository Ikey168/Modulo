#!/bin/bash

# 📱 Mobile App Testing Framework Setup Script
# Comprehensive setup for all mobile testing components

set -e  # Exit on any error

echo "🚀 Setting up Mobile App Testing Framework for Modulo"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on supported OS
check_os() {
    print_status "Checking operating system..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_success "Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        print_success "macOS detected"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
}

# Check for required system dependencies
check_dependencies() {
    print_status "Checking system dependencies..."
    
    local missing_deps=()
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    else
        NODE_VERSION=$(node -v)
        print_success "Node.js found: $NODE_VERSION"
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    else
        NPM_VERSION=$(npm -v)
        print_success "npm found: $NPM_VERSION"
    fi
    
    # Check for Java (required for Android)
    if ! command -v java &> /dev/null; then
        missing_deps+=("Java JDK")
    else
        JAVA_VERSION=$(java -version 2>&1 | head -n 1)
        print_success "Java found: $JAVA_VERSION"
    fi
    
    # Check for Git
    if ! command -v git &> /dev/null; then
        missing_deps+=("Git")
    else
        print_success "Git found"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        exit 1
    fi
}

# Install npm dependencies
install_npm_dependencies() {
    print_status "Installing npm dependencies..."
    
    cd "$(dirname "$0")"
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in current directory"
        exit 1
    fi
    
    npm install
    print_success "npm dependencies installed"
}

# Setup Android testing environment
setup_android() {
    print_status "Setting up Android testing environment..."
    
    # Check for Android SDK
    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
        print_warning "ANDROID_HOME or ANDROID_SDK_ROOT not set"
        print_warning "Please install Android SDK and set environment variables"
        print_warning "You can install Android SDK via Android Studio or command line tools"
        
        # Provide setup instructions
        echo ""
        echo "Android SDK Setup Instructions:"
        echo "1. Download Android Studio from: https://developer.android.com/studio"
        echo "2. Install Android Studio and SDK"
        echo "3. Add to your ~/.bashrc or ~/.zshrc:"
        echo "   export ANDROID_HOME=\$HOME/Android/Sdk"
        echo "   export PATH=\$PATH:\$ANDROID_HOME/emulator"
        echo "   export PATH=\$PATH:\$ANDROID_HOME/tools"
        echo "   export PATH=\$PATH:\$ANDROID_HOME/tools/bin"
        echo "   export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
        echo ""
        
        return 1
    else
        print_success "Android SDK found at: ${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
    fi
    
    # Check for adb
    if command -v adb &> /dev/null; then
        ADB_VERSION=$(adb version | head -n 1)
        print_success "ADB found: $ADB_VERSION"
    else
        print_warning "ADB not found in PATH"
    fi
    
    # Check for emulator
    if command -v emulator &> /dev/null; then
        print_success "Android Emulator found"
        
        # List available AVDs
        print_status "Available Android Virtual Devices:"
        emulator -list-avds || print_warning "No AVDs found. Please create an AVD for testing."
    else
        print_warning "Android Emulator not found in PATH"
    fi
}

# Setup iOS testing environment (macOS only)
setup_ios() {
    if [[ "$OS" == "macos" ]]; then
        print_status "Setting up iOS testing environment..."
        
        # Check for Xcode
        if command -v xcodebuild &> /dev/null; then
            XCODE_VERSION=$(xcodebuild -version | head -n 1)
            print_success "Xcode found: $XCODE_VERSION"
            
            # Check for iOS Simulator
            if command -v xcrun &> /dev/null; then
                print_success "iOS Simulator tools found"
                
                # List available simulators
                print_status "Available iOS Simulators:"
                xcrun simctl list devices available | grep iPhone || print_warning "No iPhone simulators found"
            else
                print_warning "xcrun not found - iOS Simulator may not be available"
            fi
        else
            print_warning "Xcode not found - iOS testing will not be available"
            print_warning "Install Xcode from the Mac App Store for iOS testing"
        fi
        
        # Check for CocoaPods (if needed for iOS dependencies)
        if command -v pod &> /dev/null; then
            POD_VERSION=$(pod --version)
            print_success "CocoaPods found: $POD_VERSION"
        else
            print_status "Installing CocoaPods..."
            sudo gem install cocoapods || print_warning "Failed to install CocoaPods"
        fi
    else
        print_warning "iOS testing setup skipped (macOS required)"
    fi
}

# Setup Chrome/Chromium for web testing
setup_chrome() {
    print_status "Setting up Chrome for web testing..."
    
    if command -v google-chrome &> /dev/null; then
        CHROME_VERSION=$(google-chrome --version)
        print_success "Google Chrome found: $CHROME_VERSION"
    elif command -v chromium-browser &> /dev/null; then
        CHROMIUM_VERSION=$(chromium-browser --version)
        print_success "Chromium found: $CHROMIUM_VERSION"
    elif command -v "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" &> /dev/null; then
        CHROME_VERSION=$("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version)
        print_success "Google Chrome found: $CHROME_VERSION"
    else
        print_warning "Chrome/Chromium not found"
        print_warning "Please install Chrome or Chromium for web-based mobile testing"
        
        if [[ "$OS" == "linux" ]]; then
            echo "Install Chrome on Linux:"
            echo "  wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -"
            echo "  echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' | sudo tee /etc/apt/sources.list.d/google-chrome.list"
            echo "  sudo apt-get update && sudo apt-get install google-chrome-stable"
        elif [[ "$OS" == "macos" ]]; then
            echo "Install Chrome on macOS:"
            echo "  Download from: https://www.google.com/chrome/"
            echo "  Or use Homebrew: brew install --cask google-chrome"
        fi
    fi
}

# Create test configuration files
create_test_configs() {
    print_status "Creating test configuration files..."
    
    # Create .detoxrc.js if it doesn't exist
    if [ ! -f ".detoxrc.js" ]; then
        cat > .detoxrc.js << 'EOF'
/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'mocha',
      config: 'e2e/.mocharc.yml'
    },
    jest: {
      setupFilesAfterEnv: ['<rootDir>/e2e/init.js']
    }
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: '../android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd ../android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug'
    },
    'ios.debug': {
      type: 'ios.app',
      binaryPath: '../ios/build/Build/Products/Debug-iphonesimulator/Modulo.app',
      build: 'cd ../ios && xcodebuild -workspace Modulo.xcworkspace -scheme Modulo -configuration Debug -sdk iphonesimulator -derivedDataPath ./build'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14'
      }
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_3a_API_30_x86'
      }
    }
  },
  configurations: {
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    },
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    }
  }
};
EOF
        print_success "Created .detoxrc.js configuration"
    fi
    
    # Create mocha configuration for e2e tests
    mkdir -p e2e
    if [ ! -f "e2e/.mocharc.yml" ]; then
        cat > e2e/.mocharc.yml << 'EOF'
recursive: true
timeout: 120000
bail: false
reporter: 'spec'
require:
  - 'e2e/init.js'
EOF
        print_success "Created Mocha configuration"
    fi
    
    # Create init file for e2e tests
    if [ ! -f "e2e/init.js" ]; then
        cat > e2e/init.js << 'EOF'
const { device } = require('detox');

before(async () => {
  await device.launchApp();
});

beforeEach(async () => {
  await device.reloadReactNative();
});

after(async () => {
  await device.terminateApp();
});
EOF
        print_success "Created e2e test initialization file"
    fi
    
    # Create results directory
    mkdir -p results/{responsive,performance,accessibility,security}
    print_success "Created results directories"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        cat > .env << 'EOF'
# Mobile Testing Configuration
MOBILE_TEST_URL=http://localhost:3000
API_KEY=test-api-key
STRICT_MODE=false

# Test Timeouts (in milliseconds)
DEFAULT_TIMEOUT=30000
NETWORK_TIMEOUT=10000
ELEMENT_TIMEOUT=5000

# Device Testing
ANDROID_AVD=Pixel_3a_API_30_x86
IOS_SIMULATOR=iPhone 14

# Performance Testing
PERFORMANCE_BUDGET_FCP=2000
PERFORMANCE_BUDGET_LCP=3000
PERFORMANCE_BUDGET_CLS=0.1

# Security Testing
SECURITY_SCAN_LEVEL=standard
OWASP_COMPLIANCE=true

# Reporting
GENERATE_HTML_REPORTS=true
GENERATE_JSON_REPORTS=true
REPORT_OUTPUT_DIR=./results
EOF
        print_success "Created .env configuration file"
    fi
    
    # Create .env.example file
    if [ ! -f ".env.example" ]; then
        cp .env .env.example
        print_success "Created .env.example file"
    fi
}

# Validate installation
validate_installation() {
    print_status "Validating installation..."
    
    local validation_passed=true
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_error "node_modules directory not found"
        validation_passed=false
    fi
    
    # Check for key testing dependencies
    local key_deps=("detox" "puppeteer" "lighthouse" "@axe-core/puppeteer")
    
    for dep in "${key_deps[@]}"; do
        if [ ! -d "node_modules/$dep" ]; then
            print_error "Required dependency not found: $dep"
            validation_passed=false
        fi
    done
    
    if [ "$validation_passed" = true ]; then
        print_success "Installation validation passed"
        return 0
    else
        print_error "Installation validation failed"
        return 1
    fi
}

# Run a quick test to verify setup
run_quick_test() {
    print_status "Running quick validation test..."
    
    # Test Node.js modules loading
    node -e "
        try {
            require('puppeteer');
            require('lighthouse');
            console.log('✅ Core testing modules loaded successfully');
        } catch (error) {
            console.error('❌ Error loading testing modules:', error.message);
            process.exit(1);
        }
    "
    
    if [ $? -eq 0 ]; then
        print_success "Quick validation test passed"
    else
        print_error "Quick validation test failed"
        return 1
    fi
}

# Display setup completion summary
show_setup_summary() {
    echo ""
    echo "=================================================="
    print_success "Mobile App Testing Framework Setup Complete! 🎉"
    echo "=================================================="
    echo ""
    echo "📱 Available Testing Frameworks:"
    echo "  • E2E Testing (Detox) - Cross-platform mobile app testing"
    echo "  • Responsive Testing (Puppeteer) - Multi-device responsive design testing"
    echo "  • Performance Testing (Lighthouse) - Mobile performance and Core Web Vitals"
    echo "  • Accessibility Testing (Axe) - WCAG compliance and mobile accessibility"
    echo "  • Security Testing (Custom) - OWASP Mobile Top 10 compliance"
    echo ""
    echo "🚀 Quick Start Commands:"
    echo "  npm run test:e2e:android       # Run Android E2E tests"
    echo "  npm run test:e2e:ios          # Run iOS E2E tests (macOS only)"
    echo "  npm run test:responsive       # Run responsive design tests"
    echo "  npm run test:performance      # Run performance tests"
    echo "  npm run test:accessibility    # Run accessibility tests"
    echo "  npm run test:security         # Run security tests"
    echo "  npm run test:mobile:all       # Run all mobile tests"
    echo ""
    echo "📁 Test Results Location:"
    echo "  ./results/                    # All test results and reports"
    echo ""
    echo "⚙️  Configuration Files:"
    echo "  .detoxrc.js                   # Detox E2E testing configuration"
    echo "  .env                          # Environment variables"
    echo "  package.json                  # npm scripts and dependencies"
    echo ""
    print_warning "Next Steps:"
    echo "1. Configure your mobile app URLs in .env file"
    echo "2. Set up Android emulator or iOS simulator"
    echo "3. Build your mobile app for testing"
    echo "4. Run individual test suites or the complete test suite"
    echo ""
    print_status "For detailed documentation, see the README files in each test directory."
}

# Main setup function
main() {
    echo "Starting Mobile App Testing Framework setup..."
    echo ""
    
    # Run setup steps
    check_os
    check_dependencies
    install_npm_dependencies
    setup_android
    setup_ios
    setup_chrome
    create_test_configs
    setup_environment
    
    if validate_installation && run_quick_test; then
        show_setup_summary
    else
        print_error "Setup completed with issues. Please review the errors above."
        exit 1
    fi
}

# Run main function
main "$@"
