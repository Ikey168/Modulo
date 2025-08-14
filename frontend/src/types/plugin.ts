export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  jarPath: string;
  status: PluginStatus;
  type: PluginType;
  runtime: PluginRuntime;
  requiredPermissions: string[];
  configSchema?: { [key: string]: any };
  registeredAt: string;
  updatedAt: string;
}

export enum PluginStatus {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
  STARTING = 'STARTING',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR'
}

export enum PluginType {
  USER_INTERFACE = 'USER_INTERFACE',
  DATA_PROCESSOR = 'DATA_PROCESSOR',
  INTEGRATION = 'INTEGRATION',
  UTILITY = 'UTILITY'
}

export enum PluginRuntime {
  JAR = 'JAR',
  GRPC = 'GRPC'
}

export interface PluginHealthCheck {
  status: string;
  message: string;
  timestamp: string;
  healthy: boolean;
}

export interface PluginStatusResponse {
  pluginId: string;
  status: PluginStatus;
  health: PluginHealthCheck;
}

export interface PluginInstallRequest {
  file: File;
  config?: string;
}

export interface PluginInstallResponse {
  success?: boolean;
  error?: string;
  pluginId?: string;
  message?: string;
}

export interface PluginActionResponse {
  success?: boolean;
  error?: string;
  message?: string;
}
