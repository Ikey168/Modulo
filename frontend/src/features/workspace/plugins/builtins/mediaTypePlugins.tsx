/* eslint-disable react-refresh/only-export-components -- lazy plugin factory exports descriptors and view metadata */
import { MediaLibraryView } from '../../MediaLibraryView';
import type { MediaTypePluginDefinition } from '../../mediaLibrary';
import { MEDIA_TYPE_ICONS } from '../../mediaVisuals';
import type { PluginModule } from '../types';

export function MediaTypeSurface({ definition }: { definition: MediaTypePluginDefinition }) {
  const Icon = MEDIA_TYPE_ICONS[definition.type];
  return <MediaLibraryView mediaType={definition.type} title={definition.label} icon={Icon} />;
}

export function mediaTypePlugin(definition: MediaTypePluginDefinition, order: number): PluginModule {
  function FocusedMediaView() {
    return <MediaTypeSurface definition={definition} />;
  }

  return {
    activate(ctx) {
      ctx.addView({
        id: definition.pluginId,
        label: definition.label,
        icon: MEDIA_TYPE_ICONS[definition.type],
        order,
        mode: 'media',
        section: definition.family,
        component: FocusedMediaView,
      });
    },
  };
}
