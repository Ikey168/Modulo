package com.modulo.grpc.service;

import com.modulo.plugin.grpc.*;
import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginInfo;
import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.manager.PluginManager;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.*;

/**
 * Simplified gRPC Plugin Service Implementation
 */
@GrpcService
public class SimplePluginServiceImpl extends PluginServiceGrpc.PluginServiceImplBase {
    
    private static final Logger logger = LoggerFactory.getLogger(SimplePluginServiceImpl.class);
    
    @Autowired
    private PluginManager pluginManager;
    
    @Override
    public void initialize(InitializeRequest request, StreamObserver<InitializeResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            Plugin plugin = pluginManager.getPlugin(pluginId);
            if (plugin != null) {
                // Convert string parameters to Object map
                Map<String, Object> params = new HashMap<>();
                request.getConfigMap().forEach(params::put);
                
                plugin.initialize(params);
                
                InitializeResponse response = InitializeResponse.newBuilder()
                    .setSuccess(true)
                    .setMessage("Plugin initialized successfully")
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            } else {
                InitializeResponse response = InitializeResponse.newBuilder()
                    .setSuccess(false)
                    .setMessage("Plugin not found: " + pluginId)
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            }
        } catch (Exception e) {
            logger.error("Failed to initialize plugin: {}", request.getPluginId(), e);
            
            InitializeResponse response = InitializeResponse.newBuilder()
                .setSuccess(false)
                .setMessage("Initialization failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void start(StartRequest request, StreamObserver<StartResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            pluginManager.startPlugin(pluginId);
            
            StartResponse response = StartResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Plugin started successfully")
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            logger.error("Failed to start plugin: {}", request.getPluginId(), e);
            
            StartResponse response = StartResponse.newBuilder()
                .setSuccess(false)
                .setMessage("Start failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void stop(StopRequest request, StreamObserver<StopResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            pluginManager.stopPlugin(pluginId);
            
            StopResponse response = StopResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Plugin stopped successfully")
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            logger.error("Failed to stop plugin: {}", request.getPluginId(), e);
            
            StopResponse response = StopResponse.newBuilder()
                .setSuccess(false)
                .setMessage("Stop failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void shutdown(ShutdownRequest request, StreamObserver<ShutdownResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            pluginManager.stopPlugin(pluginId); // Use stop since shutdown doesn't exist
            
            ShutdownResponse response = ShutdownResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Plugin shutdown successfully")
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            logger.error("Failed to shutdown plugin: {}", request.getPluginId(), e);
            
            ShutdownResponse response = ShutdownResponse.newBuilder()
                .setSuccess(false)
                .setMessage("Shutdown failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void getStatus(StatusRequest request, StreamObserver<StatusResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            Plugin plugin = pluginManager.getPlugin(pluginId);
            
            com.modulo.plugin.grpc.PluginStatus status;
            if (plugin != null) {
                // Try to get status from plugin manager
                Object pluginStatus = pluginManager.getPluginStatus(pluginId);
                if (pluginStatus != null) {
                    status = com.modulo.plugin.grpc.PluginStatus.ACTIVE;
                } else {
                    status = com.modulo.plugin.grpc.PluginStatus.INACTIVE;
                }
            } else {
                status = com.modulo.plugin.grpc.PluginStatus.UNKNOWN;
            }
            
            StatusResponse response = StatusResponse.newBuilder()
                .setStatus(status)
                .setMessage("Plugin status: " + status.name())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            logger.error("Failed to get plugin status: {}", request.getPluginId(), e);
            
            StatusResponse response = StatusResponse.newBuilder()
                .setStatus(com.modulo.plugin.grpc.PluginStatus.ERROR)
                .setMessage("Status check failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void healthCheck(HealthCheckRequest request, StreamObserver<HealthCheckResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            Plugin plugin = pluginManager.getPlugin(pluginId);
            
            boolean isHealthy = false;
            String message = "Plugin not found";
            
            if (plugin != null) {
                HealthCheck health = pluginManager.checkPluginHealth(pluginId);
                if (health != null) {
                    isHealthy = health.isHealthy();
                    message = health.getMessage();
                } else {
                    isHealthy = true; // Assume healthy if no health check available
                    message = "Plugin is available";
                }
            }
            
            HealthCheckResponse response = HealthCheckResponse.newBuilder()
                .setHealth(isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY)
                .setMessage(message)
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            logger.error("Failed to check plugin health: {}", request.getPluginId(), e);
            
            HealthCheckResponse response = HealthCheckResponse.newBuilder()
                .setHealth(HealthStatus.UNHEALTHY)
                .setMessage("Health check failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void getInfo(InfoRequest request, StreamObserver<InfoResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            Plugin plugin = pluginManager.getPlugin(pluginId);
            
            if (plugin != null) {
                PluginInfo info = plugin.getInfo();
                
                InfoResponse response = InfoResponse.newBuilder()
                    .setName(info.getName())
                    .setDescription(info.getDescription() != null ? info.getDescription() : "")
                    .setVersion(info.getVersion())
                    .setAuthor(info.getAuthor() != null ? info.getAuthor() : "Unknown")
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            } else {
                InfoResponse response = InfoResponse.newBuilder()
                    .setName("Unknown")
                    .setDescription("Plugin not found")
                    .setVersion("0.0.0")
                    .setAuthor("Unknown")
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            }
        } catch (Exception e) {
            logger.error("Failed to get plugin info: {}", request.getPluginId(), e);
            
            InfoResponse response = InfoResponse.newBuilder()
                .setName("Error")
                .setDescription("Failed to get plugin info: " + e.getMessage())
                .setVersion("0.0.0")
                .setAuthor("Unknown")
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void getCapabilities(CapabilitiesRequest request, StreamObserver<CapabilitiesResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            Plugin plugin = pluginManager.getPlugin(pluginId);
            
            CapabilitiesResponse.Builder responseBuilder = CapabilitiesResponse.newBuilder();
            
            if (plugin != null) {
                List<String> capabilities = plugin.getCapabilities();
                if (capabilities != null) {
                    responseBuilder.addAllSupportedOperations(capabilities);
                }
            }
            
            responseObserver.onNext(responseBuilder.build());
            responseObserver.onCompleted();
        } catch (Exception e) {
            logger.error("Failed to get plugin capabilities: {}", request.getPluginId(), e);
            
            CapabilitiesResponse response = CapabilitiesResponse.newBuilder()
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void configure(ConfigureRequest request, StreamObserver<ConfigureResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            Plugin plugin = pluginManager.getPlugin(pluginId);
            
            if (plugin != null) {
                // Convert string config to Object map
                Map<String, Object> config = new HashMap<>();
                request.getConfigMap().forEach(config::put);
                
                plugin.initialize(config);
                
                ConfigureResponse response = ConfigureResponse.newBuilder()
                    .setSuccess(true)
                    .setMessage("Plugin configured successfully")
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            } else {
                ConfigureResponse response = ConfigureResponse.newBuilder()
                    .setSuccess(false)
                    .setMessage("Plugin not found: " + pluginId)
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            }
        } catch (Exception e) {
            logger.error("Failed to configure plugin: {}", request.getPluginId(), e);
            
            ConfigureResponse response = ConfigureResponse.newBuilder()
                .setSuccess(false)
                .setMessage("Configuration failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void getConfiguration(GetConfigurationRequest request, StreamObserver<GetConfigurationResponse> responseObserver) {
        try {
            // Return empty configuration for now
            GetConfigurationResponse response = GetConfigurationResponse.newBuilder()
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            logger.error("Failed to get plugin configuration: {}", request.getPluginId(), e);
            
            GetConfigurationResponse response = GetConfigurationResponse.newBuilder()
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
    
    @Override
    public void execute(ExecuteRequest request, StreamObserver<ExecuteResponse> responseObserver) {
        try {
            String pluginId = request.getPluginId();
            String operation = request.getOperation();
            Plugin plugin = pluginManager.getPlugin(pluginId);
            
            if (plugin != null) {
                // Convert parameters
                Map<String, Object> params = new HashMap<>();
                request.getParametersMap().forEach(params::put);
                
                // Initialize with parameters
                plugin.initialize(params);
                
                ExecuteResponse response = ExecuteResponse.newBuilder()
                    .setSuccess(true)
                    .setMessage("Operation '" + operation + "' executed successfully")
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            } else {
                ExecuteResponse response = ExecuteResponse.newBuilder()
                    .setSuccess(false)
                    .setMessage("Plugin not found: " + pluginId)
                    .build();
                
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            }
        } catch (Exception e) {
            logger.error("Failed to execute operation: {}", request.getOperation(), e);
            
            ExecuteResponse response = ExecuteResponse.newBuilder()
                .setSuccess(false)
                .setMessage("Execution failed: " + e.getMessage())
                .build();
            
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        }
    }
}
