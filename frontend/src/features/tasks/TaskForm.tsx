import React, { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/ui';

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
  googleCalendarEventId?: string;
  syncWithGoogleCalendar?: boolean;
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2.5 text-[13px] text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">
              Title *
            </Label>
            <Input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as Task['status'] }))}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO">To Do</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">
              Priority
            </Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as Task['priority'] }))}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">
              Start Date
            </Label>
            <Input
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className="[color-scheme:dark]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueDate">
              Due Date
            </Label>
            <Input
              type="date"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              className="[color-scheme:dark]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="estimatedDurationMinutes">
              Estimated Duration
            </Label>
            <Input
              type="number"
              id="estimatedDurationMinutes"
              name="estimatedDurationMinutes"
              value={formData.estimatedDurationMinutes}
              onChange={handleInputChange}
              min="15"
              step="15"
              placeholder="Minutes"
            />
            <small className="text-xs leading-snug text-muted-foreground">
              {durationHours > 0 ? `${durationHours}h ` : ''}{durationMinutes}m
            </small>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="progressPercentage">
              Progress ({formData.progressPercentage}%)
            </Label>
            <input
              type="range"
              id="progressPercentage"
              name="progressPercentage"
              value={formData.progressPercentage}
              onChange={handleInputChange}
              className="h-9 w-full cursor-pointer accent-primary"
              min="0"
              max="100"
              step="5"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tags">
            Tags
          </Label>
          <Input
            type="text"
            id="tags"
            name="tags"
            value={formData.tags}
            onChange={handleInputChange}
            placeholder="Enter tags (comma separated)"
          />
          <small className="text-xs leading-snug text-muted-foreground">
            Separate tags with commas, e.g., "work, urgent, project-alpha"
          </small>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              name="syncWithGoogleCalendar"
              checked={formData.syncWithGoogleCalendar}
              onChange={handleInputChange}
              className="size-[18px] cursor-pointer rounded border-border-strong bg-surface-2 accent-primary"
            />
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Sync with Google Calendar
            </span>
          </label>
          <small className="text-xs leading-snug text-muted-foreground">
            Create a corresponding event in your Google Calendar
          </small>
        </div>

        {availableNotes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>
              Link to Notes
            </Label>
            <div className="max-h-[150px] overflow-y-auto rounded-md border border-border bg-surface-2 p-2">
              {availableNotes.map(note => (
                <label key={note.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-surface-3">
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.includes(note.id)}
                    onChange={(e) => handleNoteSelection(note.id, e.target.checked)}
                    className="size-[18px] cursor-pointer rounded border-border-strong bg-surface-2 accent-primary"
                  />
                  <span className="flex-1 text-[13px] text-subtle-foreground">{note.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="-mx-6 -mb-6 mt-1 flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Task' : 'Create Task')}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskForm;
