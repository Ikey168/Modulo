# Azure Blob Storage for Attachments

This implementation provides scalable file storage for note attachments using Azure Blob Storage with CDN support for faster access.

## Features

### 🗄️ Storage Features
- **Azure Blob Storage** integration for scalable file storage
- **CDN Support** for faster global file access via Azure CDN
- **Multiple Authentication** methods (Managed Identity, Connection String, Account Key)
- **File Type Validation** with configurable allowed content types
- **File Size Limits** with configurable maximum file size
- **Soft Delete** support for attachment management

### 🔐 Security Features
- **Access Control** with authentication required for uploads
- **File Type Restrictions** to prevent malicious uploads
- **Size Limits** to prevent abuse
- **Unique Blob Names** to prevent conflicts and enhance security

### 📊 Management Features
- **Database Integration** with PostgreSQL for metadata storage
- **Attachment Metadata** tracking (filename, size, content type, upload time)
- **User Association** with notes and uploaders
- **Audit Trail** with upload/delete tracking

## API Endpoints

### Upload Attachment
```http
POST /api/attachments/upload
Content-Type: multipart/form-data

Parameters:
- file: MultipartFile (required)
- noteId: Long (required)
```

### Get Attachments by Note
```http
GET /api/attachments/note/{noteId}
```

### Get Attachment Details
```http
GET /api/attachments/{attachmentId}
```

### Get Download URL
```http
GET /api/attachments/{attachmentId}/download-url
```

### Delete Attachment (Soft)
```http
DELETE /api/attachments/{attachmentId}
```

### Delete Attachment (Hard)
```http
DELETE /api/attachments/{attachmentId}/hard
```

## Configuration

### Environment Variables

#### Required
- `AZURE_STORAGE_ACCOUNT_NAME`: Azure Storage account name

#### Authentication (Choose one)
- `AZURE_STORAGE_CONNECTION_STRING`: Full connection string
- `AZURE_STORAGE_ACCOUNT_KEY`: Account key (requires account name)
- `AZURE_STORAGE_USE_MANAGED_IDENTITY`: Use managed identity (default: true)

#### Optional
- `AZURE_STORAGE_CONTAINER_NAME`: Container name (default: attachments)
- `AZURE_CDN_ENDPOINT`: CDN endpoint URL for faster access
- `AZURE_STORAGE_MAX_FILE_SIZE`: Maximum file size in bytes (default: 10MB)
- `AZURE_STORAGE_ALLOWED_CONTENT_TYPES`: Comma-separated list of allowed MIME types

### Example Configuration

#### Development (Connection String)
```properties
azure.storage.account-name=modulostorage
azure.storage.connection-string=DefaultEndpointsProtocol=https;AccountName=modulostorage;AccountKey=...;EndpointSuffix=core.windows.net
azure.storage.container-name=attachments
azure.storage.max-file-size=10485760
```

#### Production (Managed Identity)
```properties
azure.storage.account-name=modulostorage
azure.storage.use-managed-identity=true
azure.storage.container-name=attachments
azure.cdn-endpoint=https://modulo.azureedge.net
azure.storage.max-file-size=52428800
```

## Kubernetes Deployment

### 1. Create Azure Storage Resources
```bash
# Create storage account
az storage account create \
  --name modulostorage \
  --resource-group modulo-rg \
  --location eastus \
  --sku Standard_LRS

# Create container
az storage container create \
  --name attachments \
  --account-name modulostorage \
  --public-access blob
```

### 2. Configure Managed Identity (Recommended)
```bash
# Create managed identity
az identity create \
  --name modulo-storage-identity \
  --resource-group modulo-rg

# Assign Storage Blob Data Contributor role
az role assignment create \
  --assignee <identity-principal-id> \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<subscription-id>/resourceGroups/modulo-rg/providers/Microsoft.Storage/storageAccounts/modulostorage
```

