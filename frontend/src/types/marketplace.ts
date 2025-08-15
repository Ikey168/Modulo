export interface RemotePluginEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadUrl: string;
  checksum: string;
  fileSize: number;
  category: string;
  tags: string[];
  screenshots: string[];
  homepageUrl: string;
  documentationUrl: string;
  licenseType: string;
  minPlatformVersion: string;
  requiredPermissions: string[];
  publishedAt: string;
  updatedAt: string;
  downloadCount: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  deprecated: boolean;
}

export interface PluginSearchResponse {
  plugins: RemotePluginEntry[];
  total: number;
  query: string;
  category: string | null;
  limit: number;
}

export interface PluginInstallResponse {
  success: boolean;
  pluginId?: string;
  message: string;
  source?: string;
  repositoryId?: string;
  url?: string;
  error?: string;
}

export interface PluginSearchFilters {
  query: string;
  category: string | null;
  minRating: number;
  verified: boolean | null;
  sortBy: 'relevance' | 'rating' | 'downloads' | 'updated' | 'name';
  sortOrder: 'asc' | 'desc';
}

export const DEFAULT_SEARCH_FILTERS: PluginSearchFilters = {
  query: '',
  category: null,
  minRating: 0,
  verified: null,
  sortBy: 'relevance',
  sortOrder: 'desc',
};
