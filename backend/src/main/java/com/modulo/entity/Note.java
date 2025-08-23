package com.modulo.entity;

// import org.springframework.data.neo4j.core.schema.GeneratedValue; // Neo4j
// import org.springframework.data.neo4j.core.schema.Id; // Neo4j
// import org.springframework.data.neo4j.core.schema.Node; // Neo4j
// import org.springframework.data.neo4j.core.schema.Relationship; // Neo4j

import javax.persistence.*; // JPA
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.Map;
import java.util.HashMap;

// @Node // Neo4j
@Entity // JPA
@Table(name = "notes", schema = "application")
public class Note {

    @Id // JPA
    @GeneratedValue(strategy = GenerationType.AUTO) // JPA
    // @org.springframework.data.neo4j.core.schema.Id // Neo4j - specific import to avoid clash
    // @org.springframework.data.neo4j.core.schema.GeneratedValue // Neo4j - specific import
    @Column(name = "note_id")
    private Long id;

    @Column(name = "title")
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "markdown_content", columnDefinition = "TEXT")
    private String markdownContent;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version")
    private Long version;

    @Column(name = "last_editor")
    private String lastEditor;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "is_public")
    private Boolean isPublic = false;

    @Column(name = "last_viewed_at")
    private LocalDateTime lastViewedAt;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "note_metadata", schema = "application", joinColumns = @JoinColumn(name = "note_id"))
    @MapKeyColumn(name = "metadata_key")
    @Column(name = "metadata_value", columnDefinition = "TEXT")
    private Map<String, String> metadata = new HashMap<>();

    // IPFS and Blockchain Integration fields
    @Column(name = "ipfs_cid")
    private String ipfsCid;

    @Column(name = "content_hash")
    private String contentHash;

    @Column(name = "is_decentralized")
    private Boolean isDecentralized = false;

    @Column(name = "blockchain_tx_hash")
    private String blockchainTxHash;

    @Column(name = "blockchain_note_id")
    private Long blockchainNoteId;

    @Column(name = "is_on_blockchain")
    private Boolean isOnBlockchain = false;

    @Column(name = "ipfs_uploaded_at")
    private LocalDateTime ipfsUploadedAt;

    @Column(name = "blockchain_registered_at")
    private LocalDateTime blockchainRegisteredAt;

    // Access Control fields for blockchain integration
    @Column(name = "access_control_enabled")
    private Boolean accessControlEnabled = false;

    @Column(name = "owner_address")
    private String ownerAddress;

    @Column(name = "access_control_tx_hash")
    private String accessControlTxHash;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "note_tags",
        schema = "application",
        joinColumns = @JoinColumn(name = "note_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();

        // @Relationship(type = "LINKED_TO", direction = Relationship.Direction.OUTGOING) // Neo4j
    @OneToMany(mappedBy = "sourceNote", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<NoteLink> outgoingLinks = new HashSet<>();

    // @Relationship(type = "LINKED_TO", direction = Relationship.Direction.INCOMING) // Neo4j
    @OneToMany(mappedBy = "targetNote", fetch = FetchType.LAZY)
    private Set<NoteLink> incomingLinks = new HashSet<>();

    // Attachments relationship
    @OneToMany(mappedBy = "note", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Attachment> attachments = new HashSet<>();

    // @Relationship(type = "LINKS_TO", direction = Relationship.Direction.OUTGOING) // Neo4j
    // private Set<NoteLink> links; // Neo4j specific, and NoteLink is commented out

    public Note() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        // this.links = new HashSet<>(); // Neo4j specific
    }

    public Note(String title, String content) {
        this.title = title;
        this.content = content;
        this.markdownContent = content; // Default to content for backward compatibility
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        // this.links = new HashSet<>(); // Neo4j specific
    }

    public Note(String title, String content, String markdownContent) {
        this.title = title;
        this.content = content;
        this.markdownContent = markdownContent;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        // this.links = new HashSet<>(); // Neo4j specific
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMarkdownContent() {
        return markdownContent;
    }

    public void setMarkdownContent(String markdownContent) {
        this.markdownContent = markdownContent;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public String getLastEditor() {
        return lastEditor;
    }

    public void setLastEditor(String lastEditor) {
        this.lastEditor = lastEditor;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Boolean getIsPublic() {
        return isPublic;
    }

    public void setIsPublic(Boolean isPublic) {
        this.isPublic = isPublic;
    }

    public LocalDateTime getLastViewedAt() {
        return lastViewedAt;
    }

    public void setLastViewedAt(LocalDateTime lastViewedAt) {
        this.lastViewedAt = lastViewedAt;
    }

    public Map<String, String> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, String> metadata) {
        this.metadata = metadata;
    }

    // IPFS and Blockchain getters and setters
    public String getIpfsCid() {
        return ipfsCid;
    }

    public void setIpfsCid(String ipfsCid) {
        this.ipfsCid = ipfsCid;
    }

    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
    }

    public String getBlockchainTxHash() {
        return blockchainTxHash;
    }

    public void setBlockchainTxHash(String blockchainTxHash) {
        this.blockchainTxHash = blockchainTxHash;
    }

    public Long getBlockchainNoteId() {
        return blockchainNoteId;
    }

    public void setBlockchainNoteId(Long blockchainNoteId) {
        this.blockchainNoteId = blockchainNoteId;
    }

    public Boolean getIsOnBlockchain() {
        return isOnBlockchain;
    }

    public void setIsOnBlockchain(Boolean isOnBlockchain) {
        this.isOnBlockchain = isOnBlockchain;
    }

    public Boolean getIsDecentralized() {
        return isDecentralized;
    }

    public void setIsDecentralized(Boolean isDecentralized) {
        this.isDecentralized = isDecentralized;
    }

    public LocalDateTime getIpfsUploadedAt() {
        return ipfsUploadedAt;
    }

    public void setIpfsUploadedAt(LocalDateTime ipfsUploadedAt) {
        this.ipfsUploadedAt = ipfsUploadedAt;
    }

    public LocalDateTime getBlockchainRegisteredAt() {
        return blockchainRegisteredAt;
    }

    public void setBlockchainRegisteredAt(LocalDateTime blockchainRegisteredAt) {
        this.blockchainRegisteredAt = blockchainRegisteredAt;
    }

    // Access Control getters and setters
    public Boolean getAccessControlEnabled() {
        return accessControlEnabled;
    }

    public void setAccessControlEnabled(Boolean accessControlEnabled) {
        this.accessControlEnabled = accessControlEnabled;
    }

    public String getOwnerAddress() {
        return ownerAddress;
    }

    public void setOwnerAddress(String ownerAddress) {
        this.ownerAddress = ownerAddress;
    }

    public String getAccessControlTxHash() {
        return accessControlTxHash;
    }

    public void setAccessControlTxHash(String accessControlTxHash) {
        this.accessControlTxHash = accessControlTxHash;
    }

    public Set<Tag> getTags() {
        return tags;
    }

    public void setTags(Set<Tag> tags) {
        this.tags = tags;
    }

    public void addTag(Tag tag) {
        this.tags.add(tag);
        tag.getNotes().add(this);
    }

    public void removeTag(Tag tag) {
        this.tags.remove(tag);
        tag.getNotes().remove(this);
    }

    public Set<NoteLink> getOutgoingLinks() {
        return outgoingLinks;
    }

    public void setOutgoingLinks(Set<NoteLink> outgoingLinks) {
        this.outgoingLinks = outgoingLinks;
    }

    public Set<NoteLink> getIncomingLinks() {
        return incomingLinks;
    }

    public void setIncomingLinks(Set<NoteLink> incomingLinks) {
        this.incomingLinks = incomingLinks;
    }

    public void addOutgoingLink(NoteLink link) {
        this.outgoingLinks.add(link);
        link.setSourceNote(this);
    }

    public void removeOutgoingLink(NoteLink link) {
        this.outgoingLinks.remove(link);
        link.setSourceNote(null);
    }

    public void addIncomingLink(NoteLink link) {
        this.incomingLinks.add(link);
        link.setTargetNote(this);
    }

    public void removeIncomingLink(NoteLink link) {
        this.incomingLinks.remove(link);
        link.setTargetNote(null);
    }

    public Set<Attachment> getAttachments() {
        return attachments;
    }

    public void setAttachments(Set<Attachment> attachments) {
        this.attachments = attachments;
    }

    public void addAttachment(Attachment attachment) {
        this.attachments.add(attachment);
        attachment.setNote(this);
    }

    public void removeAttachment(Attachment attachment) {
        this.attachments.remove(attachment);
        attachment.setNote(null);
    }

    /* // Neo4j specific
    public Set<NoteLink> getLinks() {
        return links;
    }

    public void setLinks(Set<NoteLink> links) {
        this.links = links;
    }

    public void addLink(NoteLink link) {
        if (this.links == null) {
            this.links = new HashSet<>();
        }
        this.links.add(link);
    }
    */
}