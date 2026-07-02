import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, Spinner, Tabs, TabsList, TabsTrigger, cn } from '@/ui';
import type { Task } from './types';
import { PRIORITY_KEYS, PRIORITY_META, STATUS_KEYS, STATUS_META, getPriorityMeta, getStatusMeta } from './taskMeta';

interface CalendarViewProps {
  userId: number;
  onTaskSelect?: (task: Task) => void;
  onDateSelect?: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Enter/Space activation for role="button" containers; ignores bubbled events from nested controls. */
const activateOnKey = (e: React.KeyboardEvent<HTMLElement>, action: () => void) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};

const toISODate = (date: Date) => date.toISOString().split('T')[0];

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
    const dateStr = toISODate(date);
    return tasks.filter(task => {
      const taskDueDate = task.dueDate?.split('T')[0];
      const taskStartDate = task.startDate?.split('T')[0];
      const taskCompletionDate = task.completionDate?.split('T')[0];

      return taskDueDate === dateStr ||
             taskStartDate === dateStr ||
             taskCompletionDate === dateStr;
    });
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

  const selectDate = (date: Date) => onDateSelect?.(toISODate(date));

  /** Compact chip used in month cells and the mobile agenda. */
  const renderTaskChip = (task: Task) => (
    <button
      key={task.id}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTaskSelect?.(task);
      }}
      title={`${task.title} - ${task.status} (${task.priority})`}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        getStatusMeta(task.status).chipClass
      )}
    >
      <span
        className={cn('size-1.5 shrink-0 rounded-full', getPriorityMeta(task.priority).dotClass)}
        aria-hidden="true"
      />
      <span className="truncate">{task.title}</span>
    </button>
  );

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
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => viewType === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
            aria-label={viewType === 'month' ? 'Previous month' : 'Previous week'}
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
            aria-label={viewType === 'month' ? 'Next month' : 'Next week'}
          >
            <ChevronRight />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button variant="secondary" onClick={goToToday}>
            Today
          </Button>

          <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'month' | 'week')}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewType === 'month' ? (
        <Card className="mb-6 overflow-hidden">
          {/* >= sm: classic 7-column month grid */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-7 border-b border-border bg-surface-2" role="row">
              {WEEKDAYS.map(day => (
                <div
                  key={day}
                  className="border-r border-border p-3 text-center text-[13px] font-semibold text-subtle-foreground last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthData.days.map((date, index) => {
                const dayTasks = getTasksForDate(date);
                return (
                  <div
                    key={index}
                    role="button"
                    tabIndex={0}
                    aria-label={date.toDateString()}
                    onClick={() => selectDate(date)}
                    onKeyDown={(e) => activateOnKey(e, () => selectDate(date))}
                    className={cn(
                      'min-h-[120px] cursor-pointer border-b border-r border-border p-2 transition-colors',
                      'hover:bg-surface-2 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      '[&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0',
                      !isCurrentMonth(date) && 'bg-background text-muted-foreground',
                      isToday(date) && 'bg-primary/10'
                    )}
                  >
                    <div className="mb-1.5 text-[13px] font-semibold">
                      {isToday(date) ? (
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {date.getDate()}
                        </span>
                      ) : (
                        date.getDate()
                      )}
                    </div>

                    {dayTasks.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {dayTasks.slice(0, 3).map(renderTaskChip)}
                        {dayTasks.length > 3 && (
                          <div className="px-1 text-center text-[11px] italic text-muted-foreground">
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

          {/* < sm: agenda-style stacked month list with visible day labels */}
          <div className="sm:hidden">
            {monthData.days.filter(isCurrentMonth).map(date => {
              const dayTasks = getTasksForDate(date);
              return (
                <div
                  key={toISODate(date)}
                  role="button"
                  tabIndex={0}
                  aria-label={date.toDateString()}
                  onClick={() => selectDate(date)}
                  onKeyDown={(e) => activateOnKey(e, () => selectDate(date))}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 border-b border-border p-3 transition-colors last:border-b-0',
                    'hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    isToday(date) && 'bg-primary/10'
                  )}
                >
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={cn('text-lg font-semibold text-foreground', isToday(date) && 'text-primary')}>
                      {date.getDate()}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                    {dayTasks.length > 0 ? (
                      dayTasks.map(renderTaskChip)
                    ) : (
                      <span className="text-xs italic text-muted-foreground">No tasks</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-sm sm:grid-cols-7">
          {weekData.map((date, index) => {
            const dayTasks = getTasksForDate(date);
            return (
              <div
                key={index}
                role="button"
                tabIndex={0}
                aria-label={date.toDateString()}
                onClick={() => selectDate(date)}
                onKeyDown={(e) => activateOnKey(e, () => selectDate(date))}
                className={cn(
                  'min-h-[160px] cursor-pointer bg-surface transition-colors sm:min-h-[400px]',
                  'hover:bg-surface-2 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isToday(date) && 'bg-primary/10'
                )}
              >
                <div className="border-b border-border bg-surface-2 p-3 text-center">
                  <div className="text-[13px] font-semibold text-muted-foreground">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={cn('mt-0.5 text-xl font-bold text-foreground', isToday(date) && 'text-primary')}>
                    {date.getDate()}
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-2">
                  {dayTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskSelect?.(task);
                      }}
                      title={`${task.title} - ${task.status} (${task.priority})`}
                      className={cn(
                        'relative flex w-full flex-col gap-0.5 overflow-hidden rounded-md border p-2 pl-3 text-left transition-all',
                        'hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        getStatusMeta(task.status).chipClass
                      )}
                    >
                      <span
                        className={cn('absolute inset-y-0 left-0 w-1', getPriorityMeta(task.priority).dotClass)}
                        aria-hidden="true"
                      />
                      <span className="truncate text-[13px] font-semibold leading-tight">{task.title}</span>
                      <span className="text-xs opacity-80">{task.progressPercentage}%</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="flex flex-col items-center justify-center gap-4 px-4 py-3 sm:flex-row sm:gap-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-[13px] font-semibold text-subtle-foreground">Priority:</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {PRIORITY_KEYS.map(key => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('size-3 rounded-sm', PRIORITY_META[key].dotClass)} aria-hidden="true" />
                <span>{PRIORITY_META[key].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-[13px] font-semibold text-subtle-foreground">Status:</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {STATUS_KEYS.map(key => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('size-3 rounded-sm', STATUS_META[key].dotClass)} aria-hidden="true" />
                <span>{STATUS_META[key].label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CalendarView;
