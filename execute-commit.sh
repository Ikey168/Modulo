#!/bin/bash

echo "🚀 Executing commit, push, and PR workflow..."

# Make script executable
chmod +x scripts/commit-push-pr.sh

# Execute the workflow
./scripts/commit-push-pr.sh

echo "✅ Workflow completed!"
