package com.modulo.plugin.event;

import java.util.Map;

/**
 * Events related to system operations
 */
public abstract class SystemEvent extends PluginEvent {
    
    protected SystemEvent(String type, Object source, Map<String, Object> metadata) {
        super(type, source, metadata);
    }
    
    protected SystemEvent(String type, Object source) {
        super(type, source);
    }
    
    /**
     * Event fired when application starts
     */
    public static class ApplicationStarted extends SystemEvent {
        public ApplicationStarted() {
            super("system.application_started", "system");
        }
    }
    
    /**
     * Event fired when application is stopping
     */
    public static class ApplicationStopping extends SystemEvent {
        public ApplicationStopping() {
            super("system.application_stopping", "system");
        }
    }
    
    /**
     * Event fired when configuration is updated
     */
    public static class ConfigurationUpdated extends SystemEvent {
        private final String configKey;
        private final Object oldValue;
        private final Object newValue;
        
        public ConfigurationUpdated(String configKey, Object oldValue, Object newValue) {
            super("system.configuration_updated", "system");
            this.configKey = configKey;
            this.oldValue = oldValue;
            this.newValue = newValue;
            addMetadata("configKey", configKey);
            addMetadata("oldValue", oldValue);
            addMetadata("newValue", newValue);
        }
        
        public String getConfigKey() { return configKey; }
        public Object getOldValue() { return oldValue; }
        public Object getNewValue() { return newValue; }
    }
    
    /**
     * Event fired when a plugin is installed
     */
    public static class PluginInstalled extends SystemEvent {
        private final String pluginId;
        private final String version;
        
        public PluginInstalled(String pluginId, String version) {
            super("system.plugin_installed", "system");
            this.pluginId = pluginId;
            this.version = version;
            addMetadata("pluginId", pluginId);
            addMetadata("version", version);
        }
        
        public String getPluginId() { return pluginId; }
        public String getVersion() { return version; }
    }
    
    /**
     * Event fired when a plugin is uninstalled
     */
    public static class PluginUninstalled extends SystemEvent {
        private final String pluginId;
        
        public PluginUninstalled(String pluginId) {
            super("system.plugin_uninstalled", "system");
            this.pluginId = pluginId;
            addMetadata("pluginId", pluginId);
        }
        
        public String getPluginId() { return pluginId; }
    }
    
    /**
     * Event fired when a remote plugin is installed
     */
    public static class RemotePluginInstalled extends SystemEvent {
        private final String pluginId;
        private final String version;
        private final String remoteUrl;
        
        public RemotePluginInstalled(String pluginId, String version, String remoteUrl) {
            super("system.remote_plugin_installed", "system");
            this.pluginId = pluginId;
            this.version = version;
            this.remoteUrl = remoteUrl;
            addMetadata("pluginId", pluginId);
            addMetadata("version", version);
            addMetadata("remoteUrl", remoteUrl);
        }
        
        public String getPluginId() { return pluginId; }
        public String getVersion() { return version; }
        public String getRemoteUrl() { return remoteUrl; }
    }
    
    /**
     * Event fired when a scheduled task executes
     */
    public static class ScheduledTaskExecuted extends SystemEvent {
        private final String taskName;
        private final boolean success;
        private final String result;
        
        public ScheduledTaskExecuted(String taskName, boolean success, String result) {
            super("system.scheduled_task_executed", "system");
            this.taskName = taskName;
            this.success = success;
            this.result = result;
            addMetadata("taskName", taskName);
            addMetadata("success", success);
            addMetadata("result", result);
        }
        
        public String getTaskName() { return taskName; }
        public boolean isSuccess() { return success; }
        public String getResult() { return result; }
    }
}
