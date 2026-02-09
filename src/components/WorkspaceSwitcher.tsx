import { useEffect, useState } from 'react';
import { Check, ChevronDown, LogOut, Plus, Search, Settings, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace, type Workspace } from '@/hooks/useWorkspace';
import { themeColors } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface WorkspaceSwitcherProps {
  compact?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
  centered?: boolean;
}

const PRESERVED_ROUTES = new Set([
  '/dashboard',
  '/series',
  '/members',
  '/workspace-settings',
  '/events/new',
]);

const getWorkspaceColor = (colorId: string | null) =>
  themeColors.find((item) => item.id === colorId)?.hex ?? 'hsl(var(--primary))';

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const WorkspaceAvatar = ({ workspace, sizeClass }: { workspace: Workspace; sizeClass?: string }) => {
  const hasLogo = Boolean(workspace.brand_logo_url);

  return (
    <div
      className={cn(
        'shrink-0 rounded-lg flex items-center justify-center text-xs font-semibold',
        hasLogo ? 'overflow-hidden' : 'text-primary-foreground',
        sizeClass ?? 'h-8 w-8'
      )}
      style={hasLogo ? undefined : { backgroundColor: getWorkspaceColor(workspace.brand_color) }}
    >
      {hasLogo ? (
        <img src={workspace.brand_logo_url as string} alt={workspace.name} className="h-full w-full object-cover" />
      ) : (
        getInitials(workspace.name)
      )}
    </div>
  );
};

const WorkspaceRow = ({
  workspace,
  currentWorkspaceId,
  onSelect,
}: {
  workspace: Workspace;
  currentWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
}) => {
  const isCurrent = workspace.id === currentWorkspaceId;

  return (
    <button
      type="button"
      onClick={() => onSelect(workspace.id)}
      className={cn(
        'w-full rounded-md px-2 py-2 text-left transition-colors flex items-center gap-2',
        isCurrent ? 'bg-primary/10 text-foreground' : 'hover:bg-muted text-foreground'
      )}
    >
      <WorkspaceAvatar workspace={workspace} />
      <span className="min-w-0 flex-1 text-sm font-medium truncate">{workspace.name}</span>
      {isCurrent ? <Check className="h-4 w-4 text-primary" /> : null}
    </button>
  );
};

