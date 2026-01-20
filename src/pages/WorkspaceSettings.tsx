import { useEffect, useState } from 'react';
import { Trash2, Palette, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { themeColors } from '@/hooks/useThemeColor';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const WorkspaceSettings = () => {
  usePageTitle('Workspace Settings - Attendly');
  const { currentWorkspace, isOwner, refresh } = useWorkspace();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('default');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearingEvents, setClearingEvents] = useState(false);
  const [clearingSeasons, setClearingSeasons] = useState(false);
  const [removingMembers, setRemovingMembers] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setLogoUrl(currentWorkspace.brand_logo_url ?? '');
      setBrandColor(currentWorkspace.brand_color ?? 'default');
    }
  }, [currentWorkspace]);

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
      description: 'Your workspace settings have been saved.',
    });
  };

  const handleDelete = async () => {
    if (!currentWorkspace || !isOwner) return;

    if (!confirm('Delete this workspace? This will remove all events and seasons.')) {
      return;
    }

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

    if (!confirm('Delete all events in this workspace? This will remove attendance records too.')) {
      return;
    }

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

    if (!confirm('Delete all seasons in this workspace? Events will become unassigned.')) {
      return;
    }

    setClearingSeasons(true);
    const { error } = await supabase
      .from('seasons')
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
      title: 'Seasons deleted',
      description: 'All seasons in this workspace have been removed.',
    });
  };

  const handleRemoveAllMembers = async () => {
    if (!currentWorkspace || !isOwner) return;

    if (!confirm('Remove all members from this workspace? The owner will remain.')) {
      return;
    }

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
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Workspace settings</h1>

        <Card className="bg-gradient-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Brand profile
            </CardTitle>
            <CardDescription>Update the workspace brand details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
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
                <Input
                  id="workspaceLogo"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://"
                  disabled={!isOwner}
                />
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
                      style={{ backgroundColor: color.hex ?? `hsl(${color.hue ?? 160}, 84%, 39%)` }}
                      title={color.name}
                      disabled={!isOwner}
                    />
                  ))}
                </div>
              </div>
              {isOwner ? (
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only the workspace owner can update branding details.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {isOwner && (
          <>
            <Card className="border-destructive/40 bg-destructive/5 mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  Workspace cleanup
                </CardTitle>
                <CardDescription>
                  Remove data or members without deleting the workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={handleDeleteAllEvents}
                  disabled={clearingEvents}
                >
                  {clearingEvents ? 'Deleting events...' : 'Delete all events'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteAllSeasons}
                  disabled={clearingSeasons}
                >
                  {clearingSeasons ? 'Deleting seasons...' : 'Delete all seasons'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRemoveAllMembers}
                  disabled={removingMembers}
                >
                  {removingMembers ? 'Removing members...' : 'Remove all members'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" />
                  Delete workspace
                </CardTitle>
                <CardDescription>
                  This will permanently remove the workspace, events, seasons, and attendance data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete workspace'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </WorkspaceLayout>
  );
};

export default WorkspaceSettings;
