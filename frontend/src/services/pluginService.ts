import { 
  PluginInfo, 
  PluginStatusResponse, 
  PluginInstallRequest, 
  PluginInstallResponse,
  PluginActionResponse 
} from '../types/plugin';

const API_BASE_URL = '/api/plugins';

export class PluginService {
  
  /**
   * Get all plugins
   */
  static async getAllPlugins(): Promise<PluginInfo[]> {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch plugins');
    }
    return response.json();
  }

  /**
   * Get plugin by ID
   */
  static async getPlugin(pluginId: string): Promise<PluginInfo> {
    const response = await fetch(`${API_BASE_URL}/${pluginId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch plugin: ${pluginId}`);
    }
    return response.json();
  }

  /**
   * Install a plugin
   */
  static async installPlugin(request: PluginInstallRequest): Promise<PluginInstallResponse> {
    const formData = new FormData();
    formData.append('file', request.file);
    if (request.config) {
      formData.append('config', request.config);
    }

    const response = await fetch(`${API_BASE_URL}/install`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to install plugin');
    }
    return response.json();
  }

  /**
   * Uninstall/delete a plugin
   */
  static async uninstallPlugin(pluginId: string): Promise<PluginActionResponse> {
    const response = await fetch(`${API_BASE_URL}/${pluginId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to uninstall plugin: ${pluginId}`);
    }
    return response.json();
  }

  /**
   * Start a plugin (enable)
   */
  static async startPlugin(pluginId: string): Promise<PluginActionResponse> {
    const response = await fetch(`${API_BASE_URL}/${pluginId}/start`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to start plugin: ${pluginId}`);
    }
    return response.json();
  }

  /**
   * Stop a plugin (disable)
   */
  static async stopPlugin(pluginId: string): Promise<PluginActionResponse> {
    const response = await fetch(`${API_BASE_URL}/${pluginId}/stop`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to stop plugin: ${pluginId}`);
    }
    return response.json();
  }

  /**
   * Get plugin status
   */
  static async getPluginStatus(pluginId: string): Promise<PluginStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/${pluginId}/status`);
    if (!response.ok) {
      throw new Error(`Failed to get plugin status: ${pluginId}`);
    }
    return response.json();
  }

  /**
   * Get all plugin statuses
   */
  static async getAllPluginStatuses(): Promise<{ [key: string]: PluginStatusResponse }> {
    const response = await fetch(`${API_BASE_URL}/status`);
    if (!response.ok) {
      throw new Error('Failed to get plugin statuses');
    }
    return response.json();
  }

  /**
   * Update plugin configuration
   */
  static async updatePluginConfig(pluginId: string, config: any): Promise<PluginActionResponse> {
    const response = await fetch(`${API_BASE_URL}/${pluginId}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to update plugin config: ${pluginId}`);
    }
    return response.json();
  }
}
