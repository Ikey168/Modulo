#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Git workflow for Smart Contract & K8s Auto-Scaling${NC}"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository${NC}"
    exit 1
fi

# Create and switch to feature branch
BRANCH_NAME="feature/note-registry-contract-k8s-autoscaling"
echo -e "${YELLOW}📝 Creating feature branch: ${BRANCH_NAME}${NC}"

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/${BRANCH_NAME}; then
    echo -e "${YELLOW}⚠️  Branch ${BRANCH_NAME} already exists, switching to it${NC}"
    git checkout ${BRANCH_NAME}
else
    git checkout -b ${BRANCH_NAME}
fi

# Add all files
echo -e "${YELLOW}📁 Adding files to git...${NC}"
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
    exit 0
fi

# Show what will be committed
echo -e "${BLUE}📋 Files to be committed:${NC}"
git diff --staged --name-only

# Commit with descriptive message
COMMIT_MESSAGE="feat: add NoteRegistry smart contract and K8s auto-scaling

Smart Contract Features:
- Blockchain-based note registry for integrity verification
- On-chain storage of note hashes with timestamps and metadata
- Ownership management with secure transfers
- Note verification and integrity checking
- Gas-optimized storage and operations
- Comprehensive event logging for audit trails

Kubernetes Auto-Scaling:
- HPA configuration for API with CPU/memory-based scaling (2-10 replicas)
- PostgreSQL cluster with auto-scaling read replicas (1-5 replicas)
- VPA for vertical resource optimization
- Monitoring with ServiceMonitor and PrometheusRules
- Complete deployment automation

Smart Contract Functions:
- registerNote(): Register new note hashes
- updateNote(): Update existing note content
- verifyNote(): Verify note existence and ownership
- transferOwnership(): Transfer note ownership
- deactivateNote(): Soft delete notes

Infrastructure Features:
- Auto-scaling based on traffic and resource utilization
- Database read replica scaling
- Proper resource management and monitoring

Files Added:
- smart-contracts/contracts/NoteRegistry.sol
- k8s/api-hpa.yaml
- k8s/postgresql-cluster.yaml
- k8s/monitoring-servicemonitor.yaml
- scripts/deploy-autoscaling.sh"

echo -e "${YELLOW}💾 Committing changes...${NC}"
git commit -m "${COMMIT_MESSAGE}"

# Push to remote
echo -e "${YELLOW}⬆️  Pushing to remote...${NC}"
git push -u origin ${BRANCH_NAME}

# Create PR using GitHub CLI
echo -e "${YELLOW}🔄 Creating Pull Request...${NC}"

PR_TITLE="feat: Add NoteRegistry Smart Contract and K8s Auto-Scaling"
PR_BODY="## 🎯 Overview
This PR adds the NoteRegistry smart contract for blockchain-based note integrity verification and implements comprehensive Kubernetes auto-scaling for the infrastructure.

## 📋 Smart Contract Features
### NoteRegistry Contract
- **On-chain note registry** for integrity verification and ownership management
- **Hash storage** with timestamps and metadata
- **Ownership management** with secure transfers
- **Note verification** and integrity checking
- **Gas-optimized** storage and operations
- **Event logging** for complete audit trails

