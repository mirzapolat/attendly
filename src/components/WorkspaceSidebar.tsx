import { NavLink } from 'react-router-dom';
import { CalendarDays, Layers, Settings, Users } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { themeColors } from '@/hooks/useThemeColor';

const navItems = [
  { to: '/dashboard', label: 'Events', icon: CalendarDays },
  { to: '/seasons', label: 'Seasons', icon: Layers },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/workspace-settings', label: 'Workspace Settings', icon: Settings },
];

const WorkspaceSidebar = () => {
  const { currentWorkspace } = useWorkspace();
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

  return (
    <aside className="border-r border-border bg-background/60 md:w-60">
      <div className="flex items-center gap-3 px-6 py-6">
        <div
          className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold ${
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
          <p className="text-sm text-muted-foreground">Workspace</p>
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
        </div>
      </div>
      <nav className="flex md:flex-col gap-1 px-3 pb-6 overflow-x-auto">
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
