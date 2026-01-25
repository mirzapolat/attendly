import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { CalendarDays, Home, Layers, Settings, Users } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { themeColors } from '@/hooks/useThemeColor';

const navItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Events', icon: CalendarDays },
  { to: '/seasons', label: 'Seasons', icon: Layers },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/workspace-settings', label: 'Workspace Settings', icon: Settings },
];

const WorkspaceSidebar = () => {
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

  // Save scroll position before navigation
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleScroll = () => {
      scrollPositionRef.current = nav.scrollLeft;
    };

    nav.addEventListener('scroll', handleScroll);
    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position after navigation
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      nav.scrollLeft = scrollPositionRef.current;
    });
  }, [location.pathname]);

  return (
    <aside className="border-r border-border bg-background/60 md:w-60">
      <div 
        className="group flex items-center gap-3 px-6 py-6 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg"
        onClick={() => navigate('/workspaces')}
      >
        <div
          className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold group-hover:animate-wiggle ${
            hasLogo ? 'overflow-hidden' : 'text-primary-foreground'
          }`}
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
        <div className="min-w-0">
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
        className="flex md:flex-col gap-1 px-6 md:px-3 pb-6 overflow-x-auto scrollbar-none"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default WorkspaceSidebar;
