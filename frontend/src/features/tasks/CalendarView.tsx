import React, { useState, useEffect, useMemo } from 'react';
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
      case 'URGENT': return '#dc3545';
      case 'HIGH': return '#fd7e14';
      case 'MEDIUM': return '#0d6efd';
      case 'LOW': return '#198754';
      default: return '#6c757d';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#198754';
      case 'IN_PROGRESS': return '#fd7e14';
      case 'BLOCKED': return '#dc3545';
      case 'ON_HOLD': return '#0dcaf0';
      case 'CANCELLED': return '#6c757d';
      default: return '#0d6efd';
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
      <div className="calendar-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-container">
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
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-navigation">
          <button 
            onClick={() => viewType === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
            className="nav-button"
          >
            ‹
          </button>
          
          <h2 className="calendar-title">
            {viewType === 'month' 
              ? formatMonthYear(currentDate)
              : `Week of ${formatDate(weekData[0])}`
            }
          </h2>
          
          <button 
            onClick={() => viewType === 'month' ? navigateMonth(1) : navigateWeek(1)}
            className="nav-button"
          >
            ›
          </button>
        </div>
        
        <div className="calendar-controls">
          <button onClick={goToToday} className="today-button">
            Today
          </button>
          
          <div className="view-toggle">
            <button
              onClick={() => setViewType('month')}
              className={`toggle-button ${viewType === 'month' ? 'active' : ''}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewType('week')}
              className={`toggle-button ${viewType === 'week' ? 'active' : ''}`}
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

      <div className="calendar-legend">
        <div className="legend-section">
          <span className="legend-title">Priority:</span>
          <div className="legend-items">
            {[
              { key: 'URGENT', label: 'Urgent', color: '#dc3545' },
              { key: 'HIGH', label: 'High', color: '#fd7e14' },
              { key: 'MEDIUM', label: 'Medium', color: '#0d6efd' },
              { key: 'LOW', label: 'Low', color: '#198754' }
            ].map(item => (
              <div key={item.key} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: item.color }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="legend-section">
          <span className="legend-title">Status:</span>
          <div className="legend-items">
            {[
              { key: 'TODO', label: 'To Do', color: '#0d6efd' },
              { key: 'IN_PROGRESS', label: 'In Progress', color: '#fd7e14' },
              { key: 'COMPLETED', label: 'Completed', color: '#198754' },
              { key: 'BLOCKED', label: 'Blocked', color: '#dc3545' }
            ].map(item => (
              <div key={item.key} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: item.color }}></div>
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
