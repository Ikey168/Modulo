# IPFS Integration for Modulo

This document describes the IPFS (InterPlanetary File System) integration implemented for Modulo, providing decentralized storage capabilities for notes.

## Overview

The IPFS integration allows notes to be stored on a decentralized network, providing:
- **Immutable Content**: Notes stored on IPFS cannot be tampered with
- **Content Addressing**: Each note gets a unique Content Identifier (CID)
- **Decentralized Access**: Notes can be retrieved from any IPFS node
- **Backup & Redundancy**: Content is distributed across multiple nodes

## Architecture

### Components

1. **IpfsService**: Core service for IPFS operations
2. **IpfsController**: REST API endpoints for IPFS functionality
3. **Database Migration V4**: Adds IPFS fields to notes table
4. **Note Entity Updates**: Enhanced with IPFS metadata

### Database Schema

The V4 migration adds the following fields to the `notes` table:

```sql
ipfs_cid               VARCHAR(255)     -- IPFS Content Identifier
content_hash           VARCHAR(255)     -- SHA-256 hash for integrity
ipfs_uploaded_at       TIMESTAMP        -- Upload timestamp
is_decentralized       BOOLEAN          -- Decentralization flag
```

## Configuration

### Application Properties

```yaml
modulo:
  integrations:
    ipfs:
      node-url: http://localhost:5001      # IPFS node API endpoint
      gateway-url: http://localhost:8080   # IPFS gateway for retrieval
      enabled: true                        # Enable/disable IPFS
      timeout-ms: 30000                   # Operation timeout
      max-file-size-mb: 50                # Maximum file size
```

### Environment Variables (Docker)

```bash
IPFS_NODE_URL=http://ipfs:5001
IPFS_GATEWAY_URL=http://ipfs:8080
IPFS_ENABLED=true
```

## API Endpoints

### Core IPFS Operations

#### Upload Note to IPFS
```http
POST /api/ipfs/notes/{noteId}/upload
```

**Response:**
```json
{
  "success": true,
  "noteId": 123,
  "ipfsCid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  "gatewayUrl": "http://localhost:8080/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
}
```

#### Retrieve Content from IPFS
```http
GET /api/ipfs/content/{cid}
```

**Response:**
```json
{
  "success": true,
  "cid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  "content": "Note content retrieved from IPFS..."
}
```

#### Verify Note Integrity
```http
POST /api/ipfs/notes/{noteId}/verify
```

**Response:**
```json
{
  "success": true,
  "noteId": 123,
  "ipfsCid": "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  "isValid": true,
  "contentHash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
}
```

#### Get IPFS Status
```http
GET /api/ipfs/status
```

**Response:**
```json
{
  "enabled": true,
  "status": "connected",
  "version": "0.20.0",
  "nodeUrl": "http://localhost:5001",
  "gatewayUrl": "http://localhost:8080"
}
```

#### List Decentralized Notes
```http
GET /api/ipfs/notes?page=0&size=20
```

### Note Controller Integration

#### Upload Existing Note to IPFS
```http
POST /api/notes/{id}/upload-to-ipfs
```

## Implementation Details

### Content Storage Format

When a note is uploaded to IPFS, it's stored as a JSON object:

```json
{
  "id": 123,
  "title": "My Note",
  "content": "Note content...",
  "markdownContent": "# My Note\nNote content...",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "metadata": {
    "version": "1.0",
    "format": "modulo-note"
  }
}
```

### Hash Verification

Content integrity is verified using SHA-256 hashing:

1. Calculate SHA-256 of note content
2. Store hash in `content_hash` field
3. Verify by recalculating hash from IPFS content

### Error Handling

The IPFS service includes comprehensive error handling:

- **Connection failures**: Graceful degradation when IPFS node is unavailable
- **Timeout handling**: Configurable timeouts for all operations
- **CID validation**: Validates Content Identifiers before operations
- **Content verification**: Ensures retrieved content matches stored hash

## Deployment

### Docker Compose Setup

