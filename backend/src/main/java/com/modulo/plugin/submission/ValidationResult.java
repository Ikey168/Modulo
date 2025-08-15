package com.modulo.plugin.submission;

import java.util.ArrayList;
import java.util.List;

/**
 * Result of plugin validation containing errors, warnings, and status flags
 */
public class ValidationResult {
    
    private final List<String> errors;
    private final List<String> warnings;
    private boolean securityCheckPassed;
    private boolean compatibilityCheckPassed;
    
    public ValidationResult() {
        this.errors = new ArrayList<>();
        this.warnings = new ArrayList<>();
        this.securityCheckPassed = true;
        this.compatibilityCheckPassed = true;
    }
    
    /**
     * Add a validation error
     */
    public void addError(String error) {
        this.errors.add(error);
    }
    
    /**
     * Add a validation warning
     */
    public void addWarning(String warning) {
        this.warnings.add(warning);
    }
    
    /**
     * Check if validation passed (no errors)
     */
    public boolean isValid() {
        return errors.isEmpty();
    }
    
    /**
     * Check if there are any issues (errors or warnings)
     */
    public boolean hasIssues() {
        return !errors.isEmpty() || !warnings.isEmpty();
    }
    
    // Getters and setters
    public List<String> getErrors() {
        return new ArrayList<>(errors);
    }
    
    public List<String> getWarnings() {
        return new ArrayList<>(warnings);
    }
    
    public boolean isSecurityCheckPassed() {
        return securityCheckPassed;
    }
    
    public void setSecurityCheckPassed(boolean securityCheckPassed) {
        this.securityCheckPassed = securityCheckPassed;
    }
    
    public boolean isCompatibilityCheckPassed() {
        return compatibilityCheckPassed;
    }
    
    public void setCompatibilityCheckPassed(boolean compatibilityCheckPassed) {
        this.compatibilityCheckPassed = compatibilityCheckPassed;
    }
    
    /**
     * Get a summary of the validation result
     */
    public String getSummary() {
        StringBuilder summary = new StringBuilder();
        
        if (isValid()) {
            summary.append("Validation passed");
        } else {
            summary.append("Validation failed with ").append(errors.size()).append(" error(s)");
        }
        
        if (!warnings.isEmpty()) {
            summary.append(" and ").append(warnings.size()).append(" warning(s)");
        }
        
        return summary.toString();
    }
    
    @Override
    public String toString() {
        return "ValidationResult{" +
                "errors=" + errors.size() +
                ", warnings=" + warnings.size() +
                ", securityCheckPassed=" + securityCheckPassed +
                ", compatibilityCheckPassed=" + compatibilityCheckPassed +
                '}';
    }
}
