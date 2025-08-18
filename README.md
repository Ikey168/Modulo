# Modulo

A comprehensive note-taking and knowledge management application with blockchain integration, real-time synchronization, and multi-database support.

<!-- Updated for Issue #97 multi-arch Docker builds with SBOM -->

[![CI/CD](https://github.com/Ikey168/Modulo/actions/workflows/ci.yml/badge.svg)](https://github.com/Ikey168/Modulo/actions/workflows/ci.yml)
[![Release](https://github.com/Ikey168/Modulo/actions/workflows/release-please.yml/badge.svg)](https://github.com/Ikey168/Modulo/actions/workflows/release-please.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📝 **Rich Note-Taking**: Create, edit, and organize notes with full-text search
- 🔗 **Blockchain Integration**: Secure note storage and verification using smart contracts
- 🌐 **Real-time Sync**: WebSocket-based synchronization across devices
- 🔄 **Offline Support**: SQLite database for offline functionality
- 🔐 **Multi-Auth**: Google OAuth, Azure AD, and MetaMask authentication
- 🗄️ **Multi-Database**: PostgreSQL for production, SQLite for offline
- 🐳 **Containerized**: Docker and Kubernetes deployment ready
- 📱 **Responsive**: Modern React-based UI with TypeScript

## Project Structure

```
├── frontend/           # React + TypeScript + Vite frontend
├── backend/           # Spring Boot REST API + WebSocket
├── smart-contracts/   # Ethereum smart contracts (Hardhat)
├── database/         # Database schemas and migrations
├── k8s/              # Kubernetes deployment manifests
├── azure/            # Azure deployment scripts
└── docs/             # Documentation
```

## Quick Start

### Prerequisites

- **Node.js** 18+ 
- **Java** 11+
- **Maven** 3.8+
- **Docker** & **Docker Compose**

### Setup

1. **Clone and setup the project:**
   ```bash
   git clone https://github.com/Ikey168/Modulo.git
   cd Modulo
   ./setup.sh
   ```

2. **Start with Docker Compose:**
   ```bash
   npm run start
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - Database: localhost:5432

### Development Setup

1. **Install dependencies:**
   ```bash
   npm install                    # Root dependencies & Git hooks
   cd frontend && npm install     # Frontend dependencies
   ```

2. **Start development servers:**
   ```bash
   # Backend (Spring Boot)
   cd backend
   mvn spring-boot:run

   # Frontend (Vite dev server)
   cd frontend  
   npm run dev

   # Database (PostgreSQL)
   docker compose up postgres
   ```

## Available Scripts

```bash
npm run build          # Build both frontend and backend
npm run build:frontend # Build frontend only
npm run build:backend  # Build backend only  
npm run start          # Start with Docker Compose
npm run start:dev      # Start development environment
npm run test           # Run all tests
npm run clean          # Clean all build artifacts
```

## Architecture

```mermaid
graph TB
    A[React Frontend] --> B[Spring Boot Backend]
    B --> C[PostgreSQL Database]
    B --> D[SQLite Offline DB]
    B --> E[Ethereum Network]
    B --> F[WebSocket Service]
    A --> F
    E --> G[Smart Contracts]
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Redux Toolkit for state management
- React Query for API state
- Ethers.js for Web3 integration

**Backend:**
- Spring Boot 2.7 with Java 11
- Spring Security for authentication
- Spring WebSocket for real-time features
- JPA/Hibernate for database access
- Web3j for blockchain integration
- Flyway for database migrations

**Infrastructure:**
- PostgreSQL (primary database)
- SQLite (offline support)
- Redis (caching & sessions)
- Docker & Docker Compose
- Kubernetes deployment
- GitHub Actions CI/CD

## Releases & Versioning

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and automated releases:

- **Automatic versioning** based on commit types
- **Automated changelog** generation
- **GitHub releases** with artifacts (JAR, SBOM, Docker digests)
- **Semantic versioning** (SemVer)

### Commit Message Format

```
<type>[optional scope]: <description>

Examples:
feat(auth): add MetaMask authentication support
fix(websocket): resolve connection timeout issues  
docs: update deployment instructions
```

See [Conventional Commits Guide](docs/CONVENTIONAL_COMMITS.md) for details.

## Deployment

### Docker Compose (Recommended)

```bash
# Production
docker compose up -d

# Development  
docker compose -f docker-compose.dev.yml up -d
```

### Kubernetes

```bash
cd k8s
kubectl apply -f .
```

### Azure

```bash
cd azure
./deploy-infrastructure.sh
./deploy-app-service.sh
```

## Observability & Monitoring

Modulo includes a comprehensive observability stack with **Golden Signals monitoring**, distributed tracing, and alerting:

### 🚀 Golden Signals Dashboards

- **🔥 Application Performance**: Request rate, error rate, P95 latency, CPU/memory saturation
- **☕ JVM Performance**: Heap usage, GC metrics, thread states, class loading
- **🗄️ Database Performance**: Connection pool monitoring, query performance, HikariCP metrics  
- **🔗 Sync & Blockchain**: WebSocket connections, blockchain transactions, sync operations

### 📊 Technology Stack

- **Prometheus**: Metrics collection and alerting (v2.47.2)
- **Grafana**: Dashboard visualization (v10.1.5)
- **Alertmanager**: Alert routing and notifications (v0.26.0)
- **Tempo**: Distributed tracing with OpenTelemetry
- **Loki**: Log aggregation and correlation

### 🚨 Alerting Rules

**Golden Signal Alerts:**
- High error rate (>5% critical, >1% warning)
- High P95 latency (>1000ms critical, >500ms warning)
- CPU/Memory saturation (>85%)
- Database connection pool alerts
- WebSocket connection monitoring
- Blockchain operation failures

### Quick Start

```bash
# Deploy observability stack
cd k8s
./deploy-observability.sh

# Access dashboards
kubectl port-forward -n observability svc/grafana 3000:3000 &
kubectl port-forward -n observability svc/prometheus 9090:9090 &
kubectl port-forward -n observability svc/alertmanager 9093:9093 &
```

**Dashboard Access:**
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090  
- Alertmanager: http://localhost:9093

**Test Alert:**
```bash
# Simulate high error rate to test alerting
curl -X POST http://localhost:8080/api/test/error-rate
```

For detailed configuration, see [Observability Documentation](k8s/observability/README.md).

## 📊 Performance Testing & Load Testing

Modulo includes comprehensive performance testing using k6 to validate SLO compliance and detect regressions:

### 🎯 Key Features

- **SLO-Aligned Tests**: k6 thresholds directly map to service level objectives
- **Nightly Baselines**: Automated performance baseline creation and comparison
- **Regression Detection**: Fail builds on performance degradations >15%
- **SLO Validation**: Block deployments on SLO violations
- **Multi-Profile Testing**: Smoke, normal load, and stress testing

### 🚀 Quick Start

```bash
cd k6-tests
npm install

# Run performance tests locally
npm run test:crud        # CRUD API operations
npm run test:sync        # Blockchain sync operations  
npm run test:websocket   # WebSocket real-time features

# Run all tests
npm run test:all

# Baseline management
npm run baseline:save    # Save current results as baseline
npm run baseline:compare # Compare against baseline
```

### 📊 Test Profiles

| Profile | VUs | Duration | Use Case |
|---------|-----|----------|----------|
| **Smoke** | 1 | 30s | PR validation |
| **Normal** | 10 | 5m | Nightly baselines |
| **Stress** | 50 | 2m | Capacity planning |

### 🎯 SLO Compliance

| Test Type | SLO Metric | Threshold | k6 Threshold |
|-----------|------------|-----------|--------------|
| CRUD Operations | Read P95 Latency | < 200ms | `p(95)<200` |
| CRUD Operations | Write P95 Latency | < 500ms | `p(95)<500` |
| Sync Operations | Sync P95 Latency | < 1000ms | `p(95)<1000` |
| All Operations | Availability | > 99.9% | `rate<0.001` |

### 🔄 CI/CD Integration

**Nightly Performance Testing:**
- Schedule: 2 AM UTC daily
- Environment: Staging  
- Profile: Normal load (10 VUs, 5 minutes)
- Artifacts: Baselines, results, reports (30-90 day retention)

**PR Performance Validation:**
- Trigger: Backend/frontend changes
- Environment: Development (Docker)
- Profile: Smoke testing (1 VU, 30 seconds)
- Failure: SLO violations or >15% regressions

See [Performance Testing Guide](docs/PERFORMANCE_TESTING.md) for detailed information.

## 🔍 Synthetic Monitoring & Uptime

Modulo includes comprehensive synthetic monitoring to ensure service availability and validate user journeys:

### 🎯 Key Features

- **99.9% Uptime SLO**: Continuous monitoring with health probe validation
- **End-to-End Journey Testing**: Complete user flows (login → create note → sync → search)
- **Real-time Alerting**: Immediate notification on SLO violations
- **Multiple Environments**: Staging, production, and development monitoring
- **Automated Scheduling**: Business hours (5min) and off-hours (15min) monitoring

### 🚀 Quick Start

```bash
cd k6-tests

# Local uptime monitoring
npm run synthetic:uptime

# Local user journey testing
npm run synthetic:journey

# Production monitoring
npm run monitor:uptime -- --env TARGET_URL=https://api.modulo.app
npm run monitor:journey -- --env TARGET_URL=https://api.modulo.app --env FRONTEND_URL=https://modulo.app
```

### 🔄 Monitoring Types

| Type | Frequency | Duration | Focus |
|------|-----------|----------|-------|
| **Uptime Probe** | Every 5s | Continuous | Health endpoints, availability |
| **User Journey** | Every 5m | 30m sessions | End-to-end functionality |
| **Extended** | Post-deploy | 60m sessions | Comprehensive validation |

### 🎯 SLO Compliance

| Metric | SLO Target | Monitoring |
|--------|------------|------------|
| Application Uptime | > 99.9% | Health probes every 5 seconds |
| Journey Success Rate | > 99.9% | E2E tests every 5 minutes |
| Response Time P95 | < 2000ms | Continuous probe monitoring |
| Journey Duration P95 | < 10000ms | Full user flow validation |

### 🤖 Automated Monitoring

**GitHub Actions Schedule:**
- **Business Hours** (9 AM - 6 PM UTC, Mon-Fri): Every 5 minutes
- **Off Hours & Weekends**: Every 15 minutes  
- **Post-Deployment**: Immediate validation after staging/production deploys
- **Manual Triggers**: On-demand with environment selection

**Health Endpoints:**
- `/api/actuator/health/liveness` - Pod liveness (Kubernetes integration)
- `/api/actuator/health/readiness` - Service readiness (traffic routing)
- `/api/actuator/health` - Overall application health
- `/api/health/detailed` - Comprehensive health checks (database, memory, services)

### 🚨 Alerting & SLO Violations

**Automatic Alerts:**
- Uptime drops below 99.9%
- User journey success rate < 99.9%
- Response times exceed P95 thresholds
- Health endpoint failures

**Integration Ready:**
- GitHub Actions workflow failure notifications
- PagerDuty, Slack, or custom webhook integration
- Detailed monitoring artifacts and reports

See [Synthetic Monitoring Guide](k6-tests/synthetic/README.md) for detailed information.

## Authentication

Modulo supports multiple authentication methods:

1. **Google OAuth 2.0** - Social login
2. **Azure Active Directory** - Enterprise SSO
3. **MetaMask** - Web3 wallet authentication

Configure in `backend/src/main/resources/application.yml`:

```yaml
app:
  oauth:
    google:
      client-id: your-google-client-id
      client-secret: your-google-client-secret
    azure:
      client-id: your-azure-client-id
      client-secret: your-azure-client-secret
```

## API Documentation

- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **OpenAPI Spec**: http://localhost:8080/v3/api-docs

## Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow conventional commits**: See [commit guide](docs/CONVENTIONAL_COMMITS.md)
4. **Create Pull Request**

### Development Workflow

```bash
# 1. Create branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature

# 2. Make changes with conventional commits
git commit -m "feat(scope): add new feature"

# 3. Push and create PR
git push origin feature/your-feature
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 **Documentation**: [/docs](docs/)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Ikey168/Modulo/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Ikey168/Modulo/discussions)

---

Built with ❤️ using modern web technologies and best practices.
