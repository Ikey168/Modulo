import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarCheck, Heart, LayoutDashboard, Store, Undo2, Wrench, type LucideIcon } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { phoneDestinations, type PhoneNavEntry } from '../mobile/phoneNav';
import { PhoneFab, PhoneNavDrawer } from '../mobile/PhoneChrome';
import { BannerSlot, SystemBanner } from '../mobile/SystemBanner';
import { PhoneScreenProvider } from '../mobile/PhoneScreenProvider';
import { usePhoneImmersive, usePhoneScreen } from '../mobile/phoneScreen';

const entry = (id: string, label: string, icon: LucideIcon): PhoneNavEntry => ({ id, label, icon });

describe('phoneDestinations', () => {
  // The workspace nav is ordered for a desktop rail, where the utility tail
  // costs nothing. On a bar with four slots it was the tail that filled them.
  it('gives content destinations the slots before utility ones', () => {
    const nav = [
      entry('dashboard', 'Dashboard', LayoutDashboard),
      entry('blueprints', 'Blueprints', Wrench),
      entry('marketplace', 'Marketplace', Store),
      entry('recovery', 'Recovery', Undo2),
      entry('knowledge', 'Knowledge', CalendarCheck),
      entry('life', 'Life', Heart),
    ];

    expect(phoneDestinations(nav, 'dashboard').map((item) => item.id)).toEqual([
      'dashboard',
      'blueprints',
      'knowledge',
      'life',
    ]);
  });

  it('still surfaces a utility destination while it is the one you are on', () => {
    const nav = [
      entry('dashboard', 'Dashboard', LayoutDashboard),
      entry('knowledge', 'Knowledge', CalendarCheck),
      entry('life', 'Life', Heart),
      entry('tools', 'Tools', Wrench),
      entry('recovery', 'Recovery', Undo2),
    ];

    expect(phoneDestinations(nav, 'recovery').map((item) => item.id)).toEqual([
      'dashboard',
      'knowledge',
      'life',
      'recovery',
    ]);
  });
});

describe('PhoneFab', () => {
  it('reserves its own footprint while it is mounted', () => {
    const { unmount } = render(<PhoneFab label="New note" icon={LayoutDashboard} onClick={vi.fn()} />);
    // Without this the button sits on top of whatever the view scrolls to last.
    expect(document.documentElement.style.getPropertyValue('--fab-inset')).not.toBe('');

    unmount();
    expect(document.documentElement.style.getPropertyValue('--fab-inset')).toBe('');
  });
});

describe('PhoneNavDrawer', () => {
  it('does not sign you out for tapping your own name', async () => {
    const onLogout = vi.fn();
    render(
      <PhoneNavDrawer
        open
        onOpenChange={vi.fn()}
        items={[entry('dashboard', 'Dashboard', LayoutDashboard)]}
        activeId="dashboard"
        onSelect={vi.fn()}
        userLabel="Ada Lovelace"
        userSub="ada@example.test"
        initials="AL"
        onLogout={onLogout}
      />,
    );

    await userEvent.click(screen.getByText('Ada Lovelace'));
    expect(onLogout).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Log out of Ada Lovelace' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('SystemBanner', () => {
  it('renders into the shell slot rather than above the app bar', async () => {
    render(
      <div>
        <header data-testid="app-bar">Dashboard</header>
        <BannerSlot />
        <SystemBanner tone="alert">Couldn’t save changes on this device.</SystemBanner>
      </div>,
    );

    const slot = document.getElementById('modulo-banner-slot');
    await waitFor(() => expect(slot).toContainElement(screen.getByRole('alert')));
  });

  it('renders in place when there is no shell to portal into', () => {
    render(<SystemBanner>Offline.</SystemBanner>);
    expect(screen.getByRole('status')).toHaveTextContent('Offline.');
  });
});

describe('phone screen claims', () => {
  function Shell() {
    return (
      <PhoneScreenProvider>
        <Chrome />
        <Detail />
      </PhoneScreenProvider>
    );
  }
  function Chrome() {
    return usePhoneScreen() ? null : <header>App bar</header>;
  }
  function Detail() {
    usePhoneImmersive('notes', true);
    return <p>Note</p>;
  }

  it('folds the shell bars away while a view owns the screen', async () => {
    render(<Shell />);
    // Three bars of chrome above an opened note is two bars about other screens.
    await waitFor(() => expect(screen.queryByText('App bar')).not.toBeInTheDocument());
  });

  it('gives the bars back when the view unmounts', async () => {
    function Toggling({ open }: { open: boolean }) {
      return (
        <PhoneScreenProvider>
          <Chrome />
          {open && <Detail />}
        </PhoneScreenProvider>
      );
    }
    const { rerender } = render(<Toggling open />);
    await waitFor(() => expect(screen.queryByText('App bar')).not.toBeInTheDocument());

    rerender(<Toggling open={false} />);
    await waitFor(() => expect(screen.getByText('App bar')).toBeInTheDocument());
  });
});
