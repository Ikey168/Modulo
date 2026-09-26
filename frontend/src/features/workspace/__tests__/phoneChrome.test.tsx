import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarCheck, Heart, LayoutDashboard, Store, Wrench, type LucideIcon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhoneBottomNav } from '../mobile/PhoneChrome';
import { phoneDestinations, type PhoneNavEntry } from '../mobile/phoneNav';
import { startMobileViewport } from '../../../services/mobileViewport';

const entry = (id: string, label: string, icon: LucideIcon): PhoneNavEntry => ({ id, label, icon });

const NAV: PhoneNavEntry[] = [
  entry('dashboard', 'Dashboard', LayoutDashboard),
  entry('notes', 'Notes', CalendarCheck),
  entry('life', 'Life', Heart),
  entry('tools', 'Tools', Wrench),
  entry('marketplace', 'Marketplace', Store),
];

describe('phoneDestinations', () => {
  it('keeps the workspace nav order when the open view already has a slot', () => {
    expect(phoneDestinations(NAV, 'life').map((item) => item.id)).toEqual([
      'dashboard',
      'notes',
      'life',
      'tools',
    ]);
  });

  it('surfaces the open view without losing the home destination', () => {
    // Marketplace sits past the four slots; the bar must still show where you
    // are, or the only "current" indicator left is the More button.
    expect(phoneDestinations(NAV, 'marketplace').map((item) => item.id)).toEqual([
      'dashboard',
      'notes',
      'life',
      'marketplace',
    ]);
  });

  it('leaves the slots alone for a view that is not a destination at all', () => {
    expect(phoneDestinations(NAV, 'pack-studio').map((item) => item.id)).toEqual([
      'dashboard',
      'notes',
      'life',
      'tools',
    ]);
  });

  it('does not invent slots for a small workspace', () => {
    expect(phoneDestinations(NAV.slice(0, 2), 'notes')).toHaveLength(2);
  });
});

describe('PhoneBottomNav', () => {
  it('labels every destination and marks the open one', async () => {
    const onSelect = vi.fn();
    render(
      <PhoneBottomNav
        items={phoneDestinations(NAV, 'notes')}
        activeId="notes"
        onSelect={onSelect}
        onOpenMore={vi.fn()}
        moreActive={false}
      />,
    );

    // Icons alone are unreadable without hover to explain them.
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(onSelect).toHaveBeenCalledWith('dashboard');
  });

  it('is hidden while the soft keyboard is up', () => {
    render(
      <PhoneBottomNav items={NAV.slice(0, 2)} activeId="notes" onSelect={vi.fn()} onOpenMore={vi.fn()} moreActive />,
    );
    // The CSS rule keys off this attribute; losing it silently parks the bar
    // on top of the keyboard.
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('data-hide-on-keyboard');
  });
});

describe('startMobileViewport', () => {
  const listeners = new Map<string, Set<() => void>>();
  let stop: (() => void) | undefined;

  const stubViewport = (height: number, offsetTop = 0) => {
    const viewport = {
      height,
      offsetTop,
      addEventListener: (type: string, handler: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(handler);
      },
      removeEventListener: (type: string, handler: () => void) => {
        listeners.get(type)?.delete(handler);
      },
    };
    vi.stubGlobal('visualViewport', viewport);
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true, writable: true });
    return viewport;
  };

  const emit = (type: string) => {
    for (const handler of listeners.get(type) ?? []) handler();
  };

  afterEach(() => {
    stop?.();
    stop = undefined;
    listeners.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('data-keyboard');
    document.documentElement.removeAttribute('style');
  });

  it('publishes the visible height, not the 100vh the browser claims', () => {
    window.innerHeight = 800;
    stubViewport(800);
    // Run the frame inline. Returning 0 mirrors the real contract closely
    // enough: the service clears its pending handle when the frame runs.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    stop = startMobileViewport();

    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('800px');
    expect(document.documentElement.dataset.keyboard).toBeUndefined();
  });

  it('reports the keyboard inset once the viewport shrinks past browser chrome', () => {
    window.innerHeight = 800;
    const viewport = stubViewport(800);
    // Run the frame inline. Returning 0 mirrors the real contract closely
    // enough: the service clears its pending handle when the frame runs.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    stop = startMobileViewport();

    act(() => {
      viewport.height = 480;
      emit('resize');
    });

    expect(document.documentElement.dataset.keyboard).toBe('open');
    // In a browser the layout viewport does not move, so fixed chrome has to
    // be lifted by the full covered height.
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('320px');

    // A 40px change is a toolbar collapsing, not a keyboard.
    act(() => {
      viewport.height = 760;
      emit('resize');
    });
    expect(document.documentElement.dataset.keyboard).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('0px');
  });
});
