import React, { useState } from 'react';
import { 
  MobilePerformanceDashboard, 
  MobileDebugger, 
  MobileTestSuite,
  MobileOptimizedButton 
} from '@/components/mobile';
import { useResponsive } from '@/hooks/useResponsive';
import './MobilePerformanceDemo.css';

interface Props {
  className?: string;
}

export const MobilePerformanceDemo: React.FC<Props> = ({ className = '' }) => {
  const { isMobile, deviceInfo } = useResponsive();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tests' | 'guide'>('dashboard');
  const [showDebugger, setShowDebugger] = useState(false);

  // Demo performance stress test
  const runStressTest = () => {
    console.info('🧪 Starting mobile performance stress test...');
    
    // Create some performance stress
    const elements: HTMLElement[] = [];
    for (let i = 0; i < 1000; i++) {
      const div = document.createElement('div');
      div.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        background: rgba(${i % 255}, ${(i * 2) % 255}, ${(i * 3) % 255}, 0.1);
        transform: translateX(${Math.random() * window.innerWidth}px) 
                   translateY(${Math.random() * window.innerHeight}px);
      `;
      document.body.appendChild(div);
      elements.push(div);
    }
    
    // Animate elements
    let animationId: number;
    const animate = () => {
      elements.forEach((el, i) => {
        const x = Math.sin(performance.now() * 0.001 + i) * 100;
        const y = Math.cos(performance.now() * 0.001 + i) * 100;
        el.style.transform = `translateX(${x}px) translateY(${y}px) rotate(${i * 0.1}deg)`;
      });
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    // Clean up after 5 seconds
    setTimeout(() => {
      cancelAnimationFrame(animationId);
      elements.forEach(el => document.body.removeChild(el));
      console.info('✅ Stress test completed and cleaned up');
    }, 5000);
  };

  // Demo memory leak test
  const simulateMemoryLeak = () => {
    console.warn('🧪 Simulating memory leak (will be cleaned up)...');
    
    const leakyObjects: any[] = [];
    
    // Create objects that reference each other
    const createLeakyObjects = () => {
      for (let i = 0; i < 1000; i++) {
        const obj = {
          id: i,
          data: new Array(1000).fill(Math.random()),
          circular: null as any,
          dom: document.createElement('div')
        };
        obj.circular = obj; // Circular reference
        leakyObjects.push(obj);
      }
    };
    
    createLeakyObjects();
    
    // Clean up after demonstration
    setTimeout(() => {
      leakyObjects.forEach(obj => {
        obj.circular = null;
        obj.dom = null;
      });
      leakyObjects.length = 0;
      
      if (window.gc) {
        window.gc();
      }
      
      console.info('✅ Memory leak simulation cleaned up');
    }, 3000);
  };

  return (
    <div className={`mobile-performance-demo ${className}`}>
      {/* Header */}
      <div className="demo-header">
        <h1>Mobile Performance Testing Demo</h1>
        <div className="device-info">
          <span className="device-badge">{deviceInfo.os || 'Unknown'}</span>
          <span className="mobile-indicator">
            {isMobile ? '📱 Mobile' : '💻 Desktop'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="demo-nav">
        <MobileOptimizedButton
          onClick={() => setActiveTab('dashboard')}
          className={activeTab === 'dashboard' ? 'active' : ''}
          ariaLabel="Performance Dashboard"
        >
          📊 Dashboard
        </MobileOptimizedButton>
        
        <MobileOptimizedButton
          onClick={() => setActiveTab('tests')}
          className={activeTab === 'tests' ? 'active' : ''}
          ariaLabel="Test Suite"
        >
          🧪 Tests
        </MobileOptimizedButton>
        
        <MobileOptimizedButton
          onClick={() => setActiveTab('guide')}
          className={activeTab === 'guide' ? 'active' : ''}
          ariaLabel="Testing Guide"
        >
          📚 Guide
        </MobileOptimizedButton>
      </div>

      {/* Demo Actions */}
      <div className="demo-actions">
        <MobileOptimizedButton
          onClick={runStressTest}
          className="stress-test-btn"
          ariaLabel="Run stress test"
        >
          🔥 Stress Test
        </MobileOptimizedButton>
        
        <MobileOptimizedButton
          onClick={simulateMemoryLeak}
          className="memory-test-btn"
          ariaLabel="Simulate memory issue"
        >
          🧠 Memory Test
        </MobileOptimizedButton>
        
        <MobileOptimizedButton
          onClick={() => setShowDebugger(!showDebugger)}
          className="debugger-toggle-btn"
          ariaLabel="Toggle debugger"
        >
          {showDebugger ? '🐛 Hide Debugger' : '🐛 Show Debugger'}
        </MobileOptimizedButton>
      </div>

      {/* Content Tabs */}
      <div className="demo-content">
        {activeTab === 'dashboard' && (
          <div className="tab-panel">
            <h2>Real-time Performance Monitoring</h2>
            <p>
              This dashboard shows real-time performance metrics for your mobile application.
              Monitor FPS, memory usage, touch latency, and network conditions.
            </p>
            <MobilePerformanceDashboard showAdvanced={true} />
          </div>
        )}
        
        {activeTab === 'tests' && (
          <div className="tab-panel">
            <h2>Comprehensive Mobile Testing</h2>
            <p>
              Run automated tests to check performance, responsiveness, compatibility, 
              and accessibility across different mobile devices and conditions.
            </p>
            <MobileTestSuite />
          </div>
        )}
        
        {activeTab === 'guide' && (
          <div className="tab-panel">
            <h2>Mobile Performance Testing Guide</h2>
            <div className="guide-content">
              <h3>Quick Start</h3>
              <ol>
                <li><strong>Dashboard:</strong> Monitor real-time performance metrics</li>
                <li><strong>Tests:</strong> Run comprehensive mobile test suites</li>
                <li><strong>Debug:</strong> Use mobile debugger for detailed analysis</li>
                <li><strong>Optimize:</strong> Apply performance optimizations based on results</li>
              </ol>
              
              <h3>Key Performance Targets</h3>
              <ul>
                <li><strong>Frame Rate:</strong> ≥55 FPS (good), ≥30 FPS (acceptable)</li>
                <li><strong>Memory Usage:</strong> &lt;100MB for mobile devices</li>
                <li><strong>Touch Latency:</strong> &lt;50ms (good), &lt;100ms (acceptable)</li>
                <li><strong>Load Time:</strong> &lt;3 seconds initial load</li>
              </ul>
              
              <h3>Testing Strategy</h3>
              <ol>
                <li><strong>Automated Tests:</strong> Run test suites regularly</li>
                <li><strong>Real Device Testing:</strong> Test on actual mobile devices</li>
                <li><strong>Network Conditions:</strong> Test various connection speeds</li>
                <li><strong>Performance Monitoring:</strong> Continuous monitoring in production</li>
              </ol>
              
              <h3>Common Issues & Solutions</h3>
              <ul>
                <li><strong>Low FPS:</strong> Optimize animations, reduce DOM manipulation</li>
                <li><strong>High Memory:</strong> Fix memory leaks, optimize images</li>
                <li><strong>Slow Touch:</strong> Optimize event handlers, reduce blocking</li>
                <li><strong>Poor Network:</strong> Implement offline support, optimize bundles</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Debugger */}
      {showDebugger && (
        <MobileDebugger 
          showFloatingButton={false}
          maxLogs={50}
        />
      )}
      
      {/* Floating Debugger Button (when not showing main debugger) */}
      {!showDebugger && (
        <MobileDebugger 
          showFloatingButton={true}
        />
      )}
    </div>
  );
};
