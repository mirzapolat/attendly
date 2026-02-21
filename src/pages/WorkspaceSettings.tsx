import { useEffect, useRef, useState } from 'react';
import { Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { appPageTitle } from '@/constants/appBrand';
import { themeColors } from '@/hooks/useThemeColor';
import { useConfirm } from '@/hooks/useConfirm';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const WorkspaceSettings = () => {
  usePageTitle(appPageTitle('Workspace Settings'));
  const { currentWorkspace, isOwner, refresh } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('default');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearingEvents, setClearingEvents] = useState(false);
  const [clearingSeasons, setClearingSeasons] = useState(false);
  const [removingMembers, setRemovingMembers] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const logoPreviewRequestRef = useRef(0);
  const [isCompactScreen, setIsCompactScreen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setLogoUrl(currentWorkspace.brand_logo_url ?? '');
      setBrandColor(currentWorkspace.brand_color ?? 'default');
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactScreen(event.matches);
    };
    setIsCompactScreen(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const trimmed = logoUrl.trim();
    if (!trimmed) {
      setLogoPreviewUrl(null);
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      setLogoPreviewUrl(null);
      return;
    }

    const requestId = ++logoPreviewRequestRef.current;
    setLogoPreviewUrl(null);

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (logoPreviewRequestRef.current === requestId) {
        setLogoPreviewUrl(parsedUrl.toString());
      }
    };
    img.onerror = () => {
      if (logoPreviewRequestRef.current === requestId) {
        setLogoPreviewUrl(null);
      }
    };
    img.src = parsedUrl.toString();

    return () => {
      if (logoPreviewRequestRef.current === requestId) {
        logoPreviewRequestRef.current += 1;
      }
    };
  }, [logoUrl]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentWorkspace || !isOwner) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Workspace name required',
        description: 'Please enter a workspace name.',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('workspaces')
      .update({
        name: trimmedName,
        brand_logo_url: logoUrl.trim() || null,
        brand_color: brandColor,
      })
      .eq('id', currentWorkspace.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message,
      });
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    toast({
      title: 'Workspace updated',
      description: 'Your settings have been saved.',
    });
  };

  const handleDelete = async () => {
    if (!currentWorkspace || !isOwner) return;

    const confirmed = await confirm({
      title: 'Delete workspace?',
      description: 'This will remove all events and series in this workspace.',
      confirmText: 'Delete workspace',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setDeleting(true);
    const { error } = await supabase.from('workspaces').delete().eq('id', currentWorkspace.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
      setDeleting(false);
      return;
    }

    await refresh();
    setDeleting(false);
    toast({
      title: 'Workspace deleted',
      description: 'The workspace has been removed.',
    });
  };

  const handleDeleteAllEvents = async () => {
    if (!currentWorkspace || !isOwner) return;

    const confirmed = await confirm({
      title: 'Delete all events?',
      description: 'This will remove attendance records too.',
      confirmText: 'Delete events',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setClearingEvents(true);
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('workspace_id', currentWorkspace.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
      setClearingEvents(false);
      return;
    }

    setClearingEvents(false);
    toast({
      title: 'Events deleted',
      description: 'All events in this workspace have been removed.',
    });
  };

  const handleDeleteAllSeasons = async () => {
    if (!currentWorkspace || !isOwner) return;

    const confirmed = await confirm({
      title: 'Delete all series?',
      description: 'Events will become unassigned.',
      confirmText: 'Delete series',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setClearingSeasons(true);
    const { error } = await supabase
      .from('series')
      .delete()
      .eq('workspace_id', currentWorkspace.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error.message,
      });
      setClearingSeasons(false);
      return;
    }

    setClearingSeasons(false);
    toast({
      title: 'Series deleted',
      description: 'All series in this workspace have been removed.',
    });
  };

  const handleRemoveAllMembers = async () => {
    if (!currentWorkspace || !isOwner) return;

    const confirmed = await confirm({
      title: 'Remove all members?',
      description: 'The owner will remain.',
      confirmText: 'Remove members',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setRemovingMembers(true);
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', currentWorkspace.id)
      .neq('profile_id', currentWorkspace.owner_id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Remove failed',
        description: error.message,
      });
      setRemovingMembers(false);
      return;
    }

    setRemovingMembers(false);
    toast({
      title: 'Members removed',
      description: 'All members have been removed from this workspace.',
    });
  };

  return (
    <WorkspaceLayout title="Workspace settings">
      <div className="max-w-5xl space-y-4 sm:space-y-6">
        {isCompactScreen ? (
          <div className="mb-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-semibold">Workspace settings</h1>
            </div>
          </div>
        ) : (
          <div className="mb-2">
            <h1 className="text-xl font-bold sm:text-2xl">Workspace settings</h1>
          </div>
        )}

        <div
          className={cn(
            'space-y-4 sm:space-y-6',
            isOwner && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)] lg:items-start lg:gap-8 xl:gap-10 lg:space-y-0'
          )}
        >
          <form id="workspace-settings-form" onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input
                id="workspaceName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!isOwner}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspaceLogo">Brand logo (URL)</Label>
              <div className="flex items-center gap-3">
                {logoPreviewUrl && (
                  <div className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoPreviewUrl}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <Input
                  id="workspaceLogo"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://"
                  className="min-w-0 flex-1"
                  disabled={!isOwner}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Brand color</Label>
              <div className="flex flex-wrap gap-3">
                {themeColors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => isOwner && setBrandColor(color.id)}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${
                      brandColor === color.id ? 'border-foreground scale-105' : 'border-transparent'
                    } ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: color.hex ?? `hsl(${color.hue ?? 161}, 59%, 62%)` }}
                    title={color.name}
                    disabled={!isOwner}
                  />
                ))}
              </div>
            </div>
            {isOwner ? (
              <Button type="submit" disabled={saving} className="w-full gap-2 sm:w-auto">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the workspace owner can update branding details.
              </p>
            )}
          </form>

          {isOwner ? (
            <div className="mt-8 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-8">
              <Card className="border-destructive/35 bg-destructive/[0.04]">
                <CardHeader className={cn(isCompactScreen && 'p-3.5 pb-2')}>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="w-5 h-5" />
                    Workspace cleanup
                  </CardTitle>
                  <CardDescription>
                    Remove data or members without deleting the workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn('flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3', isCompactScreen && 'p-3.5 pt-0')}>
                  <Button
                    variant="outline"
                    onClick={handleDeleteAllEvents}
                    disabled={clearingEvents}
                    className="w-full sm:w-auto"
                  >
                    {clearingEvents ? 'Deleting events...' : 'Delete all events'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDeleteAllSeasons}
                    disabled={clearingSeasons}
                    className="w-full sm:w-auto"
                  >
                    {clearingSeasons ? 'Deleting series...' : 'Delete all series'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRemoveAllMembers}
                    disabled={removingMembers}
                    className="w-full sm:w-auto"
                  >
                    {removingMembers ? 'Removing members...' : 'Remove all members'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-destructive/35 bg-destructive/[0.04]">
                <CardHeader className={cn(isCompactScreen && 'p-3.5 pb-2')}>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="w-5 h-5" />
                    Delete workspace
                  </CardTitle>
                  <CardDescription>
                    This will permanently remove the workspace, events, series, and attendance data.
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn(isCompactScreen && 'p-3.5 pt-0')}>
                  <Button variant="destructive" className="w-full sm:w-auto" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete workspace'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </WorkspaceLayout>
  );
};

export default WorkspaceSettings;
