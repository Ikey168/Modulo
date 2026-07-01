import React, { useState, useEffect } from 'react';
import { CalendarDays, LayoutDashboard, ListTodo, Plus, RefreshCw } from 'lucide-react';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/ui';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import CalendarView from './CalendarView';

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

/** Radix SelectItem forbids value=""; sentinel mapped back to '' (= no filter) in state. */
const ALL_FILTER = 'all';

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-col gap-4 border-b border-border bg-surface px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Task Manager</h1>
          {noteId && <span className="text-sm font-normal text-muted-foreground">Linked to Note #{noteId}</span>}
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button onClick={handleCreateTask}>
            <Plus />
            New Task
          </Button>

          {!isConnectedToGoogle ? (
            <Button variant="outline" onClick={connectToGoogleCalendar}>
              <CalendarDays />
              Connect Google Calendar
            </Button>
          ) : (
            <Button variant="secondary" onClick={syncAllTasks}>
              <RefreshCw />
              Sync Calendar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-border bg-surface px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={currentView}
          onValueChange={(v) => setCurrentView(v as 'list' | 'calendar' | 'dashboard')}
        >
          <TabsList>
            <TabsTrigger value="dashboard"><LayoutDashboard />Dashboard</TabsTrigger>
            <TabsTrigger value="list"><ListTodo />Task List</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays />Calendar</TabsTrigger>
          </TabsList>
        </Tabs>

        {currentView === 'list' && (
          <div className="flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center">
            <Select
              value={taskFilters.status || ALL_FILTER}
              onValueChange={(val) => handleFilterChange({ ...taskFilters, status: val === ALL_FILTER ? '' : val })}
            >
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All Statuses</SelectItem>
                <SelectItem value="TODO">To Do</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={taskFilters.priority || ALL_FILTER}
              onValueChange={(val) => handleFilterChange({ ...taskFilters, priority: val === ALL_FILTER ? '' : val })}
            >
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER}>All Priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-subtle-foreground">
              <input
                type="checkbox"
                checked={taskFilters.showOverdue}
                onChange={(e) => handleFilterChange({ ...taskFilters, showOverdue: e.target.checked })}
                className="size-4 cursor-pointer rounded border-border-strong bg-surface-2 accent-primary"
              />
              Overdue Only
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-subtle-foreground">
              <input
                type="checkbox"
                checked={taskFilters.showDueToday}
                onChange={(e) => handleFilterChange({ ...taskFilters, showDueToday: e.target.checked })}
                className="size-4 cursor-pointer rounded border-border-strong bg-surface-2 accent-primary"
              />
              Due Today Only
            </label>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {currentView === 'dashboard' && (
          <div className="mx-auto max-w-[1200px] p-8 animate-fade-in">
            <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border border-l-4 border-l-primary bg-surface p-8 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-2 text-4xl font-bold text-foreground">{stats.totalTasks}</div>
                <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Tasks</div>
              </div>

              <div className="rounded-lg border border-border border-l-4 border-l-success bg-surface p-8 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-2 text-4xl font-bold text-foreground">{stats.completedTasks}</div>
                <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Completed</div>
              </div>

              <div className="rounded-lg border border-border border-l-4 border-l-destructive bg-surface p-8 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-2 text-4xl font-bold text-foreground">{stats.overdueTasks}</div>
                <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Overdue</div>
              </div>

              <div className="rounded-lg border border-border border-l-4 border-l-warning bg-surface p-8 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-2 text-4xl font-bold text-foreground">{stats.dueTodayTasks}</div>
                <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Due Today</div>
              </div>
            </div>

            <div className="mb-8 rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
              <h3 className="mb-6 text-xl font-semibold text-foreground">Completion Rate</h3>
              <div
                className="relative mx-auto size-[150px] rounded-full"
                style={{
                  background: `conic-gradient(hsl(var(--success)) ${stats.completionRate * 3.6}deg, hsl(var(--surface-3)) 0deg)`
                }}
              >
                <div className="absolute left-1/2 top-1/2 flex size-[100px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-2 shadow-md">
                  <span className="text-2xl font-bold text-foreground">{Math.round(stats.completionRate)}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
              <h3 className="mb-6 text-xl font-semibold text-foreground">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setTaskFilters({ ...taskFilters, showOverdue: true });
                    setCurrentView('list');
                  }}
                  disabled={stats.overdueTasks === 0}
                  className="border-destructive/60 text-destructive hover:bg-destructive/15 hover:text-destructive"
                >
                  View Overdue ({stats.overdueTasks})
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setTaskFilters({ ...taskFilters, showDueToday: true });
                    setCurrentView('list');
                  }}
                  disabled={stats.dueTodayTasks === 0}
                  className="border-warning/60 text-warning hover:bg-warning/15 hover:text-warning"
                >
                  View Due Today ({stats.dueTodayTasks})
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setCurrentView('calendar')}
                  className="border-info/60 text-info hover:bg-info/15 hover:text-info"
                >
                  View Calendar
                </Button>
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
