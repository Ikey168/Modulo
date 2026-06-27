export type ExportFormat = 'markdown' | 'html' | 'zip';

export const exportApi = {
  markdownUrl(noteId: number, resolveLinks = false) {
    return `/api/notes/${noteId}/export/markdown?resolveLinks=${resolveLinks}`;
  },

  htmlUrl(noteId: number, resolveLinks = false) {
    return `/api/notes/${noteId}/export/html?resolveLinks=${resolveLinks}`;
  },

  zipUrl(ids?: number[], resolveLinks = false) {
    const params = new URLSearchParams();
    if (ids?.length) ids.forEach(id => params.append('ids', String(id)));
    params.set('resolveLinks', String(resolveLinks));
    return `/api/notes/export/zip?${params}`;
  },

  async downloadMarkdown(noteId: number, resolveLinks = false): Promise<void> {
    const url = exportApi.markdownUrl(noteId, resolveLinks);
    const a = document.createElement('a');
    a.href = url;
    a.click();
  },

  async openHtmlForPrint(noteId: number, resolveLinks = false): Promise<void> {
    const url = exportApi.htmlUrl(noteId, resolveLinks);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => win.print());
    }
  },

  async downloadZip(ids?: number[], resolveLinks = false): Promise<void> {
    const url = exportApi.zipUrl(ids, resolveLinks);
    const a = document.createElement('a');
    a.href = url;
    a.click();
  },
};
