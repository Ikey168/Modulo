import { useState, useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  interactionDelay: number;
  bundleSize: number;
  isLowEndDevice: boolean;
  networkSpeed: 'slow-2g' | '2g' | '3g' | '4g' | 'offline' | 'unknown';
}

interface PerformanceConfig {
  enabled: boolean;
  sampleInterval: number;
  maxSamples: number;
  reportThreshold: number;
}

// Hook for comprehensive mobile performance monitoring
export const useMobilePerformance = (config: Partial<PerformanceConfig> = {}) => {
  const {
    enabled = true,
    sampleInterval = 1000,
    maxSamples = 60,
    reportThreshold = 30 // FPS threshold for performance warnings
  } = config;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    renderTime: 0,
    interactionDelay: 0,
    bundleSize: 0,
    isLowEndDevice: false,
    networkSpeed: 'unknown'
  });

  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const frameCount = useRef(0);
  const lastFrameTime = useRef(performance.now());

  // Detect low-end device based on hardware concurrency and memory
  const detectLowEndDevice = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    const deviceMemory = (navigator as any).deviceMemory || 1;
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Consider device low-end if:
    // - Less than 2 CPU cores
    // - Less than 2GB RAM
    // - Older Android or iOS versions
    const isLowEndCPU = hardwareConcurrency < 2;
    const isLowEndMemory = deviceMemory < 2;
    const isOldAndroid = /android [1-6]\./.test(userAgent);
    const isOldIOS = /iphone os [1-9]_/.test(userAgent);
    
    return isLowEndCPU || isLowEndMemory || isOldAndroid || isOldIOS;
  }, []);

  // Detect network speed using Network Information API
  const detectNetworkSpeed = useCallback(() => {
    if (typeof window === 'undefined') return 'unknown';
    
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (!connection) return 'unknown';
    
    return connection.effectiveType || 'unknown';
  }, []);

  // Measure FPS using requestAnimationFrame
  const measureFPS = useCallback(() => {
    const now = performance.now();
    frameCount.current++;
    
    if (now - lastFrameTime.current >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / (now - lastFrameTime.current));
      frameCount.current = 0;
      lastFrameTime.current = now;
      return fps;
    }
    
    return null;
  }, []);

  // Measure memory usage
  const measureMemoryUsage = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    
    const memory = (performance as any).memory;
    if (!memory) return 0;
    
    return Math.round(memory.usedJSHeapSize / (1024 * 1024)); // MB
  }, []);

  // Measure render time using Performance Observer
  const measureRenderTime = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    
    try {
      const entries = performance.getEntriesByType('measure');
      const renderEntries = entries.filter(entry => entry.name.includes('React'));
      
      if (renderEntries.length > 0) {
        const latestEntry = renderEntries[renderEntries.length - 1];
        return Math.round(latestEntry.duration);
      }
    } catch (error) {
      console.warn('Failed to measure render time:', error);
    }
    
    return 0;
  }, []);

  // Measure interaction delay
  const measureInteractionDelay = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    
    try {
      const entries = performance.getEntriesByType('event') as any[];
      const interactionEntries = entries.filter(entry => 
        ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].includes(entry.name)
      );
      
      if (interactionEntries.length > 0) {
        const latestEntry = interactionEntries[interactionEntries.length - 1];
        return Math.round(latestEntry.processingStart - latestEntry.startTime);
      }
    } catch (error) {
      console.warn('Failed to measure interaction delay:', error);
    }
    
    return 0;
  }, []);

  // Estimate bundle size
  const estimateBundleSize = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    
    try {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsEntries = entries.filter(entry => 
        entry.name.includes('.js') && entry.transferSize
      );
      
      const totalSize = jsEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
      return Math.round(totalSize / 1024); // KB
    } catch (error) {
      console.warn('Failed to estimate bundle size:', error);
    }
    
    return 0;
  }, []);

  // Start performance monitoring
  const startMonitoring = useCallback(() => {
    if (!enabled || isMonitoring) return;
    
    setIsMonitoring(true);
    
    const interval = setInterval(() => {
      const fps = measureFPS();
      if (fps === null) return;
      
      const newMetrics: PerformanceMetrics = {
        fps,
        memoryUsage: measureMemoryUsage(),
        renderTime: measureRenderTime(),
        interactionDelay: measureInteractionDelay(),
        bundleSize: estimateBundleSize(),
        isLowEndDevice: detectLowEndDevice(),
        networkSpeed: detectNetworkSpeed()
      };
      
      setMetrics(newMetrics);
      
      setPerformanceHistory(prev => {
        const updated = [...prev, newMetrics];
        return updated.slice(-maxSamples);
      });
      
      // Log performance warnings
      if (fps < reportThreshold) {
        console.warn(`Low FPS detected: ${fps}fps`);
      }
      
      if (newMetrics.memoryUsage > 100) { // 100MB threshold
        console.warn(`High memory usage: ${newMetrics.memoryUsage}MB`);
      }
      
      if (newMetrics.interactionDelay > 100) { // 100ms threshold
        console.warn(`High interaction delay: ${newMetrics.interactionDelay}ms`);
      }
      
    }, sampleInterval);
    
    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [enabled, isMonitoring, sampleInterval, maxSamples, reportThreshold, measureFPS, measureMemoryUsage, measureRenderTime, measureInteractionDelay, estimateBundleSize, detectLowEndDevice, detectNetworkSpeed]);

  // Stop performance monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    if (performanceHistory.length === 0) return null;
    
    const avgFPS = performanceHistory.reduce((sum, m) => sum + m.fps, 0) / performanceHistory.length;
    const avgMemory = performanceHistory.reduce((sum, m) => sum + m.memoryUsage, 0) / performanceHistory.length;
    const avgRenderTime = performanceHistory.reduce((sum, m) => sum + m.renderTime, 0) / performanceHistory.length;
    const avgInteractionDelay = performanceHistory.reduce((sum, m) => sum + m.interactionDelay, 0) / performanceHistory.length;
    
    const minFPS = Math.min(...performanceHistory.map(m => m.fps));
    const maxMemory = Math.max(...performanceHistory.map(m => m.memoryUsage));
    const maxRenderTime = Math.max(...performanceHistory.map(m => m.renderTime));
    const maxInteractionDelay = Math.max(...performanceHistory.map(m => m.interactionDelay));
    
    return {
      average: {
        fps: Math.round(avgFPS),
        memoryUsage: Math.round(avgMemory),
        renderTime: Math.round(avgRenderTime),
        interactionDelay: Math.round(avgInteractionDelay)
      },
      peaks: {
        minFPS,
        maxMemory,
        maxRenderTime,
        maxInteractionDelay
      },
      sampleCount: performanceHistory.length,
      deviceInfo: {
        isLowEndDevice: metrics.isLowEndDevice,
        networkSpeed: metrics.networkSpeed,
        bundleSize: metrics.bundleSize
      }
    };
  }, [performanceHistory, metrics]);

  // Export performance data
  const exportPerformanceData = useCallback(() => {
    const summary = getPerformanceSummary();
    const data = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      devicePixelRatio: window.devicePixelRatio,
      summary,
      rawData: performanceHistory
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mobile-performance-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [getPerformanceSummary, performanceHistory]);

  // Auto-start monitoring on mount
  useEffect(() => {
    if (enabled) {
      const cleanup = startMonitoring();
      return cleanup;
    }
  }, [enabled, startMonitoring]);

  return {
    metrics,
    performanceHistory,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    getPerformanceSummary,
    exportPerformanceData
  };
};

// Performance optimization utilities
export const performanceUtils = {
  // Debounce function for performance optimization
  debounce: <T extends (...args: any[]) => any>(func: T, delay: number): T => {
    let timeoutId: NodeJS.Timeout;
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  },

  // Throttle function for performance optimization
  throttle: <T extends (...args: any[]) => any>(func: T, limit: number): T => {
    let inThrottle: boolean;
    return ((...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  },

  // Lazy loading for images
  lazyLoadImage: (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  },

  // Check if element is in viewport
  isInViewport: (element: Element): boolean => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  // Memory cleanup utility
  cleanup: () => {
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
  }
};
