import { NavLink, Link } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import NotificationBell from '../../features/notes/collab/NotificationBell';
import { Avatar, Button, cn } from '@/ui';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
    isActive ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
  );

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="border-b border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <Link to="/" className="mr-2 flex items-center gap-2 text-foreground">
              <svg width={20} height={20} viewBox="0 0 22 22" fill="none" aria-hidden>
                <rect x={1} y={1} width={9} height={9} rx={2} fill="#4f46e5" />
                <rect x={12} y={1} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
                <rect x={1} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
                <rect x={12} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.7} />
              </svg>
              <span className="text-sm font-semibold tracking-tight">Modulo</span>
            </Link>

            {isAuthenticated && (
              <>
                <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
                <NavLink to="/notes" className={linkClass}>Notes</NavLink>
                <NavLink to="/notes-graph" className={linkClass}>Graph</NavLink>
                <NavLink to="/contracts" className={linkClass}>Contracts</NavLink>
                <div className="group relative">
                  <NavLink to="/plugins/marketplace" className={linkClass}>
                    <span className="inline-flex items-center gap-1">
                      Marketplace
                      <ChevronDown className="size-3.5" />
                    </span>
                  </NavLink>
                  <div className="invisible absolute left-0 z-50 mt-1 w-48 origin-top rounded-lg border border-border-strong bg-popover p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                    <Link to="/plugins/marketplace" className="block rounded-md px-3 py-2 text-[13px] text-subtle-foreground transition-colors hover:bg-surface-2 hover:text-foreground">Browse Marketplace</Link>
                    <Link to="/plugins/submit" className="block rounded-md px-3 py-2 text-[13px] text-subtle-foreground transition-colors hover:bg-surface-2 hover:text-foreground">Submit Plugin</Link>
                    <Link to="/plugins/my-submissions" className="block rounded-md px-3 py-2 text-[13px] text-subtle-foreground transition-colors hover:bg-surface-2 hover:text-foreground">My Submissions</Link>
                  </div>
                </div>
              </>
            )}
            <NavLink to="/about" className={linkClass}>About</NavLink>
            <NavLink to="/settings" className={linkClass}>Settings</NavLink>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <NotificationBell userId={user?.id ?? 'current-user'} />
                <div className="flex items-center gap-2">
                  <Avatar src={user?.picture} name={user?.name} size={26} />
                  <span className="text-[13px] font-medium text-foreground max-sm:hidden">{user?.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="size-4" />
                  <span className="max-sm:hidden">Logout</span>
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => { window.location.href = '/login'; }}>
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
