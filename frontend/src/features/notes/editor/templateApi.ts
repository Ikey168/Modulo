export interface NoteTemplate {
  id: number;
  name: string;
  description?: string;
  content: string;
  variables: string[];
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  content: string;
  variables?: string[];
}

export const templateApi = {
  async list(userId: string): Promise<NoteTemplate[]> {
    const res = await fetch('/api/templates', { headers: { 'X-User-Id': userId } });
    if (!res.ok) throw new Error('Failed to fetch templates');
    return res.json();
  },

  async create(req: CreateTemplateRequest, userId: string): Promise<NoteTemplate> {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error('Failed to create template');
    return res.json();
  },

  async update(id: number, req: Partial<CreateTemplateRequest>, userId: string): Promise<NoteTemplate> {
    const res = await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error('Failed to update template');
    return res.json();
  },

  async delete(id: number, userId: string): Promise<void> {
    await fetch(`/api/templates/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    });
  },

  async apply(id: number, variables: Record<string, string>): Promise<{ content: string; name: string }> {
    const res = await fetch(`/api/templates/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(variables),
    });
    if (!res.ok) throw new Error('Failed to apply template');
    return res.json();
  },
};
