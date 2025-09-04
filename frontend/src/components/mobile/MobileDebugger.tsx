import React, { useState, useEffect, useRef } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { performanceUtils } from '../../hooks/useMobilePerformance';
import { MobileOptimizedButton } from './MobileOptimizedButton';
import './MobileDebugger.css';

interface DebugLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

interface Props {
  className?: string;
  maxLogs?: number;
  autoScroll?: boolean;
  showFloatingButton?: boolean;
}

export const MobileDebugger: React.FC<Props> = ({
  className = '',
  maxLogs = 100,
  autoScroll = true,
  showFloatingButton = true
}) => {
  const { isMobile, deviceType, breakpoint } = useResponsive();
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);
  const originalConsole = useRef<Console>();

  // Intercept console methods for mobile debugging
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store original console methods
    originalConsole.current = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    } as Console;

    const addLog = (level: DebugLog['level'], category: string, args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      const log: DebugLog = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        level,
        category,
        message,
        data: args.length === 1 && typeof args[0] === 'object' ? args[0] : args
      };

      setLogs(prevLogs => {
        const newLogs = [...prevLogs, log];
        return newLogs.slice(-maxLogs);
      });
    };

    // Override console methods
    console.log = (...args) => {
      originalConsole.current?.log(...args);
      addLog('info', 'Console', args);
    };

    console.warn = (...args) => {
      originalConsole.current?.warn(...args);
      addLog('warn', 'Console', args);
    };

    console.error = (...args) => {
      originalConsole.current?.error(...args);
      addLog('error', 'Console', args);
    };

    console.info = (...args) => {
      originalConsole.current?.info(...args);
      addLog('info', 'Console', args);
    };

    console.debug = (...args) => {
      originalConsole.current?.debug(...args);
      addLog('debug', 'Console', args);
    };

    // Listen for unhandled errors
    const handleError = (event: ErrorEvent) => {
      addLog('error', 'Runtime', [event.message, `${event.filename}:${event.lineno}:${event.colno}`]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog('error', 'Promise', [event.reason]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      if (originalConsole.current) {
        console.log = originalConsole.current.log;
        console.warn = originalConsole.current.warn;
        console.error = originalConsole.current.error;
        console.info = originalConsole.current.info;
        console.debug = originalConsole.current.debug;
      }
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [maxLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter || log.category.toLowerCase() === filter.toLowerCase();
    const matchesSearch = !searchTerm || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // Debug utilities
  const debugUtils = {
    // Log device information
    logDeviceInfo: () => {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth
        },
        devicePixelRatio: window.devicePixelRatio,
        connection: (navigator as any).connection,
        responsive: {
          isMobile,
          deviceType,
          breakpoint
        }
      };
      
      console.info('Device Information:', deviceInfo);
    },

    // Log performance information
    logPerformanceInfo: () => {
      const performanceInfo = {
        navigation: performance.getEntriesByType('navigation'),
        resources: performance.getEntriesByType('resource').slice(0, 10), // First 10 resources
        measures: performance.getEntriesByType('measure'),
        marks: performance.getEntriesByType('mark'),
        memory: (performance as any).memory,
        timing: performance.timing
      };
      
      console.info('Performance Information:', performanceInfo);
    },

    // Log DOM information
    logDOMInfo: () => {
      const domInfo = {
        documentReady: document.readyState,
        elementCount: document.getElementsByTagName('*').length,
        scriptCount: document.scripts.length,
        linkCount: document.links.length,
        imageCount: document.images.length,
        formCount: document.forms.length,
        title: document.title,
        url: document.URL,
        referrer: document.referrer,
        lastModified: document.lastModified,
        visibilityState: document.visibilityState
      };
      
      console.info('DOM Information:', domInfo);
    },

    // Test touch events
    testTouchEvents: () => {
      const touchTest = {
        touchSupport: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints,
        msMaxTouchPoints: (navigator as any).msMaxTouchPoints,
        pointerEvents: 'onpointerdown' in window
      };
      
      console.info('Touch Events Support:', touchTest);
      
      // Add temporary touch event listeners for testing
      const testElement = document.body;
      const touchEvents = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
      
      const logTouch = (event: TouchEvent) => {
        console.debug('Touch Event:', {
          type: event.type,
          touches: event.touches.length,
          targetTouches: event.targetTouches.length,
          changedTouches: event.changedTouches.length,
          timestamp: event.timeStamp
        });
      };
      
      touchEvents.forEach(eventType => {
        testElement.addEventListener(eventType, logTouch, { passive: true });
      });
      
      setTimeout(() => {
        touchEvents.forEach(eventType => {
          testElement.removeEventListener(eventType, logTouch);
        });
        console.info('Touch event testing completed');
      }, 10000);
    },

    // Test network connectivity
    testNetworkConnectivity: async () => {
      const networkTests = [];
      
      // Test fetch to current domain
      try {
        const start = performance.now();
        await fetch('/favicon.ico', { method: 'HEAD' });
        const end = performance.now();
        networkTests.push({
          test: 'Local fetch',
          success: true,
          latency: Math.round(end - start)
        });
      } catch (error) {
        networkTests.push({
          test: 'Local fetch',
          success: false,
          error: error.message
        });
      }
      
      // Test WebSocket support
      try {
        const ws = new WebSocket('wss://echo.websocket.org');
        ws.onopen = () => {
          networkTests.push({ test: 'WebSocket', success: true });
          ws.close();
        };
        ws.onerror = () => {
          networkTests.push({ test: 'WebSocket', success: false });
        };
      } catch (error) {
        networkTests.push({
          test: 'WebSocket',
          success: false,
          error: error.message
        });
      }
      
      console.info('Network Connectivity Tests:', networkTests);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        responsive: { isMobile, deviceType, breakpoint }
      },
      logs: logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp).toISOString()
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mobile-debug-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getLogIcon = (level: DebugLog['level']) => {
    switch (level) {
      case 'error': return '🔴';
      case 'warn': return '🟡';
      case 'info': return '🔵';
      case 'debug': return '🟢';
      default: return '⚪';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isVisible && showFloatingButton) {
    return (
      <MobileOptimizedButton
        onClick={() => setIsVisible(true)}
        className="debug-floating-button"
        ariaLabel="Open mobile debugger"
      >
        🐛
      </MobileOptimizedButton>
    );
  }

  return (
    <>
      {showFloatingButton && (
        <MobileOptimizedButton
          onClick={() => setIsVisible(!isVisible)}
          className="debug-floating-button"
          ariaLabel={isVisible ? "Close mobile debugger" : "Open mobile debugger"}
        >
          {isVisible ? '✕' : '🐛'}
        </MobileOptimizedButton>
      )}
      
      {isVisible && (
        <div className={`mobile-debugger ${className}`}>
          <div className="debugger-header">
            <h3>Mobile Debugger</h3>
            <div className="debugger-controls">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="debug-filter"
              >
                <option value="all">All</option>
                <option value="error">Errors</option>
                <option value="warn">Warnings</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
              
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="debug-search"
              />
              
              <MobileOptimizedButton
                onClick={clearLogs}
                className="clear-logs-btn"
                ariaLabel="Clear logs"
              >
                Clear
              </MobileOptimizedButton>
              
              <MobileOptimizedButton
                onClick={exportLogs}
                className="export-logs-btn"
                ariaLabel="Export logs"
              >
                Export
              </MobileOptimizedButton>
            </div>
          </div>
          
          <div className="debug-utils">
            <MobileOptimizedButton
              onClick={debugUtils.logDeviceInfo}
              className="debug-util-btn"
            >
              Device Info
            </MobileOptimizedButton>
            
            <MobileOptimizedButton
              onClick={debugUtils.logPerformanceInfo}
              className="debug-util-btn"
            >
              Performance
            </MobileOptimizedButton>
            
            <MobileOptimizedButton
              onClick={debugUtils.logDOMInfo}
              className="debug-util-btn"
            >
              DOM Info
            </MobileOptimizedButton>
            
            <MobileOptimizedButton
              onClick={debugUtils.testTouchEvents}
              className="debug-util-btn"
            >
              Touch Test
            </MobileOptimizedButton>
            
            <MobileOptimizedButton
              onClick={debugUtils.testNetworkConnectivity}
              className="debug-util-btn"
            >
              Network Test
            </MobileOptimizedButton>
          </div>
          
          <div className="logs-container" ref={logsRef}>
            {filteredLogs.length === 0 ? (
              <div className="no-logs">No logs to display</div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className={`log-entry log-${log.level}`}>
                  <div className="log-header">
                    <span className="log-icon">{getLogIcon(log.level)}</span>
                    <span className="log-time">{formatTime(log.timestamp)}</span>
                    <span className="log-category">{log.category}</span>
                    <span className="log-level">{log.level.toUpperCase()}</span>
                  </div>
                  <div className="log-message">
                    {log.message}
                  </div>
                  {log.data && typeof log.data === 'object' && (
                    <details className="log-data">
                      <summary>View Data</summary>
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div className="debugger-status">
            <span>Logs: {filteredLogs.length}/{logs.length}</span>
            <span>Device: {deviceType}</span>
            <span>Breakpoint: {breakpoint}</span>
          </div>
        </div>
      )}
    </>
  );
};
