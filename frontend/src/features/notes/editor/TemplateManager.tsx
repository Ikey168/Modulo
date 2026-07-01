import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Button, Input, Textarea, Label, EmptyState } from '@/ui';
import { NoteTemplate, templateApi, CreateTemplateRequest } from './templateApi';

interface Props {
  userId: string;
  onApply: (content: string) => void;
  onClose: () => void;
}

const TemplateManager: React.FC<Props> = ({ userId, onApply, onClose }) => {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<NoteTemplate | null>(null);
  const [form, setForm] = useState<CreateTemplateRequest>({ name: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<NoteTemplate | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setTemplates(await templateApi.list(userId));
    } catch {
      // ignore
    }
  };

  useEffect(() => { load(); }, [userId]);

  const openCreate = () => {
    setForm({ name: '', description: '', content: '' });
    setEditing(null);
    setMode('create');
  };

  const openEdit = (t: NoteTemplate) => {
    setForm({ name: t.name, description: t.description, content: t.content, variables: t.variables });
    setEditing(t);
    setMode('edit');
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (mode === 'edit' && editing) {
        await templateApi.update(editing.id, form, userId);
      } else {
        await templateApi.create(form, userId);
      }
      await load();
      setMode('list');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: NoteTemplate) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await templateApi.delete(t.id, userId);
    setTemplates(prev => prev.filter(x => x.id !== t.id));
  };

  const startApply = (t: NoteTemplate) => {
    setApplying(t);
    const initial: Record<string, string> = {};
    t.variables.forEach(v => { initial[v] = ''; });
    setVarValues(initial);
  };

  const confirmApply = async () => {
    if (!applying) return;
    try {
      const result = await templateApi.apply(applying.id, varValues);
      onApply(result.content);
      onClose();
    } catch {
      // ignore
    }
  };

  // --- Variable-fill dialog ---
  if (applying) {
    return (
      <Modal
        open
        onClose={onClose}
        title={`Apply "${applying.name}"`}
        className="max-w-[520px]"
        footer={
          <>
            <Button onClick={() => setApplying(null)} variant="secondary">Back</Button>
            <Button onClick={confirmApply}>Insert template</Button>
          </>
        }
      >
        {applying.variables.length > 0 && (
          <>
            <p className="mb-3 mt-0 text-[13px] text-muted-foreground">
              Fill in the template variables:
            </p>
            <div className="flex flex-col gap-2.5">
              {applying.variables.map(v => (
                <div key={v}>
                  <Label className="mb-1 block">{v}</Label>
                  <Input
                    value={varValues[v] ?? ''}
                    onChange={e => setVarValues(p => ({ ...p, [v]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    );
  }

  // --- List view ---
  if (mode === 'list') {
    return (
      <Modal
        open
        onClose={onClose}
        title="Templates"
        className="max-w-[520px]"
        footer={
          <>
            <Button onClick={openCreate}>
              <Plus />
              New
            </Button>
            <Button onClick={onClose} variant="secondary">Close</Button>
          </>
        }
      >
        {templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            description="Create one to get started."
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {templates.map(t => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  {t.variables.length > 0 && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Variables: {t.variables.map(v => `{{${v}}}`).join(', ')}
                    </div>
                  )}
                </div>
                <Button onClick={() => startApply(t)} size="sm">Use</Button>
                <Button onClick={() => openEdit(t)} size="sm" variant="secondary">Edit</Button>
                <Button
                  onClick={() => handleDelete(t)}
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  title="Delete template"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    );
  }

  // --- Create / edit view ---
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'edit' ? 'Edit template' : 'New template'}
      className="max-w-[520px]"
      footer={
        <>
          <Button onClick={() => setMode('list')} variant="secondary">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()} loading={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Name *">
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Meeting Notes" />
        </Field>
        <Field label="Description">
          <Input value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" />
        </Field>
        <Field label="Content — use {{variable}} for substitution">
          <Textarea
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            rows={8}
            className="font-mono text-xs"
            placeholder="# {{title}}&#10;&#10;Date: {{date}}&#10;&#10;## Notes"
          />
        </Field>
      </div>
    </Modal>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <Label className="mb-1 block">{label}</Label>
    {children}
  </div>
);

export default TemplateManager;