```yaml
services:
  ipfs:
    image: ipfs/go-ipfs:latest
    ports:
      - "4001:4001"
      - "5001:5001"
      - "8080:8080"
    volumes:
      - ipfs_data:/data/ipfs
    environment:
      - IPFS_PROFILE=server

  modulo-backend:
    environment:
      - IPFS_NODE_URL=http://ipfs:5001
      - IPFS_GATEWAY_URL=http://ipfs:8080
      - IPFS_ENABLED=true
    depends_on:
      - ipfs
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ipfs-node
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ipfs-node
  template:
    metadata:
      labels:
        app: ipfs-node
    spec:
      containers:
      - name: ipfs
        image: ipfs/go-ipfs:latest
        ports:
        - containerPort: 4001
        - containerPort: 5001
        - containerPort: 8080
        env:
        - name: IPFS_PROFILE
          value: "server"
```

## Security Considerations

1. **Access Control**: IPFS node should be secured and not publicly accessible
2. **Content Encryption**: Sensitive notes should be encrypted before IPFS upload
3. **Network Isolation**: IPFS traffic should be isolated in production
4. **Backup Strategy**: Critical IPFS data should be backed up regularly

## Monitoring and Observability

### Health Checks

The IPFS service includes health monitoring:

```java
@Component
public class IpfsHealthIndicator implements HealthIndicator {
    // Health check implementation
}
```

### Metrics

Key metrics to monitor:

- IPFS upload success rate
- Average upload time
- Node connectivity status
- Storage utilization

## Development

### Local Setup

1. Install IPFS:
```bash
# Using Homebrew (macOS)
brew install ipfs

# Using package manager (Linux)
wget https://github.com/ipfs/go-ipfs/releases/download/v0.20.0/go-ipfs_v0.20.0_linux-amd64.tar.gz
tar -xvzf go-ipfs_v0.20.0_linux-amd64.tar.gz
sudo mv go-ipfs/ipfs /usr/local/bin/
```

2. Initialize and start IPFS:
```bash
ipfs init
ipfs daemon
```

3. Configure application:
```yaml
modulo:
  integrations:
    ipfs:
      node-url: http://localhost:5001
      gateway-url: http://localhost:8080
      enabled: true
```

### Testing

#### Unit Tests

```java
@Test
public void testUploadNoteToIpfs() {
    // Test implementation
}

@Test
public void testVerifyNoteIntegrity() {
    // Test implementation
}
```

#### Integration Tests

```java
@SpringBootTest
@TestPropertySource(properties = {
    "modulo.integrations.ipfs.enabled=true",
    "modulo.integrations.ipfs.node-url=http://localhost:5001"
})
public class IpfsIntegrationTest {
    // Integration test implementation
}
```

## Future Enhancements

1. **Content Encryption**: Encrypt sensitive notes before IPFS storage
2. **IPFS Cluster**: Support for IPFS cluster deployments
3. **Content Migration**: Tools for migrating existing notes to IPFS
4. **Selective Decentralization**: User choice for which notes to decentralize
5. **IPNS Support**: Mutable references for dynamic content
6. **Content Deduplication**: Optimize storage for similar content

## Troubleshooting

### Common Issues

#### IPFS Node Connection Failed
```
Error: Failed to connect to IPFS node
Solution: Ensure IPFS daemon is running on correct port
```

#### CID Validation Failed
```
Error: Invalid CID format
Solution: Check CID format and ensure it's a valid IPFS hash
```

#### Upload Timeout
```
Error: Upload operation timed out
Solution: Increase timeout value or check network connectivity
```

### Debug Mode

Enable debug logging:

```yaml
logging:
  level:
    com.modulo.service.IpfsService: DEBUG
```

## References

- [IPFS Documentation](https://docs.ipfs.io/)
- [Java IPFS HTTP Client](https://github.com/ipfs/java-ipfs-http-client)
- [Content Addressing](https://docs.ipfs.io/concepts/content-addressing/)
- [IPFS Best Practices](https://docs.ipfs.io/how-to/best-practices-for-nft-data/)
