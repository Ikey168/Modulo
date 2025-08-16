# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.0.0 (2025-08-16)


### Features

* Add advanced Azure deployment configuration ([8ea92ee](https://github.com/Ikey168/Modulo/commit/8ea92ee5a648ce63017ace4b073fbd8fa7e894b9))
* Add Azure container deployment with monitoring ([dac4576](https://github.com/Ikey168/Modulo/commit/dac45769440dc5945a0e231976fcb2086124a6e5))
* Add initial Kubernetes manifests for API and frontend ([1e068f1](https://github.com/Ikey168/Modulo/commit/1e068f108f42d50b21ce0eadd9322b30dc95acd6))
* add NoteRegistry smart contract and K8s auto-scaling ([16d54b8](https://github.com/Ikey168/Modulo/commit/16d54b808ae11198bf9098af12b46d3b876a1e64))
* **blockchain:** Add placeholder blockchain service for web3j integration ([1a2ed35](https://github.com/Ikey168/Modulo/commit/1a2ed35f93ba4684bb429c4dd1dafc4533b1566f))
* Complete Azure deployment with monitoring and IaC ([f232f86](https://github.com/Ikey168/Modulo/commit/f232f869f564c32449109b726beec02de205ad09))
* enhance TestNotesPage with improved styling and feature highlights ([6ea9d0d](https://github.com/Ikey168/Modulo/commit/6ea9d0d272317673033979c205bae474bfce05e3))
* Enhanced TestNotesPage with improved styling and description ([e0c1082](https://github.com/Ikey168/Modulo/commit/e0c10827a76344e1d0755a1d2e972ab28702a8fe))
* Implement Azure Blob Storage for note attachments (Issue [#48](https://github.com/Ikey168/Modulo/issues/48)) ([f5b8144](https://github.com/Ikey168/Modulo/commit/f5b81447cdee4a23667301967964c3fd22ee8595))
* Implement background sync on network reconnection ([c9fa04d](https://github.com/Ikey168/Modulo/commit/c9fa04d11f4fbcf8344626559381deb1b9a5b4a1))
* implement complete Kubernetes deployment solution ([95a94ac](https://github.com/Ikey168/Modulo/commit/95a94ac334276d34ac0330b7ed80f1cf7e18a408)), closes [#46](https://github.com/Ikey168/Modulo/issues/46)
* implement complete note tagging system ([306b1fe](https://github.com/Ikey168/Modulo/commit/306b1feb15fa3a52e036704b6f5b1f3ebbcd9c85))
* implement comprehensive blockchain note registry smart contract ([f49d8fb](https://github.com/Ikey168/Modulo/commit/f49d8fb53d0d11de6bcf85f3f1bd07d4f1474677))
* Implement comprehensive dark mode and custom themes system ([5a08321](https://github.com/Ikey168/Modulo/commit/5a083213b9cff133a2a766bb85e23733bf778fb9))
* implement comprehensive graph visualization with Sigma.js ([#16](https://github.com/Ikey168/Modulo/issues/16)) ([d8ef62c](https://github.com/Ikey168/Modulo/commit/d8ef62cad7dc272599810d17458cd13f7dda9a3c))
* Implement comprehensive mobile responsiveness for Android & iOS ([5034224](https://github.com/Ikey168/Modulo/commit/5034224ceed3084430a66d7a4f5c717839fea01a))
* Implement comprehensive plugin submission system for Issue [#31](https://github.com/Ikey168/Modulo/issues/31) ([0838050](https://github.com/Ikey168/Modulo/commit/0838050848f2dda1d11d0dbeb3765711cd51b713))
* Implement comprehensive plugin system architecture ([a5048ca](https://github.com/Ikey168/Modulo/commit/a5048ca5c7d1c235fce193fa7e9fea784eb2161d))
* Implement ERC-20 token monetization system for Issue [#33](https://github.com/Ikey168/Modulo/issues/33) ([82dff1c](https://github.com/Ikey168/Modulo/commit/82dff1cb87c1e2303a8a70b5efeeaffb1b3b3da1))
* implement note integrity verification feature ([9d252af](https://github.com/Ikey168/Modulo/commit/9d252affcb90e3c51e86141f3008f1b729e6aec3)), closes [#38](https://github.com/Ikey168/Modulo/issues/38)
* Implement Plugin Marketplace UI (Issue [#30](https://github.com/Ikey168/Modulo/issues/30)) ([7386b92](https://github.com/Ikey168/Modulo/commit/7386b920e4acfb680edb2268444c663be49a6932))
* implement Polygon Mumbai testnet deployment infrastructure ([c509719](https://github.com/Ikey168/Modulo/commit/c509719a01517214f29eacfc32f9f01761972bcf))
* Implement robust OAuth2 authentication flow ([4493998](https://github.com/Ikey168/Modulo/commit/44939983cd5ea1b695da16821077103ebfa61af5))
* Implement Spring Boot blockchain integration with web3j ([64b584f](https://github.com/Ikey168/Modulo/commit/64b584fcf58d4bd980fdbc879cecf97794127e4b))
* Implement third-party plugin hosting support (Issue [#26](https://github.com/Ikey168/Modulo/issues/26)) ([96d948a](https://github.com/Ikey168/Modulo/commit/96d948a45b17bb84118b0a346d34b7451ebe3a9d))
* implement WebSocket-based real-time sync ([#17](https://github.com/Ikey168/Modulo/issues/17)) ([a85bbe2](https://github.com/Ikey168/Modulo/commit/a85bbe25b4c6c8dd1cbe2b2e84865632a1278b3b))
* **java:** Upgrade to Java 17 and Spring Boot 3.2.11 with web3j support ([f7aed3a](https://github.com/Ikey168/Modulo/commit/f7aed3a99336a8f27f355b444dc3a3314c91651c))
* **release:** implement automated versioning and GitHub releases ([882e70e](https://github.com/Ikey168/Modulo/commit/882e70e1d34beebf6c2b51e255a5cf719cfca192)), closes [#96](https://github.com/Ikey168/Modulo/issues/96)
* rich text notes with images, links, tables, drag-and-drop (TipTap) ([4862776](https://github.com/Ikey168/Modulo/commit/48627766a238b4914450d71b91d30788ab9e3b0c))


### Bug Fixes

* Apply async testing pattern to BlockchainController tests ([391de1c](https://github.com/Ikey168/Modulo/commit/391de1caba48fef9dee300262b8f1ba29ae61cc1))
* **config:** Add BlockchainConfig for web3j client configuration ([4dc72cf](https://github.com/Ikey168/Modulo/commit/4dc72cf4a572329cf158e0b3e309b8a14be5b69a))
* Configure CI for Java 11 and prevent test hanging ([6b55da6](https://github.com/Ikey168/Modulo/commit/6b55da61ad6b34ca911c709b099c5c099d6d6b43))
* Correct gRPC method calls in SimplePluginServiceImpl ([4bd7b09](https://github.com/Ikey168/Modulo/commit/4bd7b09caa1c2e749014b06085726ad6267b510d))
* Fix Lombok annotation processing issues ([c209e2f](https://github.com/Ikey168/Modulo/commit/c209e2f41b966862424e5fd23d8838fd33a4d03f))
* Remove duplicate BlockchainServiceNew.java file causing compilation errors ([1771a37](https://github.com/Ikey168/Modulo/commit/1771a37d6ab3d81cb9df4e09ec33aa30d8dee427))
* Remove duplicate gRPC service implementation ([4164a53](https://github.com/Ikey168/Modulo/commit/4164a53eabd942d36e31d8aa932792b1e3474f93))
* Remove SQLite Hibernate dialect dependency causing compatibility issues ([08a40c9](https://github.com/Ikey168/Modulo/commit/08a40c972b3f08f7307d785a8e64683bcf21dd11))
* remove TestNotesPage.tsx to resolve merge conflict ([85dcd7f](https://github.com/Ikey168/Modulo/commit/85dcd7fe802fc842ad1ee5e3601319b6c79c467f))
* Replace @Slf4j with explicit Logger declarations ([c522ce6](https://github.com/Ikey168/Modulo/commit/c522ce650e0c99a666027a5bbcb3451fa94d4542))
* Resolve backend test failures by correcting JPA context setup ([338ab37](https://github.com/Ikey168/Modulo/commit/338ab37f9e5c7220e28596fb8040e48e1d31abbe))
* Resolve compilation errors in network sync implementation ([8a5b762](https://github.com/Ikey168/Modulo/commit/8a5b76254dda19e93041c7b7705f978df2c6a073))
* Resolve compilation errors in network sync implementation ([2af7257](https://github.com/Ikey168/Modulo/commit/2af7257d8b7417df0df4801436ba22da1ff68c9c))
* Resolve Lombok compilation errors in CI ([5e0fb76](https://github.com/Ikey168/Modulo/commit/5e0fb768d0d37a15335e25934f9bbda1e87f1556))
* Resolve test failures by making NetworkDetectionService conditional ([787e78c](https://github.com/Ikey168/Modulo/commit/787e78cc473fe2088852bd0c56c68b830686bb5b))
* Restructure root POM to be a proper aggregator ([7b92490](https://github.com/Ikey168/Modulo/commit/7b924901a4bd8343e59c40ac462917237c574c47))
* Specify mainClass for spring-boot-maven-plugin in backend ([1103397](https://github.com/Ikey168/Modulo/commit/1103397177532d753a44bdc8c8af6d1ed799096c))
* **test:** Resolve ApplicationContext loading issues and add debug logging ([9bb1a32](https://github.com/Ikey168/Modulo/commit/9bb1a329f978b6d549d5684cb06377a027425a51))
* **tests:** Update test files to match current BlockchainService implementation ([e5eb5d4](https://github.com/Ikey168/Modulo/commit/e5eb5d45f235d39b71c80cb0bca3181cfb0196a3))
* Update Spring Boot to 3.2.3 and Java to 17 for Jakarta EE support ([fc0d938](https://github.com/Ikey168/Modulo/commit/fc0d9383264a8e7e4896fa6fe1043bc4e180bf19))

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
