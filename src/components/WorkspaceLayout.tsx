import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';

interface WorkspaceLayoutProps {
  children: ReactNode;
  title?: string;
}

const WorkspaceLayout = ({ children, title }: WorkspaceLayoutProps) => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && user && !workspaceLoading && !currentWorkspace) {
      navigate('/workspaces');
    }
  }, [authLoading, user, workspaceLoading, currentWorkspace, navigate]);

  if (authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <WorkspaceHeader title={title} />
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
        <WorkspaceSidebar />
        <main className="flex-1">
          <div className="container mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
