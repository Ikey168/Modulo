import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Spinner, cn } from '@/ui';
import './CalendarView.css';

interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'BLOCKED' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  startDate?: string;
  completionDate?: string;
  progressPercentage: number;
  isOverdue?: boolean;
  isDueToday?: boolean;
}

interface CalendarViewProps {
  userId: number;
  onTaskSelect?: (task: Task) => void;
  onDateSelect?: (date: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  userId,
  onTaskSelect,
  onDateSelect
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'month' | 'week'>('month');

  useEffect(() => {
    loadTasks();
  }, [userId, currentDate]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];

      const response = await fetch(
        `/api/tasks/date-range?userId=${userId}&startDate=${startDate}&endDate=${endDate}`
      );

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

  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const currentDay = new Date(startDate);

    while (days.length < 42) { // 6 weeks * 7 days
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return {
      year,
      month,
      firstDay,
      lastDay,
      days
    };
  }, [currentDate]);

  const weekData = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days = [];
    const currentDay = new Date(startOfWeek);

    for (let i = 0; i < 7; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(task => {
      const taskDueDate = task.dueDate?.split('T')[0];
      const taskStartDate = task.startDate?.split('T')[0];
      const taskCompletionDate = task.completionDate?.split('T')[0];

      return taskDueDate === dateStr ||
             taskStartDate === dateStr ||
             taskCompletionDate === dateStr;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return '#ef4444';
      case 'HIGH': return '#f59e0b';
      case 'MEDIUM': return '#3b82f6';
      case 'LOW': return '#22c55e';
      default: return '#71717a';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#22c55e';
      case 'IN_PROGRESS': return '#f59e0b';
      case 'BLOCKED': return '#ef4444';
      case 'ON_HOLD': return '#0ea5e9';
      case 'CANCELLED': return '#71717a';
      default: return '#4f46e5';
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const navigateWeek = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction * 7));
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] bg-background p-4">
        <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
          <Spinner className="size-10 text-primary" />
          <p className="text-[13px] text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] bg-background p-4">
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
    <div className="mx-auto max-w-[1400px] bg-background p-4">
      <div className="mb-8 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => viewType === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
            aria-label="Previous"
          >
            <ChevronLeft />
          </Button>

          <h2 className="min-w-[250px] text-center text-2xl font-semibold text-foreground">
            {viewType === 'month'
              ? formatMonthYear(currentDate)
              : `Week of ${formatDate(weekData[0])}`
            }
          </h2>

          <Button
            variant="outline"
            size="icon"
            onClick={() => viewType === 'month' ? navigateMonth(1) : navigateWeek(1)}
            aria-label="Next"
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" onClick={goToToday}>
            Today
          </Button>

          <div className="inline-flex overflow-hidden rounded-md border border-border-strong">
            <button
              onClick={() => setViewType('month')}
              className={cn(
                'px-4 py-2 text-[13px] font-medium transition-colors',
                viewType === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-2 text-subtle-foreground hover:bg-surface-3'
              )}
            >
              Month
            </button>
            <button
              onClick={() => setViewType('week')}
              className={cn(
                'px-4 py-2 text-[13px] font-medium transition-colors',
                viewType === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-2 text-subtle-foreground hover:bg-surface-3'
              )}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {viewType === 'month' ? (
        <div className="calendar-grid month-view">
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="weekday-header">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-days">
            {monthData.days.map((date, index) => {
              const dayTasks = getTasksForDate(date);
              return (
                <div
                  key={index}
                  className={`calendar-day ${!isCurrentMonth(date) ? 'other-month' : ''} ${isToday(date) ? 'today' : ''}`}
                  onClick={() => onDateSelect?.(date.toISOString().split('T')[0])}
                >
                  <div className="day-number">
                    {date.getDate()}
                  </div>

                  {dayTasks.length > 0 && (
                    <div className="day-tasks">
                      {dayTasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          className="task-dot"
                          style={{
                            backgroundColor: getStatusColor(task.status),
                            borderLeft: `3px solid ${getPriorityColor(task.priority)}`
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskSelect?.(task);
                          }}
                          title={`${task.title} - ${task.status} (${task.priority})`}
                        >
                          <span className="task-title-snippet">
                            {task.title.length > 15 ? `${task.title.substring(0, 15)}...` : task.title}
                          </span>
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="more-tasks">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="calendar-grid week-view">
          {weekData.map((date, index) => {
            const dayTasks = getTasksForDate(date);
            return (
              <div
                key={index}
                className={`week-day ${isToday(date) ? 'today' : ''}`}
                onClick={() => onDateSelect?.(date.toISOString().split('T')[0])}
              >
                <div className="week-day-header">
                  <div className="day-name">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="day-number">
                    {date.getDate()}
                  </div>
                </div>

                <div className="week-day-tasks">
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      className="week-task"
                      style={{ backgroundColor: getStatusColor(task.status) }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskSelect?.(task);
                      }}
                    >
                      <div className="task-priority-indicator"
                           style={{ backgroundColor: getPriorityColor(task.priority) }}>
                      </div>
                      <div className="task-content">
                        <div className="task-title">{task.title}</div>
                        <div className="task-progress">
                          {task.progressPercentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-6 flex flex-col items-center justify-center gap-4 rounded-md border border-border bg-surface px-4 py-3 sm:flex-row sm:gap-8">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-subtle-foreground">Priority:</span>
          <div className="flex gap-4">
            {[
              { key: 'URGENT', label: 'Urgent', color: '#ef4444' },
              { key: 'HIGH', label: 'High', color: '#f59e0b' },
              { key: 'MEDIUM', label: 'Medium', color: '#3b82f6' },
              { key: 'LOW', label: 'Low', color: '#22c55e' }
            ].map(item => (
              <div key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="size-3 rounded-sm" style={{ backgroundColor: item.color }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-subtle-foreground">Status:</span>
          <div className="flex gap-4">
            {[
              { key: 'TODO', label: 'To Do', color: '#4f46e5' },
              { key: 'IN_PROGRESS', label: 'In Progress', color: '#f59e0b' },
              { key: 'COMPLETED', label: 'Completed', color: '#22c55e' },
              { key: 'BLOCKED', label: 'Blocked', color: '#ef4444' }
            ].map(item => (
              <div key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="size-3 rounded-sm" style={{ backgroundColor: item.color }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
