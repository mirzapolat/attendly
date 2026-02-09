import { NavLink } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Layers, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';

const navItems = [
  { to: '/dashboard', label: 'Events', icon: CalendarDays },
  { to: '/series', label: 'Series', icon: Layers },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/workspace-settings', label: 'Settings', icon: Settings },
];

interface WorkspaceSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const WorkspaceSidebar = ({ collapsed = false, onToggle }: WorkspaceSidebarProps) => {
  return (
    <aside
      className={cn(
        "relative border-b border-border bg-background/60 transition-[width] duration-300 ease-out md:border-b-0 md:border-r md:overflow-visible md:self-start md:flex md:flex-col md:h-full md:min-h-0",
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
          "hidden md:block md:shrink-0 md:py-4",
          collapsed ? "md:px-2" : "md:px-3"
        )}
      >
        <WorkspaceSwitcher
          compact={collapsed}
          centered={!collapsed}
          className={cn(
            "w-full",
            collapsed
              ? "md:h-10 md:w-full md:justify-center md:rounded-full md:px-2"
              : "md:min-h-10 md:justify-start md:rounded-full md:border-0 md:bg-transparent md:shadow-none md:px-3 md:py-2 md:hover:bg-muted"
          )}
          align="start"
        />
      </div>
      <nav
        className={cn(
          "grid grid-cols-4 gap-1 px-2 py-2 transition-all duration-200 md:flex md:flex-col md:gap-1 md:py-0 md:pb-6 md:overflow-y-auto md:overflow-x-hidden md:pr-2 md:flex-1 md:min-h-0",
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
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium leading-tight transition-colors text-center",
                  "md:min-h-0 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:rounded-full md:text-sm md:whitespace-nowrap md:text-left",
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