### Contract Functions
\`\`\`solidity
// Core functions
registerNote(bytes32 hash, string title) → uint256 noteId
updateNote(uint256 noteId, bytes32 newHash)
verifyNote(bytes32 hash) → (bool exists, bool isOwner, bool isActive)
transferOwnership(uint256 noteId, address newOwner)
deactivateNote(uint256 noteId)

// Query functions
getNote(uint256 noteId) → Note
getNoteByHash(bytes32 hash) → Note
getNotesByOwner(address user) → uint256[]
getActiveNoteCount(address owner) → uint256
\`\`\`

## 🏗️ Kubernetes Auto-Scaling
### API Scaling
- **HPA Configuration**: 2-10 replicas based on CPU (70%) and memory (80%)
- **Resource Management**: Proper requests/limits for effective scaling
- **Stabilization Windows**: Smooth scaling behavior

### Database Scaling
- **PostgreSQL Cluster**: CloudNativePG operator with auto-scaling
- **Read Replicas**: 1-5 instances based on database load
- **Monitoring**: Comprehensive metrics and alerting

## 🔧 Technical Implementation
### Smart Contract Architecture
\`\`\`
NoteRegistry
├── Struct Note (owner, hash, timestamp, title, isActive)
├── Mappings (notes, ownerNotes, hashToNoteId)
├── Events (NoteRegistered, NoteUpdated, etc.)
└── Modifiers (onlyOwner, noteExists, noteActive)
\`\`\`

### Kubernetes Components
- **HPA**: Horizontal Pod Autoscaler for API
- **VPA**: Vertical Pod Autoscaler for optimization
- **ServiceMonitor**: Prometheus monitoring integration
- **PostgreSQL Cluster**: Auto-scaling database setup

## 📊 Files Added/Modified
### Smart Contracts
- \`smart-contracts/contracts/NoteRegistry.sol\` - Main contract
- \`smart-contracts/contracts/NoteRegistry-Remix.sol\` - Remix-ready version

### Kubernetes Configuration
- \`k8s/api-hpa.yaml\` - API Horizontal Pod Autoscaler
- \`k8s/api-deployment.yaml\` - API deployment with resources
- \`k8s/postgresql-cluster.yaml\` - PostgreSQL cluster
- \`k8s/postgres-read-replicas.yaml\` - Read replica scaling
- \`k8s/vpa-config.yaml\` - Vertical Pod Autoscaler
- \`k8s/monitoring-servicemonitor.yaml\` - Monitoring setup

### Scripts
- \`scripts/deploy-autoscaling.sh\` - K8s deployment automation
- \`scripts/commit-push-pr.sh\` - Git workflow automation

## 🧪 Testing
### Smart Contract Testing
\`\`\`bash
# Deploy to Mumbai testnet
# Use Remix IDE or Hardhat for deployment
# Contract address will be available after deployment
\`\`\`

### Kubernetes Testing
\`\`\`bash
# Deploy auto-scaling infrastructure
./scripts/deploy-autoscaling.sh

# Monitor scaling
kubectl get hpa -n modulo -w
kubectl top pods -n modulo

# Test smart contract integration
curl -X POST /api/notes/register -d '{\"hash\":\"0x123...\",\"title\":\"Test\"}'
\`\`\`

## 📈 Expected Outcomes
### Smart Contract
✅ Secure on-chain note registry
✅ Integrity verification for notes
✅ Ownership management and transfers
✅ Gas-optimized operations
✅ Complete audit trail via events

### Infrastructure
✅ API auto-scales based on traffic (2-10 replicas)
✅ Database read replicas scale with load (1-5 replicas)
✅ Optimized resource utilization
✅ Comprehensive monitoring and alerting

## 🔐 Security Considerations
- **Access Control**: onlyOwner modifiers for note operations
- **Input Validation**: Hash and title validation
- **Duplicate Prevention**: Hash uniqueness enforcement
- **Safe Transfers**: Zero address and self-transfer protection

## 🚀 Deployment Notes
### Smart Contract
1. Deploy to Mumbai testnet first for testing
2. Verify contract on PolygonScan
3. Update frontend with contract address
4. Test all functions thoroughly

### Kubernetes
1. Ensure PostgreSQL operator is installed
2. Configure monitoring stack (Prometheus)
3. Set up proper RBAC permissions
4. Configure storage classes

## ✅ Checklist
- [x] Smart contract implemented with all features
- [x] Gas optimization applied
- [x] Comprehensive event logging
- [x] API HPA configuration
- [x] Database auto-scaling setup
- [x] Monitoring and alerting
- [x] Deployment scripts created
- [x] Documentation updated

## 📝 Next Steps
1. Deploy smart contract to testnet
2. Integrate contract with frontend
3. Deploy K8s auto-scaling configuration
4. Monitor scaling behavior
5. Optimize based on real-world usage"

# Create the PR
if command -v gh &> /dev/null; then
    echo -e "${GREEN}📝 Creating PR with GitHub CLI...${NC}"
    gh pr create \
        --title "${PR_TITLE}" \
        --body "${PR_BODY}" \
        --label "enhancement,smart-contract,kubernetes,autoscaling,blockchain" \
        --assignee "@me"
    
    echo -e "${GREEN}✅ Pull Request created successfully!${NC}"
    
    # Open PR in browser
    echo -e "${BLUE}🌐 Opening PR in browser...${NC}"
    gh pr view --web
else
    echo -e "${RED}❌ GitHub CLI not found. Please install 'gh' to create PR automatically${NC}"
    echo -e "${YELLOW}📝 Manual PR creation required:${NC}"
    echo -e "   Title: ${PR_TITLE}"
    echo -e "   Branch: ${BRANCH_NAME}"
    echo -e "   Base: main"
fi

echo -e "${GREEN}🎉 Git workflow completed!${NC}"
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   Branch: ${BRANCH_NAME}"
echo -e "   Files: $(git diff --name-only HEAD~1 2>/dev/null | wc -l) files changed"
echo -e "   Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'pending')"
echo -e "${YELLOW}🔗 Smart Contract: NoteRegistry.sol ready for deployment${NC}"
echo -e "${YELLOW}⚙️  Kubernetes: Auto-scaling configuration ready${NC}"

# Make the script executable and run it
chmod +x /workspaces/Modulo/scripts/commit-push-pr.sh
cd /workspaces/Modulo
./scripts/commit-push-pr.sh
