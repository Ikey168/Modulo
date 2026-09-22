import { useEffect, useState } from 'react';
import type { LifeOsEntity } from './lifeOs';
import { authenticatedRequest } from '../../services/authenticatedRequest';
import { searchEntities, searchExcerpt } from './searchIndex';

export function useWorkspaceSearch(entities: LifeOsEntity[], query: string) {
  const [result, setResult] = useState<{ query: string; entities: LifeOsEntity[]; hits: LifeOsEntity[] }>();
  useEffect(() => {
    if (!query.trim() || !entities.length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => void (async () => {
      const documents = entities.filter(entity => entity.source !== 'Notes').flatMap(entity => {
        const body = entity.detail || entity.title;
        const chunks = [];
        for (let offset = 0; offset < body.length; offset += 6000) chunks.push({ id: `${entity.uid}#${offset}`, title: entity.title.slice(0, 1000), text: body.slice(offset, offset + 6000), entity });
        return chunks;
      });
      const hits = new Map<string, { entity: LifeOsEntity; score: number }>();
      for (let offset = 0; offset < documents.length; offset += 100) {
        const batch = documents.slice(offset, offset + 100);
        const response = await authenticatedRequest('/api/knowledge/workspace-search', { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, documents: batch.map(({ id, title, text }) => ({ id, title, text })) }) });
        if (!response.ok) throw new Error('Workspace semantic search unavailable');
        const results = await response.json() as { id: string; score: number; excerpt: string }[];
        for (const result of results) {
          const entity = batch.find(item => item.id === result.id)?.entity;
          if (entity && (!hits.has(entity.uid) || hits.get(entity.uid)!.score < result.score)) hits.set(entity.uid, { entity: { ...entity, detail: result.excerpt }, score: result.score });
        }
      }
      if (!controller.signal.aborted) setResult({ query, entities, hits: [...hits.values()].sort((a, b) => b.score - a.score).slice(0, 50).map(hit => hit.entity) });
    })().catch(() => { /* Local keyword matches remain usable while offline. */ }), 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [entities, query]);
  return result?.query === query && result.entities === entities ? result.hits : searchEntities(entities.filter(item => item.source !== 'Notes'), query, 50).map(entity => ({ ...entity, detail: searchExcerpt(entity, query) }));
}
