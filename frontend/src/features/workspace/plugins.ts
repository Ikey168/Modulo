// Sample marketplace catalogue. The plugin store is not yet wired to a backend
// endpoint, so this list is static and install state is kept client-side.
export interface PluginInfo {
  id: string;
  name: string;
  author: string;
  desc: string;
  category: string;
  downloads: string;
  rating: string;
  icon: string;
}

export const PLUGINS: PluginInfo[] = [
  { id: 'latex', name: 'LaTeX Math', author: 'Modulo Labs', desc: 'Render mathematical equations inline and in blocks using KaTeX.', category: 'render', downloads: '12.4k', rating: '4.8', icon: 'Σ' },
  { id: 'ai-summary', name: 'AI Summarizer', author: 'OpenMind', desc: 'Generate concise note summaries powered by GPT-4.', category: 'ai', downloads: '8.9k', rating: '4.6', icon: '✦' },
  { id: 'github-sync', name: 'GitHub Sync', author: 'devmode', desc: 'Automatically back up and sync your notes to a GitHub repository.', category: 'sync', downloads: '15.2k', rating: '4.9', icon: 'G' },
  { id: 'mermaid', name: 'Mermaid Diagrams', author: 'Modulo Labs', desc: 'Create flowcharts and sequence diagrams using Mermaid syntax.', category: 'render', downloads: '6.7k', rating: '4.5', icon: '⬡' },
  { id: 'pdf-export', name: 'PDF Export', author: 'paperworks', desc: 'Export individual notes or entire notebooks as formatted PDF documents.', category: 'export', downloads: '9.1k', rating: '4.3', icon: '⬇' },
  { id: 'graph-stats', name: 'Graph Analytics', author: 'nodelab', desc: 'Advanced graph analytics: centrality scores, cluster detection, and more.', category: 'analytics', downloads: '3.2k', rating: '4.7', icon: '◎' },
  { id: 'web3-id', name: 'Web3 Identity', author: 'Modulo Labs', desc: 'Sign notes with your Ethereum wallet for verifiable on-chain authorship.', category: 'web3', downloads: '4.5k', rating: '4.4', icon: 'Ξ' },
  { id: 'focus', name: 'Focus Timer', author: 'deepwork', desc: 'Built-in Pomodoro timer that logs focus sessions linked to your notes.', category: 'productivity', downloads: '7.8k', rating: '4.2', icon: '◷' },
];
