import React, { useState, useCallback } from 'react';
import { useMobilePerformance } from '../../hooks/useMobilePerformance';
import { useResponsive } from '../../hooks/useResponsive';
import { MobileOptimizedButton } from './MobileOptimizedButton';
import './MobileTestSuite.css';

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  score?: number;
  details?: string;
  error?: string;
  data?: any;
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestResult[];
  status: 'idle' | 'running' | 'completed';
}

interface Props {
  className?: string;
  autoRun?: boolean;
}

export const MobileTestSuite: React.FC<Props> = ({ 
  className = '', 
  autoRun = false 
}) => {
  const { isMobile, deviceType, breakpoint } = useResponsive();
  const { metrics, startMonitoring, stopMonitoring } = useMobilePerformance();
  
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [currentSuite, setCurrentSuite] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{ [key: string]: TestResult }>({});

  // Initialize test suites
  const initializeTestSuites = useCallback(() => {
    const suites: TestSuite[] = [
      {
        id: 'performance',
        name: 'Performance Tests',
        description: 'Test mobile app performance and responsiveness',
        status: 'idle',
        tests: [
          {
            id: 'fps-test',
            name: 'Frame Rate Test',
            category: 'Performance',
            status: 'pending',
            duration: 0
          },
          {
            id: 'memory-test',
            name: 'Memory Usage Test',
            category: 'Performance',
            status: 'pending',
            duration: 0
          },
          {
            id: 'touch-latency-test',
            name: 'Touch Latency Test',
            category: 'Performance',
            status: 'pending',
            duration: 0
          },
          {
            id: 'scroll-performance-test',
            name: 'Scroll Performance Test',
            category: 'Performance',
            status: 'pending',
            duration: 0
          },
          {
            id: 'animation-performance-test',
            name: 'Animation Performance Test',
            category: 'Performance',
            status: 'pending',
            duration: 0
          }
        ]
      },
      {
        id: 'responsiveness',
        name: 'Responsiveness Tests',
        description: 'Test mobile UI responsiveness and layout adaptation',
        status: 'idle',
        tests: [
          {
            id: 'viewport-test',
            name: 'Viewport Adaptation Test',
            category: 'Responsiveness',
            status: 'pending',
            duration: 0
          },
          {
            id: 'orientation-test',
            name: 'Orientation Change Test',
            category: 'Responsiveness',
            status: 'pending',
            duration: 0
          },
          {
            id: 'touch-target-test',
            name: 'Touch Target Size Test',
            category: 'Responsiveness',
            status: 'pending',
            duration: 0
          },
          {
            id: 'text-readability-test',
            name: 'Text Readability Test',
            category: 'Responsiveness',
            status: 'pending',
            duration: 0
          },
          {
            id: 'navigation-test',
            name: 'Mobile Navigation Test',
            category: 'Responsiveness',
            status: 'pending',
            duration: 0
          }
        ]
      },
      {
        id: 'compatibility',
        name: 'Device Compatibility Tests',
        description: 'Test compatibility across different mobile devices and browsers',
        status: 'idle',
        tests: [
          {
            id: 'browser-features-test',
            name: 'Browser Features Test',
            category: 'Compatibility',
            status: 'pending',
            duration: 0
          },
          {
            id: 'touch-events-test',
            name: 'Touch Events Test',
            category: 'Compatibility',
            status: 'pending',
            duration: 0
          },
          {
            id: 'device-api-test',
            name: 'Device APIs Test',
            category: 'Compatibility',
            status: 'pending',
            duration: 0
          },
          {
            id: 'network-test',
            name: 'Network Conditions Test',
            category: 'Compatibility',
            status: 'pending',
            duration: 0
          },
          {
            id: 'offline-test',
            name: 'Offline Functionality Test',
            category: 'Compatibility',
            status: 'pending',
            duration: 0
          }
        ]
      },
      {
        id: 'accessibility',
        name: 'Mobile Accessibility Tests',
        description: 'Test mobile accessibility features and compliance',
        status: 'idle',
        tests: [
          {
            id: 'focus-management-test',
            name: 'Focus Management Test',
            category: 'Accessibility',
            status: 'pending',
            duration: 0
          },
          {
            id: 'screen-reader-test',
            name: 'Screen Reader Test',
            category: 'Accessibility',
            status: 'pending',
            duration: 0
          },
          {
            id: 'color-contrast-test',
            name: 'Color Contrast Test',
            category: 'Accessibility',
            status: 'pending',
            duration: 0
          },
          {
            id: 'keyboard-navigation-test',
            name: 'Keyboard Navigation Test',
            category: 'Accessibility',
            status: 'pending',
            duration: 0
          }
        ]
      }
    ];

    setTestSuites(suites);
  }, []);

  // Individual test implementations
  const testImplementations = {
    // Performance Tests
    'fps-test': async (): Promise<TestResult> => {
      const startTime = performance.now();
      let frameCount = 0;
      const frameTimes: number[] = [];
      
      return new Promise((resolve) => {
        const measureFrames = () => {
          frameCount++;
          const currentTime = performance.now();
          frameTimes.push(currentTime);
          
          if (frameCount < 180) { // Test for 3 seconds at 60fps
            requestAnimationFrame(measureFrames);
          } else {
            const duration = performance.now() - startTime;
            const fps = (frameCount / duration) * 1000;
            const avgFps = Math.round(fps);
            const minFps = Math.round(Math.min(...frameTimes.map((time, i) => 
              i > 0 ? 1000 / (time - frameTimes[i - 1]) : 60
            )));
            
            resolve({
              id: 'fps-test',
              name: 'Frame Rate Test',
              category: 'Performance',
              status: avgFps >= 55 ? 'passed' : avgFps >= 30 ? 'failed' : 'failed',
              duration: Math.round(duration),
              score: avgFps,
              details: `Average FPS: ${avgFps}, Minimum FPS: ${minFps}`,
              data: { avgFps, minFps, frameCount, testDuration: duration }
            });
          }
        };
        
        requestAnimationFrame(measureFrames);
      });
    },

    'memory-test': async (): Promise<TestResult> => {
      const startTime = performance.now();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Create memory pressure
      const objects: any[] = [];
      for (let i = 0; i < 10000; i++) {
        objects.push({
          id: i,
          data: new Array(100).fill(Math.random()),
          nested: { value: Math.random() }
        });
      }
      
      const peakMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Clean up
      objects.length = 0;
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
      const duration = performance.now() - startTime;
      
      return {
        id: 'memory-test',
        name: 'Memory Usage Test',
        category: 'Performance',
        status: memoryIncrease < 10 ? 'passed' : memoryIncrease < 50 ? 'failed' : 'failed',
        duration: Math.round(duration),
        score: Math.round(100 - Math.min(memoryIncrease, 100)),
        details: `Memory increase: ${Math.round(memoryIncrease)}MB`,
        data: { 
          initialMemory: Math.round(initialMemory / (1024 * 1024)),
          peakMemory: Math.round(peakMemory / (1024 * 1024)),
          finalMemory: Math.round(finalMemory / (1024 * 1024)),
          memoryIncrease
        }
      };
    },

    'touch-latency-test': async (): Promise<TestResult> => {
      const startTime = performance.now();
      
      return new Promise((resolve) => {
        const latencies: number[] = [];
        let touchCount = 0;
        const maxTouches = 20;
        
        const handleTouch = (event: Event) => {
          const touchStart = event.timeStamp;
          requestAnimationFrame(() => {
            const latency = performance.now() - touchStart;
            latencies.push(latency);
            touchCount++;
            
            if (touchCount >= maxTouches) {
              document.removeEventListener('click', handleTouch);
              const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
              const maxLatency = Math.max(...latencies);
              const duration = performance.now() - startTime;
              
              resolve({
                id: 'touch-latency-test',
                name: 'Touch Latency Test',
                category: 'Performance',
                status: avgLatency < 50 ? 'passed' : avgLatency < 100 ? 'failed' : 'failed',
                duration: Math.round(duration),
                score: Math.round(Math.max(0, 100 - avgLatency)),
                details: `Average latency: ${Math.round(avgLatency)}ms, Max: ${Math.round(maxLatency)}ms`,
                data: { avgLatency, maxLatency, touchCount, latencies }
              });
            }
          });
        };
        
        document.addEventListener('click', handleTouch);
        
        // Auto-trigger clicks for testing
        setTimeout(() => {
          for (let i = 0; i < maxTouches; i++) {
            setTimeout(() => {
              const event = new Event('click');
              (event as any).timeStamp = performance.now();
              document.dispatchEvent(event);
            }, i * 100);
          }
        }, 500);
      });
    },

    'viewport-test': async (): Promise<TestResult> => {
      const startTime = performance.now();
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const deviceWidth = screen.width;
      const deviceHeight = screen.height;
      const pixelRatio = window.devicePixelRatio;
      
      const isPhoneViewport = viewportWidth <= 480;
      const isTabletViewport = viewportWidth > 480 && viewportWidth <= 768;
      const isDesktopViewport = viewportWidth > 768;
      
      const hasProperViewport = document.querySelector('meta[name="viewport"]') !== null;
      const viewportContent = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      
      const checks = [
        { name: 'Has viewport meta tag', passed: hasProperViewport },
        { name: 'Proper viewport scaling', passed: viewportContent.includes('width=device-width') },
        { name: 'Mobile viewport width', passed: isMobile ? viewportWidth <= 768 : true },
        { name: 'Responsive breakpoints', passed: breakpoint !== 'unknown' }
      ];
      
      const passedChecks = checks.filter(check => check.passed).length;
      const score = Math.round((passedChecks / checks.length) * 100);
      
      const duration = performance.now() - startTime;
      
      return {
        id: 'viewport-test',
        name: 'Viewport Adaptation Test',
        category: 'Responsiveness',
        status: score >= 75 ? 'passed' : score >= 50 ? 'failed' : 'failed',
        duration: Math.round(duration),
        score,
        details: `${passedChecks}/${checks.length} checks passed`,
        data: {
          viewportWidth,
          viewportHeight,
          deviceWidth,
          deviceHeight,
          pixelRatio,
          breakpoint,
          checks,
          viewportContent
        }
      };
    },

    'browser-features-test': async (): Promise<TestResult> => {
      const startTime = performance.now();
      
      const features = [
        { name: 'Touch Events', supported: 'ontouchstart' in window },
        { name: 'Geolocation API', supported: 'geolocation' in navigator },
        { name: 'Device Motion', supported: 'DeviceMotionEvent' in window },
        { name: 'Device Orientation', supported: 'DeviceOrientationEvent' in window },
        { name: 'Local Storage', supported: 'localStorage' in window },
        { name: 'Session Storage', supported: 'sessionStorage' in window },
        { name: 'IndexedDB', supported: 'indexedDB' in window },
        { name: 'Service Workers', supported: 'serviceWorker' in navigator },
        { name: 'Web Workers', supported: 'Worker' in window },
        { name: 'WebSocket', supported: 'WebSocket' in window },
        { name: 'Fetch API', supported: 'fetch' in window },
        { name: 'Performance API', supported: 'performance' in window },
        { name: 'Intersection Observer', supported: 'IntersectionObserver' in window },
        { name: 'Mutation Observer', supported: 'MutationObserver' in window }
      ];
      
      const supportedFeatures = features.filter(feature => feature.supported).length;
      const score = Math.round((supportedFeatures / features.length) * 100);
      
      const duration = performance.now() - startTime;
      
      return {
        id: 'browser-features-test',
        name: 'Browser Features Test',
        category: 'Compatibility',
        status: score >= 80 ? 'passed' : score >= 60 ? 'failed' : 'failed',
        duration: Math.round(duration),
        score,
        details: `${supportedFeatures}/${features.length} features supported`,
        data: {
          features,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        }
      };
    }
  };

  // Run a single test
  const runTest = async (suiteId: string, testId: string): Promise<void> => {
    const testImpl = testImplementations[testId as keyof typeof testImplementations];
    if (!testImpl) {
      setResults(prev => ({
        ...prev,
        [testId]: {
          id: testId,
          name: testId,
          category: 'Unknown',
          status: 'skipped',
          duration: 0,
          details: 'Test implementation not found'
        }
      }));
      return;
    }

    // Update test status to running
    setResults(prev => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        status: 'running'
      }
    }));

    try {
      const result = await testImpl();
      setResults(prev => ({
        ...prev,
        [testId]: result
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [testId]: {
          id: testId,
          name: testId,
          category: 'Unknown',
          status: 'failed',
          duration: 0,
          error: error.message || 'Unknown error',
          details: 'Test failed with error'
        }
      }));
    }
  };

  // Run entire test suite
  const runTestSuite = async (suiteId: string) => {
    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite) return;

    setCurrentSuite(suiteId);
    setIsRunning(true);
    
    // Start performance monitoring
    startMonitoring();

    try {
      for (const test of suite.tests) {
        await runTest(suiteId, test.id);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      stopMonitoring();
      setIsRunning(false);
      setCurrentSuite(null);
    }
  };

  // Run all test suites
  const runAllTests = async () => {
    setIsRunning(true);
    
    for (const suite of testSuites) {
      await runTestSuite(suite.id);
    }
    
    setIsRunning(false);
  };

  // Export test results
  const exportResults = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      device: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        screen: {
          width: screen.width,
          height: screen.height
        },
        devicePixelRatio: window.devicePixelRatio,
        deviceType,
        breakpoint,
        isMobile
      },
      testSuites: testSuites.map(suite => ({
        ...suite,
        tests: suite.tests.map(test => results[test.id] || test)
      })),
      summary: {
        totalTests: Object.keys(results).length,
        passedTests: Object.values(results).filter(r => r.status === 'passed').length,
        failedTests: Object.values(results).filter(r => r.status === 'failed').length,
        skippedTests: Object.values(results).filter(r => r.status === 'skipped').length
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mobile-test-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Initialize on mount
  React.useEffect(() => {
    initializeTestSuites();
  }, [initializeTestSuites]);

  // Auto-run if enabled
  React.useEffect(() => {
    if (autoRun && testSuites.length > 0 && !isRunning) {
      runAllTests();
    }
  }, [autoRun, testSuites, isRunning]);

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'running': return '#ffc107';
      case 'skipped': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'running': return '⏳';
      case 'skipped': return '⏭️';
      default: return '⭕';
    }
  };

  return (
    <div className={`mobile-test-suite ${className}`}>
      <div className="test-suite-header">
        <h2>Mobile Testing Suite</h2>
        <div className="test-controls">
          <MobileOptimizedButton
            onClick={runAllTests}
            disabled={isRunning}
            className="run-all-btn"
            ariaLabel="Run all tests"
          >
            {isRunning ? '⏳ Running...' : '▶️ Run All Tests'}
          </MobileOptimizedButton>
          
          <MobileOptimizedButton
            onClick={exportResults}
            disabled={Object.keys(results).length === 0}
            className="export-btn"
            ariaLabel="Export test results"
          >
            📊 Export Results
          </MobileOptimizedButton>
        </div>
      </div>

      {/* Test Summary */}
      <div className="test-summary">
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-value">{Object.values(results).filter(r => r.status === 'passed').length}</span>
            <span className="stat-label">Passed</span>
          </div>
          <div className="stat">
            <span className="stat-value">{Object.values(results).filter(r => r.status === 'failed').length}</span>
            <span className="stat-label">Failed</span>
          </div>
          <div className="stat">
            <span className="stat-value">{Object.keys(results).length}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
      </div>

      {/* Test Suites */}
      <div className="test-suites">
        {testSuites.map(suite => (
          <div key={suite.id} className="test-suite-card">
            <div className="suite-header">
              <h3>{suite.name}</h3>
              <p>{suite.description}</p>
              <MobileOptimizedButton
                onClick={() => runTestSuite(suite.id)}
                disabled={isRunning}
                className="run-suite-btn"
                ariaLabel={`Run ${suite.name}`}
              >
                {currentSuite === suite.id ? '⏳ Running' : '▶️ Run Suite'}
              </MobileOptimizedButton>
            </div>
            
            <div className="test-list">
              {suite.tests.map(test => {
                const result = results[test.id] || test;
                return (
                  <div key={test.id} className={`test-item test-${result.status}`}>
                    <div className="test-info">
                      <span className="test-icon">{getStatusIcon(result.status)}</span>
                      <span className="test-name">{test.name}</span>
                      <span className="test-category">{test.category}</span>
                    </div>
                    
                    <div className="test-results">
                      {result.score !== undefined && (
                        <span className="test-score">{result.score}/100</span>
                      )}
                      {result.duration > 0 && (
                        <span className="test-duration">{result.duration}ms</span>
                      )}
                    </div>
                    
                    {result.details && (
                      <div className="test-details">{result.details}</div>
                    )}
                    
                    {result.error && (
                      <div className="test-error">Error: {result.error}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
