import React, { useState, useEffect } from 'react';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import CalendarView from './CalendarView';
import './TaskManager.css';

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
  syncWithGoogleCalendar?: boolean;
}

interface TaskStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  completionRate: number;
}

interface TaskManagerProps {
  userId: number;
  noteId?: number;
  initialView?: 'list' | 'calendar';
}

const TaskManager: React.FC<TaskManagerProps> = ({
  userId,
  noteId,
  initialView = 'list'
}) => {
  const [currentView, setCurrentView] = useState<'list' | 'calendar' | 'dashboard'>(initialView);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFilters, setTaskFilters] = useState({
    status: '',
    priority: '',
    showOverdue: false,
    showDueToday: false
  });
  const [stats, setStats] = useState<TaskStats>({
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    dueTodayTasks: 0,
    completionRate: 0
  });
  const [isConnectedToGoogle, setIsConnectedToGoogle] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadStats();
    checkGoogleCalendarConnection();
  }, [userId, refreshKey]);

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/tasks/stats?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load task statistics:', err);
    }
  };

  const checkGoogleCalendarConnection = async () => {
    try {
      const response = await fetch(`/api/plugin/calendar-task-manager/calendar/status?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setIsConnectedToGoogle(data.connected || false);
      }
    } catch (err) {
      console.error('Failed to check Google Calendar connection:', err);
    }
  };

  const handleTaskSubmit = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleTaskSelect = (task: Task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleCloseTaskForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleTaskUpdate = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleFilterChange = (newFilters: typeof taskFilters) => {
    setTaskFilters(newFilters);
  };

  const connectToGoogleCalendar = async () => {
    try {
      const response = await fetch(`/api/plugin/calendar-task-manager/calendar/oauth-url?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        
        // Check connection status after a delay
        setTimeout(() => {
          checkGoogleCalendarConnection();
        }, 5000);
      }
    } catch (err) {
      console.error('Failed to initiate Google Calendar connection:', err);
    }
  };

  const syncAllTasks = async () => {
    try {
      await fetch(`/api/plugin/calendar-task-manager/calendar/sync-all?userId=${userId}`, {
        method: 'POST'
      });
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Failed to sync tasks with Google Calendar:', err);
    }
  };

  return (
    <div className="task-manager">
      <div className="task-manager-header">
        <div className="header-title">
          <h1>Task Manager</h1>
          {noteId && <span className="note-context">Linked to Note #{noteId}</span>}
        </div>
        
        <div className="header-actions">
          <button
            onClick={handleCreateTask}
            className="create-task-button primary-button"
          >
            ➕ New Task
          </button>
          
          {!isConnectedToGoogle ? (
            <button
              onClick={connectToGoogleCalendar}
              className="google-connect-button"
            >
              📅 Connect Google Calendar
            </button>
          ) : (
            <button
              onClick={syncAllTasks}
              className="sync-button"
            >
              🔄 Sync Calendar
            </button>
          )}
        </div>
      </div>

      <div className="task-manager-nav">
        <div className="view-tabs">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`tab-button ${currentView === 'dashboard' ? 'active' : ''}`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setCurrentView('list')}
            className={`tab-button ${currentView === 'list' ? 'active' : ''}`}
          >
            📋 Task List
          </button>
          <button
            onClick={() => setCurrentView('calendar')}
            className={`tab-button ${currentView === 'calendar' ? 'active' : ''}`}
          >
            📅 Calendar
          </button>
        </div>

        {currentView === 'list' && (
          <div className="task-filters">
            <select
              value={taskFilters.status}
              onChange={(e) => handleFilterChange({ ...taskFilters, status: e.target.value })}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={taskFilters.priority}
              onChange={(e) => handleFilterChange({ ...taskFilters, priority: e.target.value })}
              className="filter-select"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={taskFilters.showOverdue}
                onChange={(e) => handleFilterChange({ ...taskFilters, showOverdue: e.target.checked })}
              />
              Overdue Only
            </label>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={taskFilters.showDueToday}
                onChange={(e) => handleFilterChange({ ...taskFilters, showDueToday: e.target.checked })}
              />
              Due Today Only
            </label>
          </div>
        )}
      </div>

      <div className="task-manager-content">
        {currentView === 'dashboard' && (
          <div className="dashboard">
            <div className="stats-grid">
              <div className="stat-card total">
                <div className="stat-number">{stats.totalTasks}</div>
                <div className="stat-label">Total Tasks</div>
              </div>
              
              <div className="stat-card completed">
                <div className="stat-number">{stats.completedTasks}</div>
                <div className="stat-label">Completed</div>
              </div>
              
              <div className="stat-card overdue">
                <div className="stat-number">{stats.overdueTasks}</div>
                <div className="stat-label">Overdue</div>
              </div>
              
              <div className="stat-card due-today">
                <div className="stat-number">{stats.dueTodayTasks}</div>
                <div className="stat-label">Due Today</div>
              </div>
            </div>

            <div className="completion-rate">
              <h3>Completion Rate</h3>
              <div className="progress-circle">
                <div 
                  className="progress-fill" 
                  style={{
                    background: `conic-gradient(var(--success-color, #28a745) ${stats.completionRate * 3.6}deg, var(--light-gray, #e9ecef) 0deg)`
                  }}
                >
                  <div className="progress-center">
                    <span className="percentage">{Math.round(stats.completionRate)}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button
                  onClick={() => {
                    setTaskFilters({ ...taskFilters, showOverdue: true });
                    setCurrentView('list');
                  }}
                  className="action-button overdue"
                  disabled={stats.overdueTasks === 0}
                >
                  View Overdue ({stats.overdueTasks})
                </button>
                
                <button
                  onClick={() => {
                    setTaskFilters({ ...taskFilters, showDueToday: true });
                    setCurrentView('list');
                  }}
                  className="action-button due-today"
                  disabled={stats.dueTodayTasks === 0}
                >
                  View Due Today ({stats.dueTodayTasks})
                </button>
                
                <button
                  onClick={() => setCurrentView('calendar')}
                  className="action-button calendar"
                >
                  View Calendar
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'list' && (
          <TaskList
            key={refreshKey}
            userId={userId}
            noteId={noteId}
            filters={taskFilters}
            onTaskUpdate={handleTaskUpdate}
            onTaskSelect={handleTaskSelect}
          />
        )}

        {currentView === 'calendar' && (
          <CalendarView
            key={refreshKey}
            userId={userId}
            onTaskSelect={handleTaskSelect}
            onDateSelect={(date) => {
              console.log('Selected date:', date);
              // Could implement creating task for specific date
            }}
          />
        )}
      </div>

      {showTaskForm && (
        <TaskForm
          task={editingTask}
          userId={userId}
          noteId={noteId}
          onSubmit={handleTaskSubmit}
          onCancel={handleCloseTaskForm}
          isEditing={!!editingTask}
        />
      )}
    </div>
  );
};

export default TaskManager;
