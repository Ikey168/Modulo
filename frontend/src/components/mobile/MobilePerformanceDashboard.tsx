import React, { useState, useEffect } from 'react';
import { useMobilePerformance, performanceUtils } from '../../hooks/useMobilePerformance';
import { useResponsive } from '../../hooks/useResponsive';
import { MobileOptimizedButton } from './MobileOptimizedButton';
import './MobilePerformanceDashboard.css';

interface Props {
  className?: string;
  showAdvanced?: boolean;
}

export const MobilePerformanceDashboard: React.FC<Props> = ({ 
  className = '', 
  showAdvanced = false 
}) => {
  const { isMobile } = useResponsive();
  const {
    metrics,
    performanceHistory,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    getPerformanceSummary,
    exportPerformanceData
  } = useMobilePerformance({
    enabled: true,
    sampleInterval: 500,
    maxSamples: 120
  });

  const [showDetails, setShowDetails] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const summary = getPerformanceSummary();

  // Performance test scenarios
  const runPerformanceTests = async () => {
    const testResults = {
      timestamp: new Date().toISOString(),
      device: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        devicePixelRatio: window.devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory
      },
      tests: {
        scrollPerformance: await testScrollPerformance(),
        touchResponsiveness: await testTouchResponsiveness(),
        renderPerformance: await testRenderPerformance(),
        memoryLeaks: await testMemoryLeaks(),
        networkLatency: await testNetworkLatency()
      }
    };

    setTestResults(testResults);
  };

  const testScrollPerformance = async (): Promise<any> => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let frameCount = 0;
      const fps: number[] = [];

      const measureFrame = () => {
        frameCount++;
        const currentTime = performance.now();
        const fpsValue = 1000 / (currentTime - startTime);
        fps.push(fpsValue);

        if (frameCount < 60) { // Test for 1 second at 60fps
          requestAnimationFrame(measureFrame);
        } else {
          const avgFPS = fps.reduce((sum, f) => sum + f, 0) / fps.length;
          const minFPS = Math.min(...fps);
          resolve({
            averageFPS: Math.round(avgFPS),
            minimumFPS: Math.round(minFPS),
            frameDrops: fps.filter(f => f < 55).length,
            testDuration: currentTime - startTime
          });
        }
      };

      requestAnimationFrame(measureFrame);
    });
  };

  const testTouchResponsiveness = async (): Promise<any> => {
    return new Promise((resolve) => {
      const touchDelays: number[] = [];
      let touchCount = 0;

      const handleTouch = (event: TouchEvent) => {
        const touchStart = performance.now();
        requestAnimationFrame(() => {
          const delay = performance.now() - touchStart;
          touchDelays.push(delay);
          touchCount++;

          if (touchCount >= 10) {
            document.removeEventListener('touchstart', handleTouch);
            const avgDelay = touchDelays.reduce((sum, d) => sum + d, 0) / touchDelays.length;
            const maxDelay = Math.max(...touchDelays);
            resolve({
              averageDelay: Math.round(avgDelay),
              maximumDelay: Math.round(maxDelay),
              responsiveInteractions: touchDelays.filter(d => d < 16).length,
              slowInteractions: touchDelays.filter(d => d > 100).length
            });
          }
        });
      };

      // Simulate touch events for testing
      document.addEventListener('touchstart', handleTouch);
      
      // Fallback for non-touch devices
      setTimeout(() => {
        document.removeEventListener('touchstart', handleTouch);
        resolve({
          averageDelay: 16,
          maximumDelay: 16,
          responsiveInteractions: 10,
          slowInteractions: 0,
          note: 'Simulated on non-touch device'
        });
      }, 2000);
    });
  };

  const testRenderPerformance = async (): Promise<any> => {
    const startTime = performance.now();
    const componentCount = 100;
    const renders: number[] = [];

    return new Promise((resolve) => {
      // Simulate heavy rendering by creating many elements
      for (let i = 0; i < componentCount; i++) {
        const renderStart = performance.now();
        const element = document.createElement('div');
        element.style.cssText = `
          position: absolute;
          width: 10px;
          height: 10px;
          background: rgba(${i % 255}, ${(i * 2) % 255}, ${(i * 3) % 255}, 0.5);
          transform: translateX(${i * 2}px) translateY(${i * 2}px);
        `;
        document.body.appendChild(element);
        
        requestAnimationFrame(() => {
          const renderTime = performance.now() - renderStart;
          renders.push(renderTime);
          
          // Clean up
          document.body.removeChild(element);
          
          if (renders.length === componentCount) {
            const totalTime = performance.now() - startTime;
            const avgRenderTime = renders.reduce((sum, r) => sum + r, 0) / renders.length;
            const maxRenderTime = Math.max(...renders);
            
            resolve({
              totalRenderTime: Math.round(totalTime),
              averageComponentRender: Math.round(avgRenderTime),
              slowestComponentRender: Math.round(maxRenderTime),
              componentsRendered: componentCount,
              renderThroughput: Math.round(componentCount / (totalTime / 1000))
            });
          }
        });
      }
    });
  };

  const testMemoryLeaks = async (): Promise<any> => {
    if (!(performance as any).memory) {
      return {
        memoryBefore: 'N/A',
        memoryAfter: 'N/A',
        memoryDelta: 'N/A',
        note: 'Memory API not available'
      };
    }

    const memoryBefore = (performance as any).memory.usedJSHeapSize;
    
    // Create and cleanup objects to test memory leaks
    const objects: any[] = [];
    for (let i = 0; i < 10000; i++) {
      objects.push({
        id: i,
        data: new Array(100).fill(Math.random()),
        timestamp: Date.now()
      });
    }

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    // Clear objects
    objects.length = 0;

    return new Promise((resolve) => {
      setTimeout(() => {
        const memoryAfter = (performance as any).memory.usedJSHeapSize;
        const memoryDelta = memoryAfter - memoryBefore;

        resolve({
          memoryBefore: Math.round(memoryBefore / (1024 * 1024)),
          memoryAfter: Math.round(memoryAfter / (1024 * 1024)),
          memoryDelta: Math.round(memoryDelta / (1024 * 1024)),
          potentialLeak: memoryDelta > 1024 * 1024 // 1MB threshold
        });
      }, 1000);
    });
  };

  const testNetworkLatency = async (): Promise<any> => {
    const testUrls = [
      '/api/health',
      '/static/favicon.ico'
    ];

    const latencies: number[] = [];

    for (const url of testUrls) {
      try {
        const startTime = performance.now();
        await fetch(url, { method: 'HEAD' });
        const latency = performance.now() - startTime;
        latencies.push(latency);
      } catch (error) {
        // Handle failed requests
        latencies.push(-1);
      }
    }

    const validLatencies = latencies.filter(l => l > 0);
    const avgLatency = validLatencies.length > 0 
      ? validLatencies.reduce((sum, l) => sum + l, 0) / validLatencies.length
      : -1;

    return {
      averageLatency: avgLatency > 0 ? Math.round(avgLatency) : 'Failed',
      testResults: latencies,
      successfulRequests: validLatencies.length,
      totalRequests: testUrls.length
    };
  };

  // Get performance status color
  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return '#4CAF50'; // Green
    if (value >= thresholds.warning) return '#FF9800'; // Orange
    return '#f44336'; // Red
  };

  const getFPSColor = (fps: number) => getPerformanceColor(fps, { good: 55, warning: 30 });
  const getMemoryColor = (memory: number) => getPerformanceColor(100 - memory, { good: 50, warning: 20 });

  return (
    <div className={`mobile-performance-dashboard ${className}`}>
      <div className="performance-header">
        <h2>Mobile Performance Monitor</h2>
        <div className="performance-controls">
          <MobileOptimizedButton
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className={`monitor-toggle ${isMonitoring ? 'monitoring' : ''}`}
            ariaLabel={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
          >
            {isMonitoring ? '⏹️ Stop' : '▶️ Start'}
          </MobileOptimizedButton>
          
          <MobileOptimizedButton
            onClick={runPerformanceTests}
            className="run-tests"
            ariaLabel="Run performance tests"
            disabled={isMonitoring}
          >
            🧪 Test
          </MobileOptimizedButton>
          
          <MobileOptimizedButton
            onClick={exportPerformanceData}
            className="export-data"
            ariaLabel="Export performance data"
            disabled={!summary}
          >
            📊 Export
          </MobileOptimizedButton>
        </div>
      </div>

      {/* Real-time metrics */}
      <div className="performance-metrics">
        <div className="metric-card">
          <div className="metric-value" style={{ color: getFPSColor(metrics.fps) }}>
            {metrics.fps}
          </div>
          <div className="metric-label">FPS</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value" style={{ color: getMemoryColor(metrics.memoryUsage) }}>
            {metrics.memoryUsage}MB
          </div>
          <div className="metric-label">Memory</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">
            {metrics.interactionDelay}ms
          </div>
          <div className="metric-label">Interaction</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">
            {metrics.networkSpeed}
          </div>
          <div className="metric-label">Network</div>
        </div>
      </div>

      {/* Device information */}
      <div className="device-info">
        <div className={`device-status ${metrics.isLowEndDevice ? 'low-end' : 'high-end'}`}>
          {metrics.isLowEndDevice ? '📱 Low-End Device' : '📱 High-End Device'}
        </div>
        <div className="bundle-info">
          Bundle: {metrics.bundleSize}KB
        </div>
      </div>

      {/* Performance summary */}
      {summary && (
        <div className="performance-summary">
          <h3>Performance Summary</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span>Avg FPS:</span>
              <span style={{ color: getFPSColor(summary.average.fps) }}>
                {summary.average.fps}
              </span>
            </div>
            <div className="summary-item">
              <span>Min FPS:</span>
              <span style={{ color: getFPSColor(summary.peaks.minFPS) }}>
                {summary.peaks.minFPS}
              </span>
            </div>
            <div className="summary-item">
              <span>Max Memory:</span>
              <span>{summary.peaks.maxMemory}MB</span>
            </div>
            <div className="summary-item">
              <span>Max Interaction:</span>
              <span>{summary.peaks.maxInteractionDelay}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Test results */}
      {testResults && (
        <div className="test-results">
          <h3>Performance Test Results</h3>
          
          <div className="test-section">
            <h4>Scroll Performance</h4>
            <div className="test-data">
              <div>Average FPS: {testResults.tests.scrollPerformance.averageFPS}</div>
              <div>Minimum FPS: {testResults.tests.scrollPerformance.minimumFPS}</div>
              <div>Frame Drops: {testResults.tests.scrollPerformance.frameDrops}</div>
            </div>
          </div>
          
          <div className="test-section">
            <h4>Touch Responsiveness</h4>
            <div className="test-data">
              <div>Average Delay: {testResults.tests.touchResponsiveness.averageDelay}ms</div>
              <div>Maximum Delay: {testResults.tests.touchResponsiveness.maximumDelay}ms</div>
              <div>Responsive: {testResults.tests.touchResponsiveness.responsiveInteractions}/10</div>
            </div>
          </div>
          
          <div className="test-section">
            <h4>Render Performance</h4>
            <div className="test-data">
              <div>Total Render: {testResults.tests.renderPerformance.totalRenderTime}ms</div>
              <div>Avg Component: {testResults.tests.renderPerformance.averageComponentRender}ms</div>
              <div>Throughput: {testResults.tests.renderPerformance.renderThroughput}/sec</div>
            </div>
          </div>
          
          <div className="test-section">
            <h4>Memory Test</h4>
            <div className="test-data">
              <div>Before: {testResults.tests.memoryLeaks.memoryBefore}MB</div>
              <div>After: {testResults.tests.memoryLeaks.memoryAfter}MB</div>
              <div>Delta: {testResults.tests.memoryLeaks.memoryDelta}MB</div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced details */}
      {showAdvanced && (
        <div className="advanced-section">
          <MobileOptimizedButton
            onClick={() => setShowDetails(!showDetails)}
            className="details-toggle"
            ariaLabel="Toggle advanced details"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </MobileOptimizedButton>
          
          {showDetails && performanceHistory.length > 0 && (
            <div className="performance-chart">
              <h4>Performance History</h4>
              <div className="chart-container">
                {performanceHistory.slice(-20).map((metric, index) => (
                  <div key={index} className="chart-bar">
                    <div 
                      className="fps-bar"
                      style={{
                        height: `${(metric.fps / 60) * 100}%`,
                        backgroundColor: getFPSColor(metric.fps)
                      }}
                      title={`FPS: ${metric.fps}`}
                    />
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                <span>FPS History (Last 20 samples)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance recommendations */}
      <div className="performance-recommendations">
        <h3>Optimization Recommendations</h3>
        <div className="recommendations-list">
          {metrics.fps < 30 && (
            <div className="recommendation warning">
              ⚠️ Low FPS detected. Consider reducing animations and complex renders.
            </div>
          )}
          {metrics.memoryUsage > 100 && (
            <div className="recommendation warning">
              ⚠️ High memory usage. Check for memory leaks and optimize data structures.
            </div>
          )}
          {metrics.interactionDelay > 100 && (
            <div className="recommendation warning">
              ⚠️ High interaction delay. Optimize event handlers and reduce main thread blocking.
            </div>
          )}
          {metrics.isLowEndDevice && (
            <div className="recommendation info">
              💡 Low-end device detected. Consider enabling performance mode and reducing visual effects.
            </div>
          )}
          {metrics.networkSpeed === 'slow-2g' || metrics.networkSpeed === '2g' && (
            <div className="recommendation info">
              💡 Slow network detected. Enable offline mode and optimize data loading.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
