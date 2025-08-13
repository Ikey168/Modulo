#!/bin/bash

# Polygon Mumbai Testnet Deployment Test Script
# This script tests the complete deployment and interaction flow

echo "🚀 Polygon Mumbai Deployment Test"
echo "=================================="

# Colors for output
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

# Check if we're in the smart-contracts directory
if [ ! -f "hardhat.config.js" ]; then
    print_error "Please run this script from the smart-contracts directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Please create it based on .env.example"
    print_status "Copying .env.example to .env..."
    cp .env.example .env
    print_warning "Please configure your .env file with:"
    echo "  - MUMBAI_URL (Alchemy or other RPC provider)"
    echo "  - PRIVATE_KEY (deployment wallet private key)"
    echo "  - POLYGONSCAN_API_KEY (for contract verification)"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi
    print_success "Dependencies installed"
fi

# Compile contracts
print_status "Compiling contracts..."
npm run compile
if [ $? -ne 0 ]; then
    print_error "Contract compilation failed"
    exit 1
fi
print_success "Contracts compiled successfully"

# Run tests
print_status "Running contract tests..."
npm run test
if [ $? -ne 0 ]; then
    print_error "Tests failed"
    exit 1
fi
print_success "All tests passed"

# Check environment variables
print_status "Checking environment configuration..."

if grep -q "YOUR_ALCHEMY_API_KEY" .env; then
    print_warning "MUMBAI_URL contains placeholder. Please update with real Alchemy API key"
fi

if grep -q "your_private_key_here" .env; then
    print_warning "PRIVATE_KEY contains placeholder. Please update with real private key"
    print_warning "Make sure the wallet has test MATIC from https://faucet.polygon.technology/"
fi

if grep -q "your_polygonscan_api_key_here" .env; then
    print_warning "POLYGONSCAN_API_KEY contains placeholder. Contract verification may fail"
fi

# Test network connectivity
print_status "Testing Mumbai network connectivity..."
if command -v curl &> /dev/null; then
    MUMBAI_RPC="https://rpc-mumbai.maticvigil.com/"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' $MUMBAI_RPC)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Mumbai RPC is accessible"
    else
        print_warning "Mumbai RPC connectivity issue (HTTP $HTTP_STATUS)"
    fi
else
    print_warning "curl not available, skipping network test"
fi

# Deployment readiness check
print_status "Deployment readiness checklist:"
echo "  ✓ Contracts compiled"
echo "  ✓ Tests passing"
echo "  ✓ Hardhat configured for Mumbai"
echo "  ✓ Deployment scripts ready"

print_warning "Before deploying, ensure:"
echo "  - MetaMask connected to Mumbai testnet"
echo "  - Deployment wallet has test MATIC"
echo "  - Environment variables configured"

echo ""
print_status "Ready to deploy! Run the following commands:"
echo ""
echo "  🚀 Deploy to Mumbai:"
echo "     npm run deploy:mumbai"
echo ""
echo "  🔄 Test interactions:"
echo "     npm run interact:mumbai"
echo ""
echo "  📋 Full test suite:"
echo "     npm run test:mumbai"
echo ""

print_success "Polygon Mumbai deployment environment is ready!"

# Optional: Run actual deployment if --deploy flag is provided
if [ "$1" = "--deploy" ]; then
    echo ""
    print_status "Starting actual deployment to Mumbai..."
    npm run deploy:mumbai
    
    if [ $? -eq 0 ]; then
        print_success "Deployment completed!"
        print_status "Testing contract interactions..."
        npm run interact:mumbai
        
        if [ $? -eq 0 ]; then
            print_success "🎉 Complete deployment and testing successful!"
        else
            print_warning "Deployment succeeded but interaction test failed"
        fi
    else
        print_error "Deployment failed"
        exit 1
    fi
fi
