import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Home, Layers, Settings, Users } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { themeColors } from '@/hooks/useThemeColor';
import { cn } from '@/lib/utils';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const navItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Events', icon: CalendarDays },
  { to: '/seasons', label: 'Seasons', icon: Layers },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/workspace-settings', label: 'Workspace Settings', icon: Settings },
];

interface WorkspaceSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const WorkspaceSidebar = ({ collapsed = false, onToggle }: WorkspaceSidebarProps) => {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const color = themeColors.find((item) => item.id === currentWorkspace?.brand_color);

  const initials = currentWorkspace?.name
    ? currentWorkspace.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'WS';

  const hasLogo = Boolean(currentWorkspace?.brand_logo_url);

  // Save and restore scroll position for the mobile horizontal nav.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const saved = sessionStorage.getItem(STORAGE_KEYS.sidebarScroll);
    if (saved) {
      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        nav.scrollLeft = parsed;
        scrollPositionRef.current = parsed;
      }
    }

    const handleScroll = () => {
      scrollPositionRef.current = nav.scrollLeft;
      sessionStorage.setItem(STORAGE_KEYS.sidebarScroll, String(nav.scrollLeft));
    };

    nav.addEventListener('scroll', handleScroll);
    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position after navigation
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const saved = sessionStorage.getItem(STORAGE_KEYS.sidebarScroll);
    const scrollLeft = saved ? Number(saved) : scrollPositionRef.current;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      nav.scrollLeft = Number.isFinite(scrollLeft) ? scrollLeft : 0;
    });
  }, [location.pathname]);

  return (
    <aside
      className={cn(
        "relative border-r border-border bg-background/60 transition-[width] duration-300 ease-out md:overflow-visible md:self-start md:flex md:flex-col md:h-full md:min-h-0",
        collapsed ? "md:w-[82px]" : "md:w-60",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle?.()}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "sidebar-toggle hidden md:flex items-center justify-center absolute -right-3 top-6 h-8 w-8 rounded-full border border-border bg-background/80 text-muted-foreground shadow-md transition-all duration-200 hover:text-foreground hover:shadow-lg backdrop-blur z-20",
          collapsed
            ? "translate-x-1 bg-background/95 text-foreground border-border shadow-lg ring-2 ring-primary/25"
            : "translate-x-0",
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 sidebar-toggle-icon" />
        ) : (
          <ChevronLeft className="h-4 w-4 sidebar-toggle-icon" />
        )}
      </button>
      <div
        className={cn(
          "group flex items-center gap-3 px-6 py-6 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg md:shrink-0",
          collapsed && "md:px-3 md:justify-center md:gap-0",
        )}
        onClick={() => navigate('/workspaces')}
      >
        <div
          className={cn(
            "h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold group-hover:animate-wiggle",
            hasLogo ? "overflow-hidden" : "text-primary-foreground",
          )}
          style={hasLogo ? undefined : { backgroundColor: color?.hex ?? 'hsl(var(--primary))' }}
        >
          {hasLogo ? (
            <img
              src={currentWorkspace!.brand_logo_url as string}
              alt={currentWorkspace!.name}
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div
          className={cn(
            "min-w-0 transition-all duration-200",
            collapsed && "md:w-0 md:opacity-0 md:translate-x-2 md:overflow-hidden md:pointer-events-none",
          )}
        >
          <p
            className="font-semibold leading-snug break-words"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {currentWorkspace?.name ?? 'Unknown'}
          </p>
          <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">Switch Space</p>
        </div>
      </div>
      <nav 
        ref={navRef}
        className={cn(
          "flex md:flex-col gap-1 px-6 pb-6 overflow-x-auto scrollbar-none transition-all duration-200 md:overflow-y-auto md:overflow-x-hidden md:pr-2 md:flex-1 md:min-h-0",
          collapsed ? "md:px-2" : "md:px-3",
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSettings = item.icon === Settings;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                  collapsed && "md:justify-center md:gap-0 md:px-2",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  isSettings && "gear-trigger",
                )
              }
            >
              <Icon className={`w-4 h-4${isSettings ? ' gear-icon' : ''}`} />
              <span
                className={cn(
                  "transition-all duration-200",
                  collapsed && "md:w-0 md:opacity-0 md:translate-x-2 md:overflow-hidden",
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default WorkspaceSidebar;
