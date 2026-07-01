import React, { useState, useEffect } from 'react';
import { CalendarDays, Check, Link2, Rocket, Trash2 } from 'lucide-react';
import { Badge, Button, EmptyState, Spinner, cn, type BadgeProps } from '@/ui';

interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  startDate?: string;
  completionDate?: string;
  estimatedDurationMinutes?: number;
  progressPercentage: number;
  isOverdue?: boolean;
  isDueToday?: boolean;
  linkedNotes?: any[];
  tags?: string;
  googleCalendarEventId?: string;
}

interface TaskListProps {
  userId: number;
  noteId?: number;
  filters?: {
    status?: string;
    priority?: string;
    showOverdue?: boolean;
    showDueToday?: boolean;
  };
  onTaskUpdate?: (task: Task) => void;
  onTaskSelect?: (task: Task) => void;
}

const TaskList: React.FC<TaskListProps> = ({
  userId,
  noteId,
  filters = {},
  onTaskUpdate,
  onTaskSelect
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadTasks();
  }, [userId, noteId, filters]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/tasks';
      const params = new URLSearchParams({ userId: userId.toString() });

      if (noteId) {
        url = `/api/tasks/note/${noteId}`;
      } else {
        if (filters.status) params.append('status', filters.status);
        if (filters.priority) params.append('priority', filters.priority);
        if (filters.showOverdue) url = '/api/tasks/overdue';
        else if (filters.showDueToday) url = '/api/tasks/due-today';
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTasks(data || []);
      } else {
        throw new Error('Failed to load tasks');
      }
    } catch (err) {
      setError('Failed to load tasks: ' + (err as Error).message);
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskProgress = async (taskId: number, progressPercentage: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressPercentage })
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(prev => prev.map(task =>
          task.id === taskId ? updatedTask : task
        ));
        onTaskUpdate?.(updatedTask);
      } else {
        throw new Error('Failed to update task progress');
      }
    } catch (err) {
      setError('Failed to update progress: ' + (err as Error).message);
    }
  };

  const completeTask = async (taskId: number) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'PUT'
      });

      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(prev => prev.map(task =>
          task.id === taskId ? updatedTask : task
        ));
        onTaskUpdate?.(updatedTask);
      } else {
        throw new Error('Failed to complete task');
      }
    } catch (err) {
      setError('Failed to complete task: ' + (err as Error).message);
    }
  };

  const deleteTask = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTasks(prev => prev.filter(task => task.id !== taskId));
      } else {
        throw new Error('Failed to delete task');
      }
    } catch (err) {
      setError('Failed to delete task: ' + (err as Error).message);
    }
  };

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const getStatusBadgeVariant = (status: string): BadgeProps['variant'] => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'IN_PROGRESS': return 'warning';
      case 'BLOCKED': return 'destructive';
      case 'ON_HOLD': return 'info';
      case 'CANCELLED': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityBadgeVariant = (priority: string): BadgeProps['variant'] => {
    switch (priority) {
      case 'URGENT': return 'destructive';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      case 'LOW': return 'success';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-[1200px] bg-background p-4">
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <Spinner className="size-10 text-primary" />
          <p className="text-[13px] text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto min-h-screen max-w-[1200px] bg-background p-4">
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={loadTasks}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[1200px] bg-background p-4">
      {tasks.length === 0 ? (
        <EmptyState
          icon={<span className="text-3xl">📋</span>}
          title="No tasks found"
          description={
            noteId
              ? 'No tasks are linked to this note yet.'
              : 'Create your first task to get started!'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map(task => {
            const isCompleted = task.status === 'COMPLETED';
            return (
            <div
              key={task.id}
              className={cn(
                'cursor-pointer rounded-lg border border-border bg-surface p-4 shadow-sm transition-all',
                'hover:border-border-strong hover:bg-surface-2 hover:shadow-md',
                selectedTasks.has(task.id) && 'border-primary ring-2 ring-primary/30',
                isCompleted && 'opacity-70',
                task.status === 'BLOCKED' && 'border-l-4 border-l-destructive',
                task.status === 'ON_HOLD' && 'border-l-4 border-l-warning'
              )}
              onClick={() => onTaskSelect?.(task)}
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleTaskSelection(task.id);
                    }}
                    className="size-[18px] cursor-pointer rounded border-border-strong bg-surface-2 accent-primary"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="mb-1 text-[17px] font-semibold leading-tight text-foreground">{task.title}</h4>
                  {task.description && (
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{task.description}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row">
                  <Badge variant={getPriorityBadgeVariant(task.priority)} className="uppercase tracking-wide">
                    {task.priority}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(task.status)} className="uppercase tracking-wide">
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-2 flex flex-wrap gap-4">
                  {task.dueDate && (
                    <span
                      className={cn(
                        'flex items-center gap-1.5 text-[13px] text-muted-foreground',
                        task.isOverdue && 'font-semibold text-destructive',
                        task.isDueToday && 'font-semibold text-warning'
                      )}
                    >
                      <CalendarDays className="size-3.5" /> Due: {formatDate(task.dueDate)}
                    </span>
                  )}
                  {task.startDate && (
                    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Rocket className="size-3.5" /> Start: {formatDate(task.startDate)}
                    </span>
                  )}
                </div>

                {task.progressPercentage > 0 && (
                  <div className="my-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${task.progressPercentage}%` }}
                      ></div>
                    </div>
                    <span className="min-w-[40px] text-right text-xs font-semibold text-muted-foreground">{task.progressPercentage}%</span>
                  </div>
                )}

                {task.linkedNotes && task.linkedNotes.length > 0 && (
                  <div className="my-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Link2 className="size-4" />
                    <span>
                      {task.linkedNotes.length} linked note{task.linkedNotes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {task.googleCalendarEventId && (
                  <div className="my-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                    <CalendarDays className="size-4" />
                    <span>Synced with Google Calendar</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                {task.status !== 'COMPLETED' && (
                  <>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={task.progressPercentage}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateTaskProgress(task.id, parseInt(e.target.value));
                      }}
                      className="max-w-[150px] flex-1 cursor-pointer accent-primary"
                      title="Update progress"
                    />

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        completeTask(task.id);
                      }}
                      className="text-success hover:bg-success/15 hover:text-success"
                      title="Mark as complete"
                    >
                      <Check />
                    </Button>
                  </>
                )}

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTask(task.id);
                  }}
                  className="text-destructive hover:bg-destructive/15 hover:text-destructive"
                  title="Delete task"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TaskList;
