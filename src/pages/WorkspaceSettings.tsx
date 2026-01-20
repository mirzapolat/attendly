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
        )}
      </div>
    </WorkspaceLayout>
  );
};

export default WorkspaceSettings;
