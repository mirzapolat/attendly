import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import { applyThemeColor, themeColors, useThemeColor } from '@/hooks/useThemeColor';

const Workspaces = () => {
  usePageTitle('Workspaces - Attendly');
  const { user, loading: authLoading } = useAuth();
  const { ownedWorkspaces, joinedWorkspaces, selectWorkspace, refresh, loading } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { themeColor } = useThemeColor();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState(themeColors[0]?.id ?? 'default');
  const [creating, setCreating] = useState(false);
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    applyThemeColor('default');
    return () => applyThemeColor(themeColor);
  }, [themeColor]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        setViewMode('list');
      }
    };
    handleChange(media);
    const listener = (event: MediaQueryListEvent) => handleChange(event);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, []);

  useEffect(() => {
    if (ownedWorkspaces.length + joinedWorkspaces.length === 0) {
      setMemberCounts(new Map());
      return;
    }
    fetchMemberCounts();
  }, [ownedWorkspaces, joinedWorkspaces]);

  const fetchMemberCounts = async () => {
    const workspaceIds = [...ownedWorkspaces, ...joinedWorkspaces].map((workspace) => workspace.id);
    if (workspaceIds.length === 0) return;

    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .in('workspace_id', workspaceIds);

    if (error) {
      return;
    }

    const counts = new Map<string, number>();
    (data ?? []).forEach((row) => {
      counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
    });
    setMemberCounts(counts);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    navigate('/home');
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

    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
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
    setDialogOpen(false);
    setCreating(false);
    navigate('/home');
  };

  const hasWorkspaces = ownedWorkspaces.length + joinedWorkspaces.length > 0;

  const renderWorkspaceCard = (
    id: string,
    name: string,
    logo: string | null,
    colorId: string | null,
    memberCount?: number
  ) => {
    const color = themeColors.find((item) => item.id === colorId);
    const initials = name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const hasLogo = Boolean(logo);

    const content = (
      <Card className="bg-gradient-card hover:shadow-md transition-shadow">
        <CardContent className="p-5 flex items-center gap-4">
          <div
            className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold ${
              hasLogo ? 'overflow-hidden' : 'text-primary-foreground'
            }`}
            style={hasLogo ? undefined : { backgroundColor: color?.hex ?? 'hsl(var(--primary))' }}
          >
            {hasLogo ? (
              <img src={logo as string} alt={name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Select workspace</span>
              {memberCount && memberCount > 1 && (
                <>
                  <span aria-hidden="true">•</span>
                  <span>{memberCount} members</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );

    return (
      <button
        type="button"
        key={id}
        onClick={() => handleSelectWorkspace(id)}
        className="text-left"
      >
        {content}
      </button>
    );
  };

  const workspaceLayoutClass = useMemo(() => {
    return viewMode === 'grid'
      ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
      : 'flex flex-col gap-3';
  }, [viewMode]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <WorkspaceHeader showChangeWorkspace={false} withContainer />
      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Workspaces</h1>
            <p className="text-muted-foreground">Choose where you want to manage events.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border p-1">
              <Button
                type="button"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4" />
                  Create workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Workspace</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateWorkspace} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspaceName">Workspace name</Label>
                    <Input
                      id="workspaceName"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Acme Events"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspaceLogo">Brand logo (URL)</Label>
                    <Input
                      id="workspaceLogo"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
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
                          style={{ backgroundColor: color.hex ?? `hsl(${color.hue ?? 160}, 84%, 39%)` }}
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
          </div>
        </div>

        {!hasWorkspaces && (
          <Card className="bg-gradient-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                You do not belong to any workspaces yet. Create one to get started.
              </p>
              <Button onClick={() => setDialogOpen(true)}>Create workspace</Button>
            </CardContent>
          </Card>
        )}

        {ownedWorkspaces.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Owned Workspaces</h2>
              <span className="text-sm text-muted-foreground">{ownedWorkspaces.length}</span>
            </div>
            <div className={workspaceLayoutClass}>
              {ownedWorkspaces.map((workspace) =>
                renderWorkspaceCard(
                  workspace.id,
                  workspace.name,
                  workspace.brand_logo_url,
                  workspace.brand_color,
                  memberCounts.get(workspace.id)
                )
              )}
            </div>
          </section>
        )}

        {joinedWorkspaces.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Joined Workspaces</h2>
              <span className="text-sm text-muted-foreground">{joinedWorkspaces.length}</span>
            </div>
            <div className={workspaceLayoutClass}>
              {joinedWorkspaces.map((workspace) =>
                renderWorkspaceCard(
                  workspace.id,
                  workspace.name,
                  workspace.brand_logo_url,
                  workspace.brand_color,
                  memberCounts.get(workspace.id)
                )
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Workspaces;
