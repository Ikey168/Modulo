#!/bin/bash

# Setup script for Modulo development environment
echo "🚀 Setting up Modulo development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "❌ Java is not installed. Please install Java 11+ and try again."
    exit 1
fi

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
    echo "❌ Maven is not installed. Please install Maven and try again."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install husky hooks
echo "🪝 Setting up Git hooks..."
npx husky install

echo "🎉 Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run build          - Build both frontend and backend"
echo "  npm run build:frontend - Build frontend only"
echo "  npm run build:backend  - Build backend only"
echo "  npm run start          - Start with Docker Compose"
echo "  npm run start:dev      - Start development environment"
echo "  npm run test           - Run all tests"
echo "  npm run clean          - Clean all build artifacts"
echo ""
echo "Git hooks are now active:"
echo "  - Commit message validation (conventional commits)"
echo "  - Pre-commit linting checks"
echo ""
echo "For conventional commits guide, see: docs/CONVENTIONAL_COMMITS.md"
