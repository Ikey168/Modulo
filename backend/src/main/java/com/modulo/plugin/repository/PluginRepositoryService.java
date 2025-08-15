package com.modulo.plugin.repository;

import com.modulo.plugin.api.PluginException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for browsing and discovering remote plugins from plugin repositories
 */
@Service
public class PluginRepositoryService {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginRepositoryService.class);
    
    private final HttpClient httpClient;
    
    // Default plugin repositories
    private static final List<String> DEFAULT_REPOSITORIES = Arrays.asList(
        "https://plugins.modulo.com/api/v1",
        "https://github.com/modulo-plugins/registry/raw/main",
        "https://marketplace.modulo.com/api"
    );
    
    private List<String> configuredRepositories;
    
    public PluginRepositoryService() {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
        this.configuredRepositories = new ArrayList<>(DEFAULT_REPOSITORIES);
    }
    
    /**
     * Search for plugins in all configured repositories
     * @param query Search query
     * @param category Plugin category filter (optional)
     * @param maxResults Maximum number of results
     * @return List of matching plugins
     */
    public List<RemotePluginEntry> searchPlugins(String query, String category, int maxResults) 
            throws PluginException {
        logger.info("Searching for plugins: query='{}', category='{}', maxResults={}", 
                   query, category, maxResults);
        
        List<RemotePluginEntry> allResults = new ArrayList<>();
        
        for (String repoUrl : configuredRepositories) {
            try {
                List<RemotePluginEntry> repoResults = searchInRepository(repoUrl, query, category, maxResults);
                allResults.addAll(repoResults);
                
                if (allResults.size() >= maxResults) {
                    break;
                }
            } catch (Exception e) {
                logger.warn("Failed to search in repository: {}", repoUrl, e);
                // Continue with other repositories
            }
        }
        
        // Sort by relevance and rating
        return allResults.stream()
            .sorted((a, b) -> {
                // Sort by verified status first, then by rating, then by download count
                if (a.isVerified() != b.isVerified()) {
                    return Boolean.compare(b.isVerified(), a.isVerified());
                }
                if (Double.compare(a.getRating(), b.getRating()) != 0) {
                    return Double.compare(b.getRating(), a.getRating());
                }
                return Long.compare(b.getDownloadCount(), a.getDownloadCount());
            })
            .limit(maxResults)
            .collect(Collectors.toList());
    }
    
    /**
     * Get all available categories
     */
    public List<String> getAvailableCategories() throws PluginException {
        logger.debug("Fetching available plugin categories");
        
        List<String> categories = new ArrayList<>();
        
        for (String repoUrl : configuredRepositories) {
            try {
                List<String> repoCategories = getCategoriesFromRepository(repoUrl);
                categories.addAll(repoCategories);
            } catch (Exception e) {
                logger.warn("Failed to get categories from repository: {}", repoUrl, e);
            }
        }
        
        return categories.stream().distinct().sorted().collect(Collectors.toList());
    }
    
    /**
     * Get featured plugins
     */
    public List<RemotePluginEntry> getFeaturedPlugins(int maxResults) throws PluginException {
        logger.debug("Fetching featured plugins, maxResults={}", maxResults);
        
        List<RemotePluginEntry> featured = new ArrayList<>();
        
        for (String repoUrl : configuredRepositories) {
            try {
                List<RemotePluginEntry> repoFeatured = getFeaturedFromRepository(repoUrl, maxResults);
                featured.addAll(repoFeatured);
                
                if (featured.size() >= maxResults) {
                    break;
                }
            } catch (Exception e) {
                logger.warn("Failed to get featured plugins from repository: {}", repoUrl, e);
            }
        }
        
        return featured.stream()
            .limit(maxResults)
            .collect(Collectors.toList());
    }
    
    /**
     * Get plugin details by ID
     */
    public RemotePluginEntry getPluginDetails(String pluginId) throws PluginException {
        logger.debug("Fetching plugin details for ID: {}", pluginId);
        
        for (String repoUrl : configuredRepositories) {
            try {
                RemotePluginEntry plugin = getPluginFromRepository(repoUrl, pluginId);
                if (plugin != null) {
                    return plugin;
                }
            } catch (Exception e) {
                logger.warn("Failed to get plugin {} from repository: {}", pluginId, repoUrl, e);
            }
        }
        
        throw new PluginException("Plugin not found: " + pluginId);
    }
    
    /**
     * Add a custom repository
     */
    public void addRepository(String repositoryUrl) {
        if (!configuredRepositories.contains(repositoryUrl)) {
            configuredRepositories.add(repositoryUrl);
            logger.info("Added plugin repository: {}", repositoryUrl);
        }
    }
    
    /**
     * Remove a repository
     */
    public void removeRepository(String repositoryUrl) {
        if (configuredRepositories.remove(repositoryUrl)) {
            logger.info("Removed plugin repository: {}", repositoryUrl);
        }
    }
    
    /**
     * Get list of configured repositories
     */
    public List<String> getConfiguredRepositories() {
        return new ArrayList<>(configuredRepositories);
    }
    
    /**
     * Search in a specific repository
     */
    private List<RemotePluginEntry> searchInRepository(String repoUrl, String query, String category, int maxResults) 
            throws Exception {
        // Build search URL
        StringBuilder urlBuilder = new StringBuilder(repoUrl);
        if (!repoUrl.endsWith("/")) {
            urlBuilder.append("/");
        }
        urlBuilder.append("search?q=").append(query);
        
        if (category != null && !category.isEmpty()) {
            urlBuilder.append("&category=").append(category);
        }
        
        urlBuilder.append("&limit=").append(maxResults);
        
        String searchUrl = urlBuilder.toString();
        logger.debug("Searching repository: {}", searchUrl);
        
        // For now, return mock data since we don't have actual repositories set up
        return createMockPlugins(query, category, maxResults);
    }
    
    /**
     * Get categories from a repository
     */
    private List<String> getCategoriesFromRepository(String repoUrl) throws Exception {
        // Mock implementation - in real scenario, would make HTTP request to repo
        return Arrays.asList(
            "productivity", "security", "integration", "ui", "analytics", 
            "export", "import", "automation", "workflow", "collaboration"
        );
    }
    
    /**
     * Get featured plugins from a repository
     */
    private List<RemotePluginEntry> getFeaturedFromRepository(String repoUrl, int maxResults) throws Exception {
        // Mock implementation
        return createMockPlugins("featured", null, maxResults);
    }
    
    /**
     * Get specific plugin from repository
     */
    private RemotePluginEntry getPluginFromRepository(String repoUrl, String pluginId) throws Exception {
        // Mock implementation
        List<RemotePluginEntry> mockPlugins = createMockPlugins(pluginId, null, 1);
        return mockPlugins.isEmpty() ? null : mockPlugins.get(0);
    }
    
    /**
     * Create mock plugin data for demonstration
     */
    private List<RemotePluginEntry> createMockPlugins(String query, String category, int maxResults) {
        List<RemotePluginEntry> plugins = new ArrayList<>();
        
        // Sample plugin entries for demonstration
        RemotePluginEntry plugin1 = new RemotePluginEntry();
        plugin1.setId("excel-export-plugin");
        plugin1.setName("Excel Export Plugin");
        plugin1.setVersion("2.1.0");
        plugin1.setDescription("Export notes and data to Excel format with advanced formatting options");
        plugin1.setAuthor("Modulo Team");
        plugin1.setDownloadUrl("https://github.com/modulo-plugins/excel-export/releases/download/v2.1.0/excel-export-plugin-2.1.0.jar");
        plugin1.setChecksum("a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456");
        plugin1.setFileSize(2_456_789);
        plugin1.setCategory("export");
        plugin1.setTags(new String[]{"excel", "export", "productivity", "office"});
        plugin1.setLicenseType("MIT");
        plugin1.setRequiredPermissions(new String[]{"notes.read", "files.write"});
        plugin1.setPublishedAt(LocalDateTime.now().minusDays(30));
        plugin1.setUpdatedAt(LocalDateTime.now().minusDays(5));
        plugin1.setDownloadCount(1542);
        plugin1.setRating(4.7);
        plugin1.setReviewCount(23);
        plugin1.setVerified(true);
        plugin1.setDeprecated(false);
        
        RemotePluginEntry plugin2 = new RemotePluginEntry();
        plugin2.setId("slack-integration");
        plugin2.setName("Slack Integration");
        plugin2.setVersion("1.3.2");
        plugin2.setDescription("Send notes and notifications to Slack channels");
        plugin2.setAuthor("Community");
        plugin2.setDownloadUrl("https://github.com/community-plugins/slack-integration/releases/download/v1.3.2/slack-integration-1.3.2.jar");
        plugin2.setChecksum("b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567");
        plugin2.setFileSize(1_234_567);
        plugin2.setCategory("integration");
        plugin2.setTags(new String[]{"slack", "notifications", "collaboration", "messaging"});
        plugin2.setLicenseType("Apache-2.0");
        plugin2.setRequiredPermissions(new String[]{"notes.read", "notifications.send", "external.api"});
        plugin2.setPublishedAt(LocalDateTime.now().minusDays(60));
        plugin2.setUpdatedAt(LocalDateTime.now().minusDays(10));
        plugin2.setDownloadCount(892);
        plugin2.setRating(4.2);
        plugin2.setReviewCount(15);
        plugin2.setVerified(true);
        plugin2.setDeprecated(false);
        
        RemotePluginEntry plugin3 = new RemotePluginEntry();
        plugin3.setId("security-scanner");
        plugin3.setName("Security Scanner");
        plugin3.setVersion("3.0.1");
        plugin3.setDescription("Scan notes for sensitive information and security vulnerabilities");
        plugin3.setAuthor("SecureModulo");
        plugin3.setDownloadUrl("https://secure.modulo.com/plugins/security-scanner-3.0.1.jar");
        plugin3.setChecksum("c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678");
        plugin3.setFileSize(3_789_012);
        plugin3.setCategory("security");
        plugin3.setTags(new String[]{"security", "scanning", "privacy", "compliance"});
        plugin3.setLicenseType("Commercial");
        plugin3.setRequiredPermissions(new String[]{"notes.read", "security.scan"});
        plugin3.setPublishedAt(LocalDateTime.now().minusDays(15));
        plugin3.setUpdatedAt(LocalDateTime.now().minusDays(2));
        plugin3.setDownloadCount(234);
        plugin3.setRating(4.9);
        plugin3.setReviewCount(7);
        plugin3.setVerified(true);
        plugin3.setDeprecated(false);
        
        plugins.add(plugin1);
        plugins.add(plugin2);
        plugins.add(plugin3);
        
        // Filter by category if specified
        if (category != null && !category.isEmpty()) {
            plugins = plugins.stream()
                .filter(p -> category.equals(p.getCategory()))
                .collect(Collectors.toList());
        }
        
        // Filter by query if specified
        if (query != null && !query.isEmpty() && !query.equals("featured")) {
            String lowerQuery = query.toLowerCase();
            plugins = plugins.stream()
                .filter(p -> p.getName().toLowerCase().contains(lowerQuery) ||
                           p.getDescription().toLowerCase().contains(lowerQuery) ||
                           Arrays.stream(p.getTags()).anyMatch(tag -> tag.toLowerCase().contains(lowerQuery)))
                .collect(Collectors.toList());
        }
        
        return plugins.stream().limit(maxResults).collect(Collectors.toList());
    }
}
