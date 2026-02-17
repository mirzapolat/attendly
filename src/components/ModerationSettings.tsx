import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Copy, Trash2, Link as LinkIcon, Shield, Eye } from 'lucide-react';

interface ModerationLink {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

interface ModerationSettingsProps {
  eventId: string;
  eventName: string;
  moderationEnabled: boolean;
  moderatorShowFullName?: boolean;
  moderatorShowEmail?: boolean;
  onClose: () => void;
  onUpdate: (settings: {
    moderation_enabled?: boolean;
    moderator_show_full_name?: boolean;
    moderator_show_email?: boolean;
  }) => void;
}

const MODERATION_LINK_FETCH_LIMIT = 200;

const ModerationSettings = ({
  eventId,
  eventName,
  moderationEnabled,
  moderatorShowFullName = true,
  moderatorShowEmail = true,
  onClose,
  onUpdate,
}: ModerationSettingsProps) => {
  const { toast } = useToast();
  const formatExpiry = (value: string | null): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
  };
  const [enabled, setEnabled] = useState(moderationEnabled);
  const [showFullName, setShowFullName] = useState(moderatorShowFullName);
  const [showEmail, setShowEmail] = useState(moderatorShowEmail);
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
      .order('created_at', { ascending: false })
      .limit(MODERATION_LINK_FETCH_LIMIT);

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
    onUpdate({ moderation_enabled: value });
    toast({
      title: value ? 'Moderation enabled' : 'Moderation disabled',
      description: value
        ? 'Moderators can now access this event'
        : 'All moderation links are now inactive',
    });
  };

  const toggleShowFullName = async (value: boolean) => {
    const { error } = await supabase
      .from('events')
      .update({ moderator_show_full_name: value })
      .eq('id', eventId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update privacy setting',
        variant: 'destructive',
      });
      return;
    }

    setShowFullName(value);
    onUpdate({ moderator_show_full_name: value });
    toast({
      title: value ? 'Full names visible' : 'Last names hidden',
      description: value
        ? 'Moderators can now see full attendee names'
        : 'Moderators will only see first names',
    });
  };

  const toggleShowEmail = async (value: boolean) => {
    const { error } = await supabase
      .from('events')
      .update({ moderator_show_email: value })
      .eq('id', eventId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update privacy setting',
        variant: 'destructive',
      });
      return;
    }

    setShowEmail(value);
    onUpdate({ moderator_show_email: value });
    toast({
      title: value ? 'Emails visible' : 'Emails hidden',
      description: value
        ? 'Moderators can now see attendee emails'
        : 'Moderators will not see attendee emails',
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="lg:max-w-lg lg:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Moderation Settings
          </DialogTitle>
          <DialogDescription>
            Manage moderation access for <strong>{eventName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Enable/Disable Moderation */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
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
            {/* Privacy Settings */}
            <div className="mb-6 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Privacy Settings
              </Label>
              
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="show-fullname" className="text-sm">
                    Show full names
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If disabled, moderators only see first names
                  </p>
                </div>
                <Switch
                  id="show-fullname"
                  checked={showFullName}
                  onCheckedChange={toggleShowFullName}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="show-email" className="text-sm">
                    Show emails
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    If disabled, moderators cannot see emails
                  </p>
                </div>
                <Switch
                  id="show-email"
                  checked={showEmail}
                  onCheckedChange={toggleShowEmail}
                />
              </div>
            </div>

            {/* Create New Link */}
            <div className="mb-6">
              <Label className="mb-2 block">Create Moderation Link</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Label (optional, e.g. 'John')"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                />
                <Button onClick={createLink} size="icon" title="Create link">
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
                        <div className="min-w-0">
                          <div className="text-sm truncate">
                            {link.label || `Link ${link.token.slice(0, 8)}...`}
                          </div>
                          {formatExpiry(link.expires_at) && (
                            <div className="text-xs text-muted-foreground">
                              Expires {formatExpiry(link.expires_at)}
                            </div>
                          )}
                        </div>
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

            <div className="mt-6 p-4 bg-muted rounded-lg border">
              <p className="text-sm text-foreground">
                <strong>Moderator permissions:</strong> View event, add/remove
                attendees, toggle suspicious status. Cannot modify settings,
                start/stop event, or export data.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ModerationSettings;
