import React, { useState, useEffect } from 'react';
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--color-surface, #fff)',
          borderRadius: '12px',
          padding: '24px',
          width: '520px',
          maxWidth: '95vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(0,0,0,.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Variable-fill dialog */}
        {applying ? (
          <>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Apply "{applying.name}"</h3>
            {applying.variables.length > 0 && (
              <>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)', margin: '0 0 12px' }}>
                  Fill in the template variables:
                </p>
                {applying.variables.map(v => (
                  <div key={v} style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{v}</label>
                    <input
                      value={varValues[v] ?? ''}
                      onChange={e => setVarValues(p => ({ ...p, [v]: e.target.value }))}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setApplying(null)} style={btnStyle('secondary')}>Back</button>
              <button onClick={confirmApply} style={btnStyle('primary')}>Insert template</button>
            </div>
          </>
        ) : mode === 'list' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Templates</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={openCreate} style={btnStyle('primary')}>+ New</button>
                <button onClick={onClose} style={btnStyle('secondary')}>Close</button>
              </div>
            </div>
            {templates.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)', textAlign: 'center', padding: '24px 0' }}>
                No templates yet. Create one to get started.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {templates.map(t => (
                  <li key={t.id} style={{
                    border: '1px solid var(--color-border, #e5e7eb)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{t.name}</div>
                      {t.description && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)' }}>{t.description}</div>}
                      {t.variables.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', marginTop: '4px' }}>
                          Variables: {t.variables.map(v => `{{${v}}}`).join(', ')}
                        </div>
                      )}
                    </div>
                    <button onClick={() => startApply(t)} style={btnStyle('primary')}>Use</button>
                    <button onClick={() => openEdit(t)} style={btnStyle('secondary')}>Edit</button>
                    <button onClick={() => handleDelete(t)} style={{ ...btnStyle('secondary'), color: '#ef4444' }}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>{mode === 'edit' ? 'Edit template' : 'New template'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="Name *">
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Meeting Notes" />
              </Field>
              <Field label="Description">
                <input value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} placeholder="Optional" />
              </Field>
              <Field label="Content — use {{variable}} for substitution">
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  rows={8}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                  placeholder="# {{title}}&#10;&#10;Date: {{date}}&#10;&#10;## Notes"
                />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setMode('list')} style={btnStyle('secondary')}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{ ...btnStyle('primary'), opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{label}</label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  border: '1px solid var(--color-border, #e5e7eb)',
  borderRadius: '6px',
  fontSize: '13px',
  boxSizing: 'border-box',
};

function btnStyle(type: 'primary' | 'secondary'): React.CSSProperties {
  return {
    padding: '7px 14px',
    fontSize: '13px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    background: type === 'primary' ? 'var(--color-primary, #3b82f6)' : 'var(--color-surface-raised, #f3f4f6)',
    color: type === 'primary' ? '#fff' : 'inherit',
    whiteSpace: 'nowrap',
  };
}

export default TemplateManager;
