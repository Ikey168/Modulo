# Plugin Manager UI

A React-based user interface for managing plugins in the Modulo application.

## Components

- **PluginManager**: Main plugin management interface
- **PluginCard**: Individual plugin display and controls
- **PluginInstaller**: Modal for installing new plugins

## Features

- View all installed plugins
- Enable/disable plugins
- Install new plugins via file upload
- Uninstall plugins
- View plugin details and status
- Filter plugins by status

## Usage

Navigate to `/plugins` in the application to access the Plugin Manager.

## API Integration

Integrates with the backend PluginController API endpoints:
- GET /api/plugins - List plugins
- POST /api/plugins/install - Install plugin
- POST /api/plugins/{id}/start - Enable plugin
- POST /api/plugins/{id}/stop - Disable plugin
- DELETE /api/plugins/{id} - Uninstall plugin
