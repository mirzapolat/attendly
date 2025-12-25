import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, Copy, Trash2, Link as LinkIcon, Shield } from 'lucide-react';

interface ModerationLink {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

interface ModerationSettingsProps {
  eventId: string;
  eventName: string;
  moderationEnabled: boolean;
  onClose: () => void;
  onUpdate: (enabled: boolean) => void;
}

const ModerationSettings = ({
  eventId,
  eventName,
  moderationEnabled,
  onClose,
  onUpdate,
}: ModerationSettingsProps) => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(moderationEnabled);
  const [links, setLinks] = useState<ModerationLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinks();
  }, [eventId]);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from('moderation_links')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (data) setLinks(data);
    setLoading(false);
  };

  const toggleModeration = async (value: boolean) => {
    const { error } = await supabase
      .from('events')
      .update({ moderation_enabled: value })
      .eq('id', eventId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update moderation setting',
        variant: 'destructive',
      });
      return;
    }

    setEnabled(value);
    onUpdate(value);
    toast({
      title: value ? 'Moderation enabled' : 'Moderation disabled',
      description: value
        ? 'Moderators can now access this event'
        : 'All moderation links are now inactive',
    });
  };

  const createLink = async () => {
    const token = crypto.randomUUID();
    const { error } = await supabase.from('moderation_links').insert({
      event_id: eventId,
      token,
      label: newLinkLabel.trim() || null,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create moderation link',
        variant: 'destructive',
      });
      return;
    }

    setNewLinkLabel('');
    fetchLinks();
    toast({
      title: 'Link created',
      description: 'New moderation link has been created',
    });
  };

  const toggleLink = async (linkId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('moderation_links')
      .update({ is_active: isActive })
      .eq('id', linkId);

    if (!error) {
      fetchLinks();
      toast({
        title: isActive ? 'Link activated' : 'Link deactivated',
      });
    }
  };

  const deleteLink = async (linkId: string) => {
    const { error } = await supabase
      .from('moderation_links')
      .delete()
      .eq('id', linkId);

    if (!error) {
      fetchLinks();
      toast({
        title: 'Link deleted',
      });
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/moderate/${eventId}/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied',
      description: 'Moderation link copied to clipboard',
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-background border shadow-lg max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Moderation Settings</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Manage moderation access for <strong>{eventName}</strong>
          </p>

          {/* Enable/Disable Moderation */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-6">
            <div>
              <Label htmlFor="moderation-toggle" className="font-medium">
                Enable Moderation
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow moderators to access this event
              </p>
            </div>
            <Switch
              id="moderation-toggle"
              checked={enabled}
              onCheckedChange={toggleModeration}
            />
          </div>

          {enabled && (
            <>
              {/* Create New Link */}
              <div className="mb-6">
                <Label className="mb-2 block">Create Moderation Link</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Label (optional, e.g. 'John')"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                  />
                  <Button onClick={createLink} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Existing Links */}
              <div>
                <Label className="mb-2 block">
                  Active Links ({links.filter((l) => l.is_active).length})
                </Label>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : links.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No moderation links created yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {links.map((link) => (
                      <div
                        key={link.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          link.is_active
                            ? 'bg-muted/30'
                            : 'bg-muted/10 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">
                            {link.label || `Link ${link.token.slice(0, 8)}...`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={link.is_active}
                            onCheckedChange={(v) => toggleLink(link.id, v)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyLink(link.token)}
                            title="Copy link"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteLink(link.id)}
                            title="Delete link"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-sm text-warning-foreground">
                  <strong>Moderator permissions:</strong> View event, add/remove
                  attendees, toggle suspicious status. Cannot modify settings,
                  start/stop event, or export data.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ModerationSettings;
