import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { persistWorkspaceCookie, readWorkspaceCookie } from '@/lib/workspaceCookie';

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
const WORKSPACE_MEMBERSHIP_FETCH_LIMIT = 1000;
const WORKSPACE_LIST_FETCH_LIMIT = 300;

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

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

  const isOwner = useMemo(
    () => Boolean(currentWorkspace && currentWorkspace.owner_id === user?.id),
    [currentWorkspace, user?.id],
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!hydrated) {
      return;
    }
    if (!currentWorkspaceId) {
      localStorage.removeItem(STORAGE_KEYS.workspaceId);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.workspaceId, currentWorkspaceId);
    persistWorkspaceCookie(currentWorkspaceId);
  }, [currentWorkspaceId, user, hydrated]);

  const resolveDefaultWorkspaceName = useCallback(() => {
    const metadataName =
      typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
    const fallbackEmailName = user?.email?.split('@')[0]?.trim() ?? '';
    const source = metadataName || fallbackEmailName;
    const normalized =
      source
        .replace(/[._-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0] ?? 'My';
    const name = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return `${name}'s Workspace`;
  }, [user]);

  const createDefaultWorkspace = useCallback(async () => {
    if (!user) {
      return null;
    }

    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: resolveDefaultWorkspaceName(),
        owner_id: user.id,
        brand_color: 'default',
      })
      .select('id, name, brand_logo_url, brand_color, owner_id')
      .maybeSingle();

    if (workspaceError || !workspaceData) {
      return null;
    }

    await supabase.from('workspace_members').insert({
      workspace_id: workspaceData.id,
      profile_id: user.id,
    });

    return workspaceData as Workspace;
  }, [resolveDefaultWorkspaceName, user]);

  const fetchOwnedFallbackWorkspaces = useCallback(async () => {
    if (!user) {
      return [] as Workspace[];
    }

    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, brand_logo_url, brand_color, owner_id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(WORKSPACE_LIST_FETCH_LIMIT);

    if (error) {
      return [] as Workspace[];
    }

    return (data ?? []) as Workspace[];
  }, [user]);

  const applyResolvedWorkspaces = useCallback((resolved: Workspace[]) => {
    setWorkspaces(resolved);

    const stored = localStorage.getItem(STORAGE_KEYS.workspaceId);
    const cookieStored = readWorkspaceCookie();
    const preferredWorkspaceId =
      (stored && resolved.some((workspace) => workspace.id === stored) && stored) ||
      (cookieStored && resolved.some((workspace) => workspace.id === cookieStored) && cookieStored) ||
      null;
    const hasCurrentWorkspace =
      currentWorkspaceId && resolved.some((workspace) => workspace.id === currentWorkspaceId);

    if (preferredWorkspaceId) {
      setCurrentWorkspaceId(preferredWorkspaceId);
    } else if (hasCurrentWorkspace && currentWorkspaceId) {
      setCurrentWorkspaceId(currentWorkspaceId);
    } else {
      setCurrentWorkspaceId(resolved[0]?.id ?? null);
    }
  }, [currentWorkspaceId]);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      setHydrated(true);
      return;
    }

    setLoading(true);
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('profile_id', user.id)
      .limit(WORKSPACE_MEMBERSHIP_FETCH_LIMIT);

    if (membershipError) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      setHydrated(true);
      return;
    }

    const workspaceIds = memberships?.map((member) => member.workspace_id) ?? [];

    if (workspaceIds.length === 0) {
      const ownedFallback = await fetchOwnedFallbackWorkspaces();
      if (ownedFallback.length > 0) {
        applyResolvedWorkspaces(ownedFallback);
        setLoading(false);
        setHydrated(true);
        return;
      }

      const defaultWorkspace = await createDefaultWorkspace();
      if (defaultWorkspace) {
        setWorkspaces([defaultWorkspace]);
        setCurrentWorkspaceId(defaultWorkspace.id);
      } else {
        setWorkspaces([]);
        setCurrentWorkspaceId(null);
      }
      setLoading(false);
      setHydrated(true);
      return;
    }

    const { data: workspaceData } = await supabase
      .from('workspaces')
      .select('id, name, brand_logo_url, brand_color, owner_id')
      .in('id', workspaceIds)
      .order('created_at', { ascending: false })
      .limit(WORKSPACE_LIST_FETCH_LIMIT);

    const resolved = (workspaceData ?? []) as Workspace[];
    if (resolved.length > 0) {
      applyResolvedWorkspaces(resolved);
      setLoading(false);
      setHydrated(true);
      return;
    }

    const ownedFallback = await fetchOwnedFallbackWorkspaces();
    if (ownedFallback.length > 0) {
      applyResolvedWorkspaces(ownedFallback);
      setLoading(false);
      setHydrated(true);
      return;
    }

    const defaultWorkspace = await createDefaultWorkspace();
    if (defaultWorkspace) {
      setWorkspaces([defaultWorkspace]);
      setCurrentWorkspaceId(defaultWorkspace.id);
    } else {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
    }

    setLoading(false);
    setHydrated(true);
  }, [applyResolvedWorkspaces, createDefaultWorkspace, fetchOwnedFallbackWorkspaces, user]);

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      setHydrated(true);
      return;
    }
    void refresh();
  }, [user, refresh]);

  const selectWorkspace = useCallback((workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId);
  }, []);

  const clearWorkspace = useCallback(() => {
    setCurrentWorkspaceId(null);
    localStorage.removeItem(STORAGE_KEYS.workspaceId);
  }, []);

  const contextValue = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  return (
    <WorkspaceContext.Provider value={contextValue}>
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
