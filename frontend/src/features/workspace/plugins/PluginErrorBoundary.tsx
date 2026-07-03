import { Component, type ReactNode } from 'react';

interface Props {
  /** Plugin/surface name, for the fallback message and the console log. */
  name: string;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Isolates a plugin-contributed surface: a render error inside one plugin is
 * caught here and shown inline, so it can never blank out the host shell or the
 * other installed plugins.
 */
export class PluginErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[plugin] "%s" crashed while rendering', this.props.name, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-sm rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-center">
            <p className="text-sm font-medium text-destructive">The “{this.props.name}” plugin hit an error.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The rest of the workspace keeps working. Try reloading, or disable the plugin from the marketplace.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
