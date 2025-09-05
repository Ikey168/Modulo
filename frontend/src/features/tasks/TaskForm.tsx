import React, { useState, useEffect } from 'react';
import './TaskForm.css';

interface Task {
  id?: number;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  startDate?: string;
  estimatedDurationMinutes?: number;
  progressPercentage: number;
  tags?: string;
  syncWithGoogleCalendar: boolean;
}

interface Note {
  id: number;
  title: string;
}

interface TaskFormProps {
  task?: Task | null;
  userId: number;
  noteId?: number;
  onSubmit: (task: Task) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const TaskForm: React.FC<TaskFormProps> = ({
  task,
  userId,
  noteId,
  onSubmit,
  onCancel,
  isEditing = false
}) => {
  const [formData, setFormData] = useState<Task>({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
    startDate: '',
    estimatedDurationMinutes: 60,
    progressPercentage: 0,
    tags: '',
    syncWithGoogleCalendar: false
  });

  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        startDate: task.startDate ? task.startDate.split('T')[0] : '',
        syncWithGoogleCalendar: !!task.googleCalendarEventId
      });
    } else if (noteId) {
      setSelectedNoteIds([noteId]);
    }

    loadAvailableNotes();
  }, [task, noteId]);

  const loadAvailableNotes = async () => {
    try {
      const response = await fetch(`/api/notes?userId=${userId}`);
      if (response.ok) {
        const notes = await response.json();
        setAvailableNotes(notes || []);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? parseInt(value) || 0 : 
              value
    }));
  };

  const handleNoteSelection = (noteId: number, selected: boolean) => {
    setSelectedNoteIds(prev => 
      selected 
        ? [...prev, noteId]
        : prev.filter(id => id !== noteId)
    );
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Task title is required');
      return false;
    }

    if (formData.dueDate && formData.startDate) {
      const start = new Date(formData.startDate);
      const due = new Date(formData.dueDate);
      if (start > due) {
        setError('Start date cannot be after due date');
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const taskData = {
        ...formData,
        dueDate: formData.dueDate ? `${formData.dueDate}T00:00:00` : undefined,
        startDate: formData.startDate ? `${formData.startDate}T00:00:00` : undefined,
        userId
      };

      let response;
      if (isEditing && task?.id) {
        response = await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
      } else {
        response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        });
      }

      if (response.ok) {
        const savedTask = await response.json();

        // Link selected notes
        if (selectedNoteIds.length > 0) {
          await Promise.all(
            selectedNoteIds.map(noteId =>
              fetch(`/api/plugin/calendar-task-manager/tasks/${savedTask.id}/link-note/${noteId}`, {
                method: 'POST'
              })
            )
          );
        }

        // Sync with Google Calendar if requested
        if (formData.syncWithGoogleCalendar && !savedTask.googleCalendarEventId) {
          try {
            await fetch(`/api/plugin/calendar-task-manager/calendar/sync/${savedTask.id}`, {
              method: 'POST'
            });
          } catch (calendarErr) {
            console.warn('Failed to sync with Google Calendar:', calendarErr);
          }
        }

        onSubmit(savedTask);
      } else {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to save task');
      }
    } catch (err) {
      setError('Failed to save task: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const suggestedDuration = formData.estimatedDurationMinutes || 60;
  const durationHours = Math.floor(suggestedDuration / 60);
  const durationMinutes = suggestedDuration % 60;

  return (
    <div className="task-form-container">
      <form onSubmit={handleSubmit} className="task-form">
        <div className="form-header">
          <h2>{isEditing ? 'Edit Task' : 'Create New Task'}</h2>
          <button type="button" onClick={onCancel} className="close-button">
            ✕
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status" className="form-label">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="BLOCKED">Blocked</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority" className="form-label">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate" className="form-label">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="dueDate" className="form-label">
                Due Date
              </label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="estimatedDurationMinutes" className="form-label">
                Estimated Duration
              </label>
              <input
                type="number"
                id="estimatedDurationMinutes"
                name="estimatedDurationMinutes"
                value={formData.estimatedDurationMinutes}
                onChange={handleInputChange}
                className="form-input"
                min="15"
                step="15"
                placeholder="Minutes"
              />
              <small className="form-hint">
                {durationHours > 0 ? `${durationHours}h ` : ''}{durationMinutes}m
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="progressPercentage" className="form-label">
                Progress ({formData.progressPercentage}%)
              </label>
              <input
                type="range"
                id="progressPercentage"
                name="progressPercentage"
                value={formData.progressPercentage}
                onChange={handleInputChange}
                className="form-range"
                min="0"
                max="100"
                step="5"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="tags" className="form-label">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter tags (comma separated)"
            />
            <small className="form-hint">
              Separate tags with commas, e.g., "work, urgent, project-alpha"
            </small>
          </div>
        </div>

        <div className="form-section">
          <div className="form-group">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                name="syncWithGoogleCalendar"
                checked={formData.syncWithGoogleCalendar}
                onChange={handleInputChange}
                className="form-checkbox"
              />
              <span className="checkbox-text">
                📅 Sync with Google Calendar
              </span>
            </label>
            <small className="form-hint">
              Create a corresponding event in your Google Calendar
            </small>
          </div>
        </div>

        {availableNotes.length > 0 && (
          <div className="form-section">
            <label className="form-label">
              Link to Notes
            </label>
            <div className="notes-selection">
              {availableNotes.map(note => (
                <label key={note.id} className="note-checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.includes(note.id)}
                    onChange={(e) => handleNoteSelection(note.id, e.target.checked)}
                    className="form-checkbox"
                  />
                  <span className="note-title">{note.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="cancel-button"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Task' : 'Create Task')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
