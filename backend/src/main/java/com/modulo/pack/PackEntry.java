package com.modulo.pack;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A pack as returned by the REST API: the persisted registry record plus its manifest.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PackEntry {

    private Long id;
    private String packId;
    private String version;
    private String name;
    private String description;
    private String status;
    private PackManifest manifest;
    private String installedAt;
    private String updatedAt;
    private String ipfsCid;
    private String contentHash;
    private String source;
    private String gatewayUrl;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPackId() { return packId; }
    public void setPackId(String packId) { this.packId = packId; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public PackManifest getManifest() { return manifest; }
    public void setManifest(PackManifest manifest) { this.manifest = manifest; }

    public String getInstalledAt() { return installedAt; }
    public void setInstalledAt(String installedAt) { this.installedAt = installedAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public String getIpfsCid() { return ipfsCid; }
    public void setIpfsCid(String ipfsCid) { this.ipfsCid = ipfsCid; }

    public String getContentHash() { return contentHash; }
    public void setContentHash(String contentHash) { this.contentHash = contentHash; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getGatewayUrl() { return gatewayUrl; }
    public void setGatewayUrl(String gatewayUrl) { this.gatewayUrl = gatewayUrl; }
}