### 3. Deploy Kubernetes Configuration
```bash
# Apply storage configuration
kubectl apply -f k8s/12-azure-storage-config.yaml

# Update API deployment with storage config
kubectl apply -f k8s/api-deployment.yaml
```

## CDN Setup (Optional)

### 1. Create Azure CDN Profile
```bash
az cdn profile create \
  --name modulo-cdn \
  --resource-group modulo-rg \
  --sku Standard_Microsoft
```

### 2. Create CDN Endpoint
```bash
az cdn endpoint create \
  --name modulo-attachments \
  --profile-name modulo-cdn \
  --resource-group modulo-rg \
  --origin modulostorage.blob.core.windows.net \
  --origin-host-header modulostorage.blob.core.windows.net
```

### 3. Update Configuration
```yaml
# In azure-storage-config ConfigMap
cdn-endpoint: "https://modulo-attachments.azureedge.net"
```

## Database Schema

### Attachments Table
```sql
CREATE TABLE application.attachments (
    attachment_id BIGSERIAL PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    blob_name VARCHAR(255) NOT NULL UNIQUE,
    content_type VARCHAR(100),
    file_size BIGINT,
    container_name VARCHAR(100) NOT NULL,
    blob_url TEXT NOT NULL,
    cdn_url TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(255),
    note_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_attachment_note FOREIGN KEY (note_id) REFERENCES application.notes(note_id)
);
```

## Usage Examples

### Frontend JavaScript
```javascript
// Upload attachment
const formData = new FormData();
formData.append('file', file);
formData.append('noteId', noteId);

const response = await fetch('/api/attachments/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
if (result.success) {
  console.log('File uploaded:', result.cdnUrl || result.blobUrl);
}

// Get attachments for a note
const attachments = await fetch(`/api/attachments/note/${noteId}`)
  .then(res => res.json());

// Get download URL
const downloadUrl = await fetch(`/api/attachments/${attachmentId}/download-url`)
  .then(res => res.text());
```

### cURL Examples
```bash
# Upload file
curl -X POST \
  -F "file=@document.pdf" \
  -F "noteId=123" \
  -H "Authorization: Bearer <token>" \
  http://localhost:8081/api/attachments/upload

# Get attachments
curl -H "Authorization: Bearer <token>" \
  http://localhost:8081/api/attachments/note/123

# Get download URL
curl -H "Authorization: Bearer <token>" \
  http://localhost:8081/api/attachments/456/download-url
```

## Monitoring and Troubleshooting

### Health Checks
- Container initialization is verified on application startup
- Failed uploads return detailed error messages
- Database constraints prevent orphaned attachments

### Logging
- Upload/download operations are logged with user and file details
- Failed operations include stack traces for debugging
- Storage operations include timing information

### Common Issues
1. **Authentication Failed**: Check managed identity configuration or connection string
2. **Container Not Found**: Ensure container exists and access permissions are correct
3. **File Too Large**: Check `max-file-size` configuration
4. **Invalid File Type**: Verify `allowed-content-types` configuration

## Performance Considerations

### CDN Benefits
- **Global Distribution**: Files served from edge locations
- **Reduced Latency**: Faster access for users worldwide
- **Bandwidth Savings**: Reduced load on origin storage

### Storage Optimization
- **Unique Blob Names**: Prevents conflicts and enables caching
- **Content-Type Headers**: Proper browser handling of files
- **Compression**: Automatic compression for supported file types

### Database Optimization
- **Indexes**: Optimized queries for note attachments
- **Soft Delete**: Fast deletion without storage operations
- **Metadata Only**: Large files stored in blob storage, not database

## Security Best Practices

1. **Use Managed Identity** in production environments
2. **Restrict File Types** to prevent malicious uploads
3. **Set File Size Limits** to prevent abuse
4. **Enable Soft Delete** on storage account for data recovery
5. **Use HTTPS** for all storage and CDN endpoints
6. **Regular Access Reviews** of storage permissions
