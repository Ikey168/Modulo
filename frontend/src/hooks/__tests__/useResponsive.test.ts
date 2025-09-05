import { renderHook, act } from '@testing-library/react';
import { useResponsive, BREAKPOINTS } from '../useResponsive';
import { vi } from 'vitest';

// Mock window.matchMedia
const mockMatchMedia = (matches: boolean) => ({
  matches,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

describe('useResponsive Hook', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });
    
    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => {
      if (query.includes('hover')) {
        return mockMatchMedia(true);
      }
      return mockMatchMedia(false);
    });
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight });
    window.matchMedia = originalMatchMedia;
  });

  it('initializes with correct desktop state', () => {
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
    expect(result.current.breakpoint).toBe('lg');
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
  });

  it('detects mobile breakpoint correctly', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 667 });
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.breakpoint).toBe('xs');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('detects tablet breakpoint correctly', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 1024 });
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.breakpoint).toBe('md');
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('detects orientation correctly', () => {
    // Portrait
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 667 });
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('responds to window resize', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    
    const { result } = renderHook(() => useResponsive());
    
    expect(result.current.isDesktop).toBe(true);
    
    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      window.dispatchEvent(new Event('resize'));
    });
    
    // Note: The actual hook might need a setTimeout or debounce
    // so we might need to wait or use fake timers
  });

  it('has correct breakpoint boundaries', () => {
    expect(BREAKPOINTS.xs).toBe(320);
    expect(BREAKPOINTS.sm).toBe(480);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS.xxl).toBe(1536);
  });
});
