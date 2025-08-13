package com.modulo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Service to detect network connectivity changes and trigger sync events
 */
@Service
@ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
public class NetworkDetectionService {

    private static final Logger logger = LoggerFactory.getLogger(NetworkDetectionService.class);
    
    private final AtomicBoolean wasOnlinePreviously = new AtomicBoolean(false);
    private final AtomicBoolean isCurrentlyOnline = new AtomicBoolean(false);
    
    @Autowired
    private ApplicationEventPublisher eventPublisher;
    
    @Autowired
    private OfflineSyncService offlineSyncService;
    
    /**
     * Check network connectivity every 30 seconds
     */
    @Scheduled(fixedRate = 30000) // 30 seconds
    public void checkNetworkConnectivity() {
        boolean currentOnlineStatus = isNetworkAvailable();
        boolean previousOnlineStatus = wasOnlinePreviously.get();
        
        isCurrentlyOnline.set(currentOnlineStatus);
        
        // Detect network state changes
        if (currentOnlineStatus && !previousOnlineStatus) {
            handleNetworkReconnected();
        } else if (!currentOnlineStatus && previousOnlineStatus) {
            handleNetworkDisconnected();
        }
        
        wasOnlinePreviously.set(currentOnlineStatus);
    }
    
    /**
     * Check if network is available by attempting to connect to reliable hosts
     */
    private boolean isNetworkAvailable() {
        String[] hosts = {
            "google.com:80",
            "github.com:80",
            "cloudflare.com:80"
        };
        
        for (String host : hosts) {
            if (canReachHost(host)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Test connectivity to a specific host
     */
    private boolean canReachHost(String hostPort) {
        try {
            String[] parts = hostPort.split(":");
            String host = parts[0];
            int port = Integer.parseInt(parts[1]);
            
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), 3000); // 3 second timeout
                return true;
            }
        } catch (IOException | NumberFormatException e) {
            logger.debug("Cannot reach host {}: {}", hostPort, e.getMessage());
            return false;
        }
    }
    
    /**
     * Handle network reconnection - trigger background sync
     */
    private void handleNetworkReconnected() {
        logger.info("Network reconnected - triggering background sync");
        
        // Publish network reconnection event
        eventPublisher.publishEvent(new NetworkReconnectedEvent(this));
        
        // Trigger immediate sync of offline changes
        try {
            offlineSyncService.syncOfflineChanges();
            logger.info("Background sync completed successfully after network reconnection");
        } catch (Exception e) {
            logger.error("Error during background sync after network reconnection", e);
        }
    }
    
    /**
     * Handle network disconnection
     */
    private void handleNetworkDisconnected() {
        logger.info("Network disconnected - switching to offline mode");
        eventPublisher.publishEvent(new NetworkDisconnectedEvent(this));
    }
    
    /**
     * Get current network status
     */
    public boolean isOnline() {
        return isCurrentlyOnline.get();
    }
    
    /**
     * Force a network check (useful for manual testing)
     */
    public void forceNetworkCheck() {
        checkNetworkConnectivity();
    }
    
    /**
     * Event published when network reconnects
     */
    public static class NetworkReconnectedEvent {
        private final NetworkDetectionService source;
        
        public NetworkReconnectedEvent(NetworkDetectionService source) {
            this.source = source;
        }
        
        public NetworkDetectionService getSource() {
            return source;
        }
    }
    
    /**
     * Event published when network disconnects
     */
    public static class NetworkDisconnectedEvent {
        private final NetworkDetectionService source;
        
        public NetworkDisconnectedEvent(NetworkDetectionService source) {
            this.source = source;
        }
        
        public NetworkDetectionService getSource() {
            return source;
        }
    }
}
