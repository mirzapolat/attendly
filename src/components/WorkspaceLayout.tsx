import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface WorkspaceLayoutProps {
  children: ReactNode;
  title?: string;
  requireWorkspace?: boolean;
  showSidebar?: boolean;
}

const WorkspaceLayout = ({
  children,
  title,
  requireWorkspace = true,
  showSidebar = true,
}: WorkspaceLayoutProps) => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  if (authLoading || (requireWorkspace && (workspaceLoading || !currentWorkspace))) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">
          {requireWorkspace && !workspaceLoading ? 'Preparing workspace...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh min-h-dvh bg-gradient-subtle overflow-hidden flex flex-col">
      <WorkspaceHeader title={title} />
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {showSidebar ? (
          <WorkspaceSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((prev) => !prev)}
          />
        ) : null}
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
