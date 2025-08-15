package com.modulo.plugin.submission;

/**
 * Status of a plugin submission in the review process
 */
public enum SubmissionStatus {
    PENDING_REVIEW("Pending Review", "Submission is waiting for initial review"),
    UNDER_REVIEW("Under Review", "Submission is currently being reviewed"),
    VALIDATION_FAILED("Validation Failed", "Submission failed security or compatibility checks"),
    CHANGES_REQUESTED("Changes Requested", "Reviewer has requested changes to the submission"),
    APPROVED("Approved", "Submission has been approved and is ready for publication"),
    PUBLISHED("Published", "Plugin has been published to the marketplace"),
    REJECTED("Rejected", "Submission has been permanently rejected"),
    WITHDRAWN("Withdrawn", "Submission was withdrawn by the developer");
    
    private final String displayName;
    private final String description;
    
    SubmissionStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public String getDescription() {
        return description;
    }
    
    /**
     * Check if the status represents a final state
     */
    public boolean isFinalStatus() {
        return this == PUBLISHED || this == REJECTED || this == WITHDRAWN;
    }
    
    /**
     * Check if the status allows for resubmission
     */
    public boolean allowsResubmission() {
        return this == VALIDATION_FAILED || this == CHANGES_REQUESTED;
    }
    
    /**
     * Check if the status is a pending state
     */
    public boolean isPending() {
        return this == PENDING_REVIEW || this == UNDER_REVIEW;
    }
}
