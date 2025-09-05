import React, { useState, useEffect } from 'react';
import './TaskList.css';

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

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'var(--success-color, #4CAF50)';
      case 'IN_PROGRESS': return 'var(--warning-color, #FF9800)';
      case 'BLOCKED': return 'var(--error-color, #F44336)';
      case 'ON_HOLD': return 'var(--info-color, #2196F3)';
      case 'CANCELLED': return 'var(--disabled-color, #9E9E9E)';
      default: return 'var(--secondary-color, #6c757d)';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return '#F44336';
      case 'HIGH': return '#FF9800';
      case 'MEDIUM': return '#2196F3';
      case 'LOW': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="task-list-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="task-list-container">
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button onClick={loadTasks} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-list-container">
      {tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No tasks found</h3>
          <p>
            {noteId 
              ? "No tasks are linked to this note yet."
              : "Create your first task to get started!"}
          </p>
        </div>
      ) : (
        <div className="task-list">
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`task-item ${task.status.toLowerCase()} ${selectedTasks.has(task.id) ? 'selected' : ''}`}
              onClick={() => onTaskSelect?.(task)}
            >
              <div className="task-header">
                <div className="task-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(task.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleTaskSelection(task.id);
                    }}
                  />
                </div>
                
                <div className="task-title-section">
                  <h4 className="task-title">{task.title}</h4>
                  {task.description && (
                    <p className="task-description">{task.description}</p>
                  )}
                </div>

                <div className="task-badges">
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  >
                    {task.priority}
                  </span>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getTaskStatusColor(task.status) }}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="task-details">
                <div className="task-dates">
                  {task.dueDate && (
                    <span className={`due-date ${task.isOverdue ? 'overdue' : ''} ${task.isDueToday ? 'due-today' : ''}`}>
                      📅 Due: {formatDate(task.dueDate)}
                    </span>
                  )}
                  {task.startDate && (
                    <span className="start-date">
                      🚀 Start: {formatDate(task.startDate)}
                    </span>
                  )}
                </div>

                {task.progressPercentage > 0 && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${task.progressPercentage}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">{task.progressPercentage}%</span>
                  </div>
                )}

                {task.linkedNotes && task.linkedNotes.length > 0 && (
                  <div className="linked-notes">
                    <span className="linked-notes-icon">🔗</span>
                    <span className="linked-notes-count">
                      {task.linkedNotes.length} linked note{task.linkedNotes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {task.googleCalendarEventId && (
                  <div className="calendar-sync">
                    <span className="calendar-icon">📅</span>
                    <span>Synced with Google Calendar</span>
                  </div>
                )}
              </div>

              <div className="task-actions">
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
                      className="progress-slider"
                      title="Update progress"
                    />
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        completeTask(task.id);
                      }}
                      className="complete-button"
                      title="Mark as complete"
                    >
                      ✅
                    </button>
                  </>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTask(task.id);
                  }}
                  className="delete-button"
                  title="Delete task"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskList;
