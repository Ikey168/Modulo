import { 
  RemotePluginEntry, 
  PluginSearchResponse, 
  PluginInstallResponse 
} from '../types/marketplace';

const API_BASE_URL = '/api/plugins/repository';

export class MarketplaceService {
  
  /**
   * Search for plugins in the marketplace
   */
  static async searchPlugins(
    query: string = '',
    category?: string,
    limit: number = 20
  ): Promise<PluginSearchResponse> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category) params.append('category', category);
    params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/search?${params}`);
    if (!response.ok) {
      throw new Error('Failed to search plugins');
    }
    return response.json();
  }

  /**
   * Get available plugin categories
   */
  static async getCategories(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/categories`);
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    return response.json();
  }

  /**
   * Get featured plugins
   */
  static async getFeaturedPlugins(limit: number = 10): Promise<RemotePluginEntry[]> {
    const response = await fetch(`${API_BASE_URL}/featured?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch featured plugins');
    }
    return response.json();
  }

  /**
   * Get detailed information about a plugin
   */
  static async getPluginDetails(pluginId: string): Promise<RemotePluginEntry> {
    const response = await fetch(`${API_BASE_URL}/plugin/${pluginId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch plugin details: ${pluginId}`);
    }
    return response.json();
  }

  /**
   * Install a plugin from the marketplace
   */
  static async installPlugin(
    pluginId: string,
    config?: string
  ): Promise<PluginInstallResponse> {
    const params = new URLSearchParams();
    if (config) params.append('config', config);

    const response = await fetch(`${API_BASE_URL}/install/${pluginId}`, {
      method: 'POST',
      body: params,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to install plugin');
    }
    return response.json();
  }

  /**
   * Get configured plugin repositories
   */
  static async getRepositories(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/sources`);
    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }
    return response.json();
  }

  /**
   * Add a new plugin repository
   */
  static async addRepository(repositoryUrl: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: repositoryUrl }),
    });

    if (!response.ok) {
      throw new Error('Failed to add repository');
    }
  }
}
