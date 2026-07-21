package com.modulo.plugin.submission;

import com.modulo.plugin.api.PluginException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.jar.Manifest;
import java.util.regex.Pattern;

/**
 * Service for validating plugin submissions
 */
@Service
public class PluginValidationService {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginValidationService.class);
    
    // Security validation patterns
    private static final List<String> DANGEROUS_CLASSES = Arrays.asList(
        "java.lang.Runtime",
        "java.lang.ProcessBuilder",
        "java.io.FileInputStream",
        "java.io.FileOutputStream",
        "java.net.Socket",
        "java.net.ServerSocket",
        "java.lang.System",
        "java.lang.reflect.Method",
        "sun.misc.Unsafe"
    );
    
    private static final List<Pattern> DANGEROUS_PATTERNS = Arrays.asList(
        Pattern.compile("Runtime\\.getRuntime\\(\\)"),
        Pattern.compile("System\\.exit\\("),
        Pattern.compile("System\\.setProperty\\("),
        Pattern.compile("Class\\.forName\\("),
        Pattern.compile("URLClassLoader"),
        Pattern.compile("ScriptEngine"),
        Pattern.compile("javax\\.script")
    );
    
    private static final long MAX_PLUGIN_SIZE = 50 * 1024 * 1024; // 50MB
    private static final List<String> REQUIRED_MANIFEST_ATTRIBUTES = Arrays.asList(
        "Plugin-Name",
        "Plugin-Version",
        "Plugin-Main-Class",
        "Plugin-API-Version"
    );
    
    /**
     * Perform comprehensive validation of a plugin submission
     */
    public ValidationResult validateSubmission(PluginSubmission submission) {
        logger.info("Starting validation for plugin submission: {}", submission.getPluginName());
        
        ValidationResult result = new ValidationResult();
        
        try {
            // Basic metadata validation
            validateMetadata(submission, result);

            // EXTERNAL-only policy (#395, ADR 0004): marketplace submissions
            // are container images; the JAR path exists only for legacy rows.
            if (submission.getImageReference() != null && !submission.getImageReference().isBlank()) {
                validateImageSubmission(submission, result);
            } else if (submission.getJarFilePath() != null) {
                result.addError("[POLICY] Marketplace submissions run as EXTERNAL workloads and must be "
                    + "container images — JAR submissions are no longer accepted. Submit an image "
                    + "reference pinned by digest (see docs/deploying-external-plugins.md).");
                // Legacy validation still runs so reviewers see the full picture on old rows.
                validateJarFile(submission.getJarFilePath(), result);
                performSecurityCheck(submission.getJarFilePath(), result);
                performCompatibilityCheck(submission.getJarFilePath(), result);
                validateChecksum(submission, result);
            } else {
                result.addError("[POLICY] An image reference (pinned by digest) is required — "
                    + "marketplace plugins run as EXTERNAL workloads (#395).");
            }
            
            // Update submission with validation results
            submission.setSecurityCheckPassed(result.isSecurityCheckPassed());
            submission.setCompatibilityCheckPassed(result.isCompatibilityCheckPassed());
            
            // Convert lists to strings for storage
            if (!result.getErrors().isEmpty()) {
                submission.setValidationErrors(String.join("; ", result.getErrors()));
            }
            if (!result.getWarnings().isEmpty()) {
                submission.setValidationWarnings(String.join("; ", result.getWarnings()));
            }
            
        } catch (Exception e) {
            logger.error("Validation failed for submission: {}", submission.getPluginName(), e);
            result.addError("Validation process failed: " + e.getMessage());
        }
        
        logger.info("Validation completed for {}: {} errors, {} warnings", 
                   submission.getPluginName(), result.getErrors().size(), result.getWarnings().size());
        
        return result;
    }
    
    /**
     * Validate submission metadata
     */
    /** OCI reference: registry[/repo]+ name, optionally :tag — but digest pinning is the law. */
    private static final java.util.regex.Pattern IMAGE_REFERENCE_PATTERN =
        java.util.regex.Pattern.compile("^[a-z0-9]+([._-][a-z0-9]+)*(([:/][a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*))+$");
    private static final java.util.regex.Pattern IMAGE_DIGEST_PATTERN =
        java.util.regex.Pattern.compile("^sha256:[0-9a-f]{64}$");

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.modulo.plugin.manager.PluginSecurityManager securityManager;

    /**
     * Image-based (EXTERNAL) submission validation (#395): digest pinning,
     * declared permissions against the allowlist, contract compatibility,
     * and signature/provenance hooks.
     */
    private void validateImageSubmission(PluginSubmission submission, ValidationResult result) {
        String reference = submission.getImageReference().trim();
        if (!IMAGE_REFERENCE_PATTERN.matcher(reference).matches()) {
            result.addError("Image reference '" + reference + "' is not a valid OCI reference "
                + "(expected e.g. ghcr.io/acme/my-plugin)");
        }

        String digest = submission.getImageDigest();
        if (digest == null || digest.isBlank()) {
            result.addError("Image digest is required — pin the exact image with sha256:<64 hex chars> "
                + "(docker inspect --format='{{index .RepoDigests 0}}' <image>)");
        } else if (!IMAGE_DIGEST_PATTERN.matcher(digest.trim()).matches()) {
            result.addError("Image digest '" + digest + "' is not pinned — expected sha256:<64 hex chars>; "
                + "tags are mutable and not accepted");
        }

        if (submission.getRequiredPermissions() != null && !submission.getRequiredPermissions().isBlank()) {
            for (String permission : submission.getRequiredPermissions().split(",")) {
                String trimmed = permission.trim();
                if (!trimmed.isEmpty() && securityManager != null
                        && !securityManager.isValidPermission(trimmed)) {
                    result.addError("Declared permission '" + trimmed + "' is not in the allowlist");
                }
            }
        }

        // Contract compatibility: same rule the JAR path used, driven from metadata.
        String minVersion = submission.getMinPlatformVersion();
        if (minVersion != null && !minVersion.isBlank() && !minVersion.startsWith("1.")) {
            result.addError("Unsupported minimum platform version '" + minVersion
                + "' — the v1 plugin contract requires a 1.x platform");
            result.setCompatibilityCheckPassed(false);
        } else {
            result.setCompatibilityCheckPassed(true);
        }

        // Signature/provenance hook (docs/CONTAINER_IMAGE_SIGNING.md): not
        // enforced yet — recorded as a warning so reviewers see it, and so the
        // enforcement point already exists when cosign verification lands.
        result.addWarning("Image signature/provenance not verified (enforcement follows "
            + "docs/CONTAINER_IMAGE_SIGNING.md; review manually until then)");

        // The pod boundary is the security model for image submissions —
        // there is no JAR to byte-scan.
        result.setSecurityCheckPassed(result.getErrors().isEmpty());
    }

    private void validateMetadata(PluginSubmission submission, ValidationResult result) {
        if (submission.getPluginName() == null || submission.getPluginName().trim().isEmpty()) {
            result.addError("Plugin name is required");
        } else if (submission.getPluginName().length() > 100) {
            result.addError("Plugin name must be 100 characters or less");
        }
        
        if (submission.getVersion() == null || submission.getVersion().trim().isEmpty()) {
            result.addError("Plugin version is required");
        } else if (!isValidVersion(submission.getVersion())) {
            result.addError("Plugin version must follow semantic versioning (e.g., 1.0.0)");
        }
        
        if (submission.getDescription() == null || submission.getDescription().trim().isEmpty()) {
            result.addError("Plugin description is required");
        } else if (submission.getDescription().length() > 1000) {
            result.addError("Plugin description must be 1000 characters or less");
        }
        
        if (submission.getDeveloperEmail() == null || !isValidEmail(submission.getDeveloperEmail())) {
            result.addError("Valid developer email is required");
        }
        
        if (submission.getCategory() == null || submission.getCategory().trim().isEmpty()) {
            result.addWarning("Plugin category is recommended for better discoverability");
        }
        
        if (submission.getHomepageUrl() != null && !isValidUrl(submission.getHomepageUrl())) {
            result.addWarning("Homepage URL format is invalid");
        }
        
        if (submission.getDocumentationUrl() != null && !isValidUrl(submission.getDocumentationUrl())) {
            result.addWarning("Documentation URL format is invalid");
        }
    }
    
    /**
     * Validate JAR file structure and contents
     */
    private void validateJarFile(String jarFilePath, ValidationResult result) {
        Path jarPath = Paths.get(jarFilePath);
        
        if (!Files.exists(jarPath)) {
            result.addError("JAR file not found: " + jarFilePath);
            return;
        }
        
        try {
            long fileSize = Files.size(jarPath);
            if (fileSize > MAX_PLUGIN_SIZE) {
                result.addError("Plugin file size exceeds maximum allowed size of " + 
                               (MAX_PLUGIN_SIZE / 1024 / 1024) + "MB");
            }
            
            try (JarFile jarFile = new JarFile(jarFilePath)) {
                // Validate manifest
                validateManifest(jarFile, result);
                
                // Check for main class
                validateMainClass(jarFile, result);
                
                // Scan for potentially dangerous content
                scanJarContents(jarFile, result);
                
            } catch (IOException e) {
                result.addError("Failed to read JAR file: " + e.getMessage());
            }
            
        } catch (IOException e) {
            result.addError("Failed to access JAR file: " + e.getMessage());
        }
    }
    
    /**
     * Validate JAR manifest
     */
    private void validateManifest(JarFile jarFile, ValidationResult result) {
        try {
            Manifest manifest = jarFile.getManifest();
            if (manifest == null) {
                result.addError("JAR file must contain a valid MANIFEST.MF");
                return;
            }
            
            for (String requiredAttr : REQUIRED_MANIFEST_ATTRIBUTES) {
                String value = manifest.getMainAttributes().getValue(requiredAttr);
                if (value == null || value.trim().isEmpty()) {
                    result.addError("Missing required manifest attribute: " + requiredAttr);
                }
            }
            
        } catch (IOException e) {
            result.addError("Failed to read manifest: " + e.getMessage());
        }
    }
    
    /**
     * Validate main class exists
     */
    private void validateMainClass(JarFile jarFile, ValidationResult result) {
        try {
            Manifest manifest = jarFile.getManifest();
            if (manifest != null) {
                String mainClass = manifest.getMainAttributes().getValue("Plugin-Main-Class");
                if (mainClass != null) {
                    String classPath = mainClass.replace('.', '/') + ".class";
                    JarEntry entry = jarFile.getJarEntry(classPath);
                    if (entry == null) {
                        result.addError("Main class not found in JAR: " + mainClass);
                    }
                }
            }
        } catch (IOException e) {
            result.addWarning("Could not verify main class: " + e.getMessage());
        }
    }
    
    /**
     * Scan JAR contents for security issues
     */
    private void scanJarContents(JarFile jarFile, ValidationResult result) {
        Enumeration<JarEntry> entries = jarFile.entries();
        
        while (entries.hasMoreElements()) {
            JarEntry entry = entries.nextElement();
            String entryName = entry.getName();
            
            // Check for suspicious file types
            if (entryName.endsWith(".exe") || entryName.endsWith(".bat") || 
                entryName.endsWith(".sh") || entryName.endsWith(".dll")) {
                result.addError("Executable files are not allowed: " + entryName);
            }
            
            // Check for hidden files
            if (entryName.startsWith(".") && !entryName.equals("./")) {
                result.addWarning("Hidden files detected: " + entryName);
            }
            
            // Analyze class files for dangerous patterns
            if (entryName.endsWith(".class")) {
                analyzeClassFile(jarFile, entry, result);
            }
        }
    }
    
    /**
     * Analyze class file for security issues
     */
    private void analyzeClassFile(JarFile jarFile, JarEntry entry, ValidationResult result) {
        try (InputStream is = jarFile.getInputStream(entry);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            
            byte[] buffer = new byte[1024];
            int length;
            while ((length = is.read(buffer)) != -1) {
                baos.write(buffer, 0, length);
            }
            
            String classContent = new String(baos.toByteArray());
            
            // Check for dangerous class references
            for (String dangerousClass : DANGEROUS_CLASSES) {
                if (classContent.contains(dangerousClass)) {
                    result.addError("Potentially dangerous class usage detected: " + dangerousClass + 
                                  " in " + entry.getName());
                }
            }
            
            // Check for dangerous patterns
            for (Pattern pattern : DANGEROUS_PATTERNS) {
                if (pattern.matcher(classContent).find()) {
                    result.addError("Potentially dangerous code pattern detected in " + entry.getName());
                }
            }
            
        } catch (IOException e) {
            result.addWarning("Could not analyze class file: " + entry.getName());
        }
    }
    
    /**
     * Perform security validation
     */
    private void performSecurityCheck(String jarFilePath, ValidationResult result) {
        // Additional security checks can be added here
        // For now, we rely on the JAR content scanning
        
        boolean hasSecurityIssues = result.getErrors().stream()
            .anyMatch(error -> error.contains("dangerous") || error.contains("Executable"));
        
        result.setSecurityCheckPassed(!hasSecurityIssues);
        
        if (!result.isSecurityCheckPassed()) {
            logger.warn("Security check failed for: {}", jarFilePath);
        }
    }
    
    /**
     * Perform compatibility validation
     */
    private void performCompatibilityCheck(String jarFilePath, ValidationResult result) {
        try (JarFile jarFile = new JarFile(jarFilePath)) {
            Manifest manifest = jarFile.getManifest();
            if (manifest != null) {
                String apiVersion = manifest.getMainAttributes().getValue("Plugin-API-Version");
                if (apiVersion != null) {
                    // Check API version compatibility
                    if (!isCompatibleApiVersion(apiVersion)) {
                        result.addError("Plugin API version " + apiVersion + " is not compatible with current platform");
                        result.setCompatibilityCheckPassed(false);
                        return;
                    }
                }
            }
            
            result.setCompatibilityCheckPassed(true);
            
        } catch (IOException e) {
            result.addError("Could not verify compatibility: " + e.getMessage());
            result.setCompatibilityCheckPassed(false);
        }
    }
    
    /**
     * Validate and calculate checksum
     */
    private void validateChecksum(PluginSubmission submission, ValidationResult result) {
        if (submission.getJarFilePath() == null) {
            return;
        }
        
        try {
            String calculatedChecksum = calculateSHA256(submission.getJarFilePath());
            submission.setChecksum(calculatedChecksum);
            
            // Update file size
            Path jarPath = Paths.get(submission.getJarFilePath());
            submission.setFileSize(Files.size(jarPath));
            
        } catch (Exception e) {
            result.addError("Failed to calculate checksum: " + e.getMessage());
        }
    }
    
    /**
     * Calculate SHA-256 checksum of a file
     */
    private String calculateSHA256(String filePath) throws NoSuchAlgorithmException, IOException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        
        try (FileInputStream fis = new FileInputStream(filePath)) {
            byte[] buffer = new byte[8192];
            int length;
            
            while ((length = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, length);
            }
        }
        
        byte[] hashBytes = digest.digest();
        StringBuilder hexString = new StringBuilder();
        
        for (byte b : hashBytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        
        return hexString.toString();
    }
    
    // Utility methods
    private boolean isValidVersion(String version) {
        return version.matches("\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9]+)?");
    }
    
    private boolean isValidEmail(String email) {
        return email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    }
    
    private boolean isValidUrl(String url) {
        return url.matches("^https?://.*");
    }
    
    private boolean isCompatibleApiVersion(String apiVersion) {
        // For now, accept any version that starts with "1."
        // This should be made more sophisticated based on actual API versioning
        return apiVersion.startsWith("1.");
    }
}
