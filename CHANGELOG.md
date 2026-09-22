# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## Unreleased

### Changed

* **blueprints:** `action.code.execute` now uses QuickJS-on-WASM exclusively. The Rhino engine and dependency are removed; `wasm` is the default for server, dev, Kubernetes, and Pi deployments. See `docs/blueprint/wasm-sandbox-drift.md` for the JavaScript semantics differences and hard memory-cap behavior.
* **knowledge:** add provider-neutral, owner-scoped semantic indexing, hybrid search, reviewable suggested links, and cited local Ask Modulo answers.
* **plugins:** add digest-pinned marketplace trust evidence, publisher verification history, permission-diff upgrade consent, rollback history, and install-time verification.
* **packs:** add the guided Security Audit first-run journey with resumable onboarding, privacy-safe demo records, explicit demo removal, and reproducible Playwright acceptance coverage.

## 1.0.0 (2025-08-16)

### Features

* **authentication:** Add MetaMask authentication support ([#95](https://github.com/Ikey168/Modulo/pull/95))
* **blockchain:** Implement blockchain integration for note management
* **frontend:** React-based UI with TypeScript support
* **backend:** Spring Boot REST API with PostgreSQL
* **database:** Multi-database support (PostgreSQL + SQLite offline)
* **websocket:** Real-time note synchronization
* **search:** Full-text search capabilities
* **docker:** Containerized deployment with Docker Compose

### Documentation

* Add comprehensive README with setup instructions
* Add Docker deployment documentation
* Add Kubernetes deployment manifests

### Build System

* **ci/cd:** GitHub Actions workflows for testing and deployment
* **docker:** Multi-arch Docker images (amd64/arm64)
* **maven:** Maven build configuration for backend
* **vite:** Modern build tooling for frontend
