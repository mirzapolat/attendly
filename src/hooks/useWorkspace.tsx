import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type Workspace = {
  id: string;
  name: string;
  brand_logo_url: string | null;
  brand_color: string | null;
  owner_id: string;
};

interface WorkspaceContextType {
  workspaces: Workspace[];
  ownedWorkspaces: Workspace[];
  joinedWorkspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | null;
  isOwner: boolean;
  loading: boolean;
  selectWorkspace: (workspaceId: string) => void;
  clearWorkspace: () => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = 'attendly:workspace';

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ownedWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.owner_id === user?.id),
    [workspaces, user?.id]
  );

  const joinedWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.owner_id !== user?.id),
    [workspaces, user?.id]
  );

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? null,
    [workspaces, currentWorkspaceId]
  );

  const isOwner = Boolean(currentWorkspace && currentWorkspace.owner_id === user?.id);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!currentWorkspaceId) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, currentWorkspaceId);
  }, [currentWorkspaceId, user]);

  const refresh = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('profile_id', user.id);

    if (membershipError) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      return;
    }

    const workspaceIds = memberships?.map((member) => member.workspace_id) ?? [];

    if (workspaceIds.length === 0) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      return;
    }

    const { data: workspaceData } = await supabase
      .from('workspaces')
      .select('id, name, brand_logo_url, brand_color, owner_id')
      .in('id', workspaceIds)
      .order('created_at', { ascending: false });

    const resolved = (workspaceData ?? []) as Workspace[];
    setWorkspaces(resolved);

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && resolved.some((workspace) => workspace.id === stored)) {
      setCurrentWorkspaceId(stored);
    } else {
      setCurrentWorkspaceId(null);
    }
    setLoading(false);
  };

  const selectWorkspace = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
  };

  const clearWorkspace = () => {
    setCurrentWorkspaceId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        ownedWorkspaces,
        joinedWorkspaces,
        currentWorkspace,
        currentWorkspaceId,
        isOwner,
        loading,
        selectWorkspace,
        clearWorkspace,
        refresh,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
