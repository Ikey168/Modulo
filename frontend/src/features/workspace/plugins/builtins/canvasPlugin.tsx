// Canvas - contributes a freeform board view where notes are arranged spatially
// and connected. Installable (not pre-installed); lazy-loaded, so the CanvasView
// tree only enters the bundle once this plugin is installed.
import { Frame } from 'lucide-react';
import { CanvasView } from '../../CanvasView';
import type { PluginModule, WorkspaceViewProps } from '../types';

function CanvasSurface(p: WorkspaceViewProps) {
  return <CanvasView notes={p.data.notes} onOpenNote={p.onOpenNote} />;
}

const canvasPlugin: PluginModule = {
  activate(ctx) {
    ctx.addView({ id: 'canvas', label: 'Canvas', icon: Frame, order: 60, component: CanvasSurface });
  },
};

export default canvasPlugin;
