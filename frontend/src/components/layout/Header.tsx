import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Settings as SettingsIcon } from 'lucide-react';
import { ModuloMark } from '../../features/home/brand';
import { useAuth } from '../../features/auth/useAuth';
import NotificationBell from '../../features/notes/collab/NotificationBell';
import { ThemeToggle } from '../theme';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  cn,
} from '@/ui';

/** Primary destinations — the note-workbench app routes. */
const PRIMARY_LINKS = [
  { label: 'Notes', to: '/app/notes' },
  { label: 'Graph', to: '/app/graph' },
  { label: 'Dashboard', to: '/app/dashboard' },
  { label: 'Marketplace', to: '/app/marketplace' },
] as const;

/** Secondary destinations, tucked into the "More" menu on desktop. */
const MORE_LINKS = [
  { label: 'Blueprints', to: '/blueprints' },
  { label: 'Packs', to: '/packs' },
  { label: 'Contracts', to: '/contracts' },
  { label: 'About', to: '/about' },
] as const;

/** First letters of up to two name words, uppercase; '?' when no name. */
const initialsOf = (name?: string | null): string => {
  if (!name) return '?';
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
  return letters || '?';
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
    isActive ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
  );

const sheetLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
  );

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isMoreActive = MORE_LINKS.some((link) => pathname.startsWith(link.to));

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-6 max-md:px-4">
        {/* Mobile nav — hamburger opening a left sheet with the full IA. */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
            <SheetHeader className="border-b border-border px-4 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-[15px] tracking-tight">
                <ModuloMark size={20} className="text-primary" />
                Modulo
              </SheetTitle>
              <SheetDescription className="sr-only">Main navigation</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              {isAuthenticated ? (
                <>
                  {PRIMARY_LINKS.map((link) => (
                    <NavLink key={link.to} to={link.to} className={sheetLinkClass}>
                      {link.label}
                    </NavLink>
                  ))}
                  <Separator className="my-2" />
                  {MORE_LINKS.map((link) => (
                    <NavLink key={link.to} to={link.to} className={sheetLinkClass}>
                      {link.label}
                    </NavLink>
                  ))}
                </>
              ) : (
                <NavLink to="/about" className={sheetLinkClass}>
                  About
                </NavLink>
              )}
              <NavLink to="/settings" className={sheetLinkClass}>
                Settings
              </NavLink>
            </nav>
            <div className="border-t border-border p-4">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? 'User avatar'} />
                    <AvatarFallback className="text-[11px]">{initialsOf(user?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">{user?.name}</div>
                    {user?.email && <div className="truncate text-xxs text-muted-foreground">{user.email}</div>}
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => logout()} aria-label="Logout">
                    <LogOut />
                  </Button>
                </div>
              ) : (
                <Button className="w-full" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Brand */}
        <Link
          to="/app/notes"
          className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
        >
          <ModuloMark size={22} className="text-primary" />
          <span className="text-[15px] font-semibold tracking-tight">Modulo</span>
        </Link>

        {/* Desktop primary nav */}
        <nav aria-label="Primary" className="ml-3 flex items-center gap-1 max-md:hidden">
          {isAuthenticated ? (
            <>
              {PRIMARY_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    navLinkClass({ isActive: isMoreActive }),
                    'inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  More
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {MORE_LINKS.map((link) => (
                    <DropdownMenuItem key={link.to} asChild>
                      <Link
                        to={link.to}
                        className={cn('cursor-pointer', pathname.startsWith(link.to) && 'text-foreground')}
                      >
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
          )}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5">
          {isAuthenticated && <NotificationBell userId={user?.id ?? 'current-user'} />}
          <ThemeToggle />
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Account menu"
                  className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Avatar className="size-7">
                    <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? 'User avatar'} />
                    <AvatarFallback className="text-[10px]">{initialsOf(user?.name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="truncate text-[13px] font-medium text-foreground">{user?.name ?? 'Account'}</div>
                  {user?.email && (
                    <div className="truncate text-xxs font-normal text-muted-foreground">{user.email}</div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <SettingsIcon />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout()}>
                  <LogOut />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
