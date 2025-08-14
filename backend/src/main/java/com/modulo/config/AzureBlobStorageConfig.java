package com.modulo.config;

import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.identity.DefaultAzureCredentialBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AzureBlobStorageConfig {

    @Value("${azure.storage.account-name:modulostorage}")
    private String accountName;

    @Value("${azure.storage.connection-string:#{null}}")
    private String connectionString;

    @Value("${azure.storage.account-key:#{null}}")
    private String accountKey;

    @Value("${azure.storage.use-managed-identity:true}")
    private boolean useManagedIdentity;

    @Bean
    public BlobServiceClient blobServiceClient() {
        BlobServiceClientBuilder builder = new BlobServiceClientBuilder();

        if (connectionString != null && !connectionString.isEmpty()) {
            // Use connection string if provided
            return builder.connectionString(connectionString).buildClient();
        } else if (useManagedIdentity) {
            // Use managed identity for Azure environments
            String endpoint = String.format("https://%s.blob.core.windows.net", accountName);
            return builder
                    .endpoint(endpoint)
                    .credential(new DefaultAzureCredentialBuilder().build())
                    .buildClient();
        } else if (accountKey != null && !accountKey.isEmpty()) {
            // Use account key if provided
            String endpoint = String.format("https://%s.blob.core.windows.net", accountName);
            return builder
                    .endpoint(endpoint)
                    .credential(new com.azure.storage.common.StorageSharedKeyCredential(accountName, accountKey))
                    .buildClient();
        } else {
            throw new IllegalStateException("Azure Blob Storage configuration is incomplete. " +
                    "Please provide either connection-string, account-key, or enable managed-identity.");
        }
    }
}