const WorkspaceSwitcher = ({
  compact = false,
  className,
  align = 'start',
  centered = false,
}: WorkspaceSwitcherProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    currentWorkspace,
    currentWorkspaceId,
    workspaces,
    ownedWorkspaces,
    joinedWorkspaces,
    selectWorkspace,
    refresh,
  } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState(themeColors[0]?.id ?? 'default');
  const [creating, setCreating] = useState(false);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);
  const [leavingWorkspaceId, setLeavingWorkspaceId] = useState<string | null>(null);
  const [workspaceMemberCounts, setWorkspaceMemberCounts] = useState<Map<string, number>>(new Map());

  const activeWorkspace = currentWorkspace ?? workspaces[0] ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const canDeleteWorkspace = workspaces.length > 1;
  const getWorkspaceMembershipLabel = (workspaceId: string) => {
    const memberCount = workspaceMemberCounts.get(workspaceId) ?? 1;
    if (memberCount <= 1) return 'Private workspace';
    return `${memberCount} members`;
  };

  useEffect(() => {
    if (!manageDialogOpen) return;
    const workspaceIds = workspaces.map((workspace) => workspace.id);
    if (workspaceIds.length === 0) {
      setWorkspaceMemberCounts(new Map());
      return;
    }

    const fetchMemberCounts = async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .in('workspace_id', workspaceIds);

      if (error) return;

      const counts = new Map<string, number>();
      (data ?? []).forEach((row) => {
        counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
      });
      setWorkspaceMemberCounts(counts);
    };

    void fetchMemberCounts();
  }, [manageDialogOpen, workspaces]);

  const filterWorkspaces = (list: Workspace[]) => {
    if (!normalizedQuery) return list;
    return list.filter((workspace) => workspace.name.toLowerCase().includes(normalizedQuery));
  };

  const filteredOwned = filterWorkspaces(ownedWorkspaces);
  const filteredJoined = filterWorkspaces(joinedWorkspaces);

  const closeMenu = () => {
    setOpen(false);
    setQuery('');
  };

  const openCreateDialog = () => {
    closeMenu();
    setCreateDialogOpen(true);
  };

  const openManageDialog = () => {
    closeMenu();
    setManageDialogOpen(true);
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    closeMenu();

    if (!PRESERVED_ROUTES.has(location.pathname)) {
      navigate('/dashboard');
    }
  };

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Workspace name required',
        description: 'Please enter a workspace name to continue.',
      });
      return;
    }

    setCreating(true);

    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: trimmedName,
        brand_logo_url: logoUrl.trim() || null,
        brand_color: brandColor,
        owner_id: user.id,
      })
      .select('id')
      .maybeSingle();

    if (error || !data) {
      toast({
        variant: 'destructive',
        title: 'Workspace creation failed',
        description: error?.message ?? 'Unable to create the workspace.',
      });
      setCreating(false);
      return;
    }

    const { error: memberError } = await supabase.from('workspace_members').insert({
      workspace_id: data.id,
      profile_id: user.id,
    });

    if (memberError) {
      toast({
        variant: 'destructive',
        title: 'Workspace created',
        description: memberError.message,
      });
    }

    await refresh();
    selectWorkspace(data.id);
    setWorkspaceName('');
    setLogoUrl('');
    setBrandColor(themeColors[0]?.id ?? 'default');
    setCreateDialogOpen(false);
    setCreating(false);
    navigate('/dashboard');
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (!canDeleteWorkspace) {
      toast({
        variant: 'destructive',
        title: 'Workspace required',
        description: 'At least one workspace must exist at all times.',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Delete workspace?',
      description: `Delete ${workspace.name}? This will remove all events and series in this workspace.`,
      confirmText: 'Delete workspace',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    setDeletingWorkspaceId(workspace.id);
    const { error } = await supabase.from('workspaces').delete().eq('id', workspace.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
      setDeletingWorkspaceId(null);
      return;
    }

    await refresh();
    setDeletingWorkspaceId(null);
    toast({
      title: 'Workspace deleted',
      description: `${workspace.name} was removed.`,
    });
  };

  const handleLeaveWorkspace = async (workspace: Workspace) => {
    if (!user) return;

    if (!canDeleteWorkspace) {
      toast({
        variant: 'destructive',
        title: 'Workspace required',
        description: 'At least one workspace must exist at all times.',
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Leave workspace?',
      description: `Leave ${workspace.name}? You will lose access to this workspace.`,
      confirmText: 'Leave workspace',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) return;

    setLeavingWorkspaceId(workspace.id);
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('profile_id', user.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Leave failed',
        description: error.message,
      });
      setLeavingWorkspaceId(null);
      return;
    }

    await refresh();
    setLeavingWorkspaceId(null);
    toast({
      title: 'Workspace left',
      description: `You left ${workspace.name}.`,
    });
  };

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery('');
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={compact ? 'ghost' : 'outline'}
            className={cn(
              'max-w-full',
              compact
                ? 'h-9 w-9 justify-center p-0'
                : cn(
                    'h-auto min-h-12 justify-start gap-2 whitespace-normal px-3 py-2 items-start',
                    centered && 'items-center'
                  ),
              className
            )}
            title="Switch workspace"
          >
            {activeWorkspace ? (
              <WorkspaceAvatar workspace={activeWorkspace} sizeClass={compact ? 'h-7 w-7' : 'h-8 w-8'} />
            ) : (
              <div className={cn('rounded-lg bg-muted', compact ? 'h-7 w-7' : 'h-8 w-8')} />
            )}
            {!compact ? (
              <>
                <span
                  className="min-w-0 flex-1 text-left text-sm leading-tight"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {activeWorkspace?.name ?? 'Select workspace'}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
              </>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-[320px] p-2">
          <div className="relative px-1 pb-2">
            <Search className="pointer-events-none absolute left-4 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 pl-8"
              placeholder="Search workspaces"
              aria-label="Search workspaces"
            />
          </div>

          {filteredOwned.length > 0 ? (
            <div className="px-1 pb-2">
              <p className="px-2 pb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Owned</p>
              <div className="space-y-1">
                {filteredOwned.map((workspace) => (
                  <WorkspaceRow
                    key={workspace.id}
                    workspace={workspace}
                    currentWorkspaceId={currentWorkspaceId}
                    onSelect={handleWorkspaceSelect}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {filteredJoined.length > 0 ? (
            <div className="px-1 pb-1">
              <p className="px-2 pb-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Joined</p>
              <div className="space-y-1">
                {filteredJoined.map((workspace) => (
                  <WorkspaceRow
                    key={workspace.id}
                    workspace={workspace}
                    currentWorkspaceId={currentWorkspaceId}
                    onSelect={handleWorkspaceSelect}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {filteredOwned.length + filteredJoined.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {workspaces.length === 0 ? 'No workspaces available.' : 'No workspaces match your search.'}
            </p>
          ) : null}

          <DropdownMenuSeparator />
          <div className="space-y-1 px-1 pb-1">
            <button
              type="button"
              onClick={openCreateDialog}
              className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted flex items-center gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Create workspace
            </button>
            <button
              type="button"
              onClick={openManageDialog}
              className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted flex items-center gap-2 text-sm"
            >
              <Settings className="h-4 w-4" />
              Manage workspaces
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input
                id="workspaceName"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Acme Events"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspaceLogo">Brand logo (URL)</Label>
              <Input
                id="workspaceLogo"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Brand color</Label>
              <div className="flex flex-wrap gap-3">
                {themeColors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setBrandColor(color.id)}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${
                      brandColor === color.id ? 'border-foreground scale-105' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.hex ?? `hsl(${color.hue ?? 161}, 59%, 62%)` }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? 'Creating...' : 'Create workspace'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage workspaces</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {ownedWorkspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">You do not own any workspaces.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground px-1">Owned</p>
                {ownedWorkspaces.map((workspace) => {
                  const deleting = deletingWorkspaceId === workspace.id;
                  return (
                    <div
                      key={workspace.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2"
                    >
                      <div className="min-w-0 flex flex-1 items-start gap-3">
                        <WorkspaceAvatar workspace={workspace} sizeClass="h-9 w-9" />
                        <div className="min-w-0">
                          <p className="font-medium leading-tight whitespace-normal break-words">{workspace.name}</p>
                          <p className="text-xs text-muted-foreground">{getWorkspaceMembershipLabel(workspace.id)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-destructive hover:text-destructive"
                        disabled={deleting || !canDeleteWorkspace}
                        onClick={() => handleDeleteWorkspace(workspace)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleting ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            {joinedWorkspaces.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground px-1">Joined</p>
                {joinedWorkspaces.map((workspace) => {
                  const leaving = leavingWorkspaceId === workspace.id;
                  return (
                    <div
                      key={workspace.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2"
                    >
                      <div className="min-w-0 flex flex-1 items-start gap-3">
                        <WorkspaceAvatar workspace={workspace} sizeClass="h-9 w-9" />
                        <div className="min-w-0">
                          <p className="font-medium leading-tight whitespace-normal break-words">{workspace.name}</p>
                          <p className="text-xs text-muted-foreground">{getWorkspaceMembershipLabel(workspace.id)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-destructive hover:text-destructive"
                        disabled={leaving || !canDeleteWorkspace}
                        onClick={() => handleLeaveWorkspace(workspace)}
                      >
                        <LogOut className="h-4 w-4" />
                        {leaving ? 'Leaving...' : 'Leave'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkspaceSwitcher;
