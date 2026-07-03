// Embedded Databases — contributes a ```database fence renderer plus an editor
// toolbar action that inserts a starter database block. Depends on Markdown Notes.
import { Table2 } from 'lucide-react';
import { DatabaseView } from '../../DatabaseView';
import type { NoteFenceProps, PluginModule } from '../types';

function DatabaseFence({ source }: NoteFenceProps) {
  return <DatabaseView source={source} />;
}

// A unique id keeps multiple embeds in one note from colliding.
function insertStarter(insertAtCursor: (text: string) => void) {
  const id = `db-${Math.random().toString(36).slice(2, 8)}`;
  insertAtCursor(
    `\n\n\`\`\`database\nid: ${id}\ntitle: New database\ncolumns: Name:text, Status:select(Todo|In progress|Done)\n\`\`\`\n\n`,
  );
}

const databasePlugin: PluginModule = {
  activate(ctx) {
    ctx.addNoteFence({ language: 'database', component: DatabaseFence });
    ctx.addEditorAction({
      id: 'insert-database',
      label: 'Insert database',
      icon: Table2,
      run: (c) => insertStarter(c.insertAtCursor),
    });
  },
};

export default databasePlugin;
