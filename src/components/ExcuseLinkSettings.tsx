import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, Copy, Trash2, Link as LinkIcon, Calendar } from 'lucide-react';

interface ExcuseLink {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

interface ExcuseLinkSettingsProps {
  eventId: string;
  eventName: string;
  onClose: () => void;
}

const formatDateTimeLocal = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const formatExpiry = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const ExcuseLinkSettings = ({ eventId, eventName, onClose }: ExcuseLinkSettingsProps) => {
  const { toast } = useToast();
  const [links, setLinks] = useState<ExcuseLink[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkExpiry, setNewLinkExpiry] = useState(() =>
    formatDateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinks();
  }, [eventId]);

  const fetchLinks = async () => {
    const { data } = await supabase
      .from('excuse_links')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (data) setLinks(data);
    setLoading(false);
  };

  const createLink = async () => {
    if (!newLinkExpiry) {
      toast({
        title: 'Missing expiry',
        description: 'Please choose an expiration date and time',
        variant: 'destructive',
      });
      return;
    }

    const expiresAt = new Date(newLinkExpiry);
    if (Number.isNaN(expiresAt.getTime())) {
      toast({
        title: 'Invalid expiry',
        description: 'Please choose a valid expiration date and time',
        variant: 'destructive',
      });
      return;
    }

    if (expiresAt.getTime() <= Date.now()) {
      toast({
        title: 'Expiry in the past',
        description: 'Please choose a future expiration date and time',
        variant: 'destructive',
      });
      return;
    }

    const token = crypto.randomUUID();
    const { error } = await supabase.from('excuse_links').insert({
      event_id: eventId,
      token,
      label: newLinkLabel.trim() || null,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create excuse link',
        variant: 'destructive',
      });
      return;
    }

    setNewLinkLabel('');
    fetchLinks();
    toast({
      title: 'Link created',
      description: 'New excuse link has been created',
    });
  };

  const toggleLink = async (linkId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('excuse_links')
      .update({ is_active: isActive })
      .eq('id', linkId);

    if (!error) {
      fetchLinks();
      toast({ title: isActive ? 'Link activated' : 'Link deactivated' });
    }
  };

  const deleteLink = async (linkId: string) => {
    const { error } = await supabase
      .from('excuse_links')
      .delete()
      .eq('id', linkId);

    if (!error) {
      fetchLinks();
      toast({ title: 'Link deleted' });
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/excuse/${eventId}/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied',
      description: 'Excuse link copied to clipboard',
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-background border shadow-lg max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Excuse Links</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} title="Close">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Create public excuse links for <strong>{eventName}</strong>
          </p>

          <div className="space-y-3 mb-6">
            <Label className="mb-1 block">Create Excuse Link</Label>
            <Input
              placeholder="Label (optional, e.g. 'Coach absence')"
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
            />
            <div>
              <Label className="mb-1 block">Expiration</Label>
              <Input
                type="datetime-local"
                value={newLinkExpiry}
                onChange={(e) => setNewLinkExpiry(e.target.value)}
              />
            </div>
            <Button onClick={createLink} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Link
            </Button>
          </div>

          <div>
            <Label className="mb-2 block">
              Active Links ({links.filter((link) => link.is_active).length})
            </Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No excuse links created yet
              </p>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      link.is_active ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
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
                        onCheckedChange={(value) => toggleLink(link.id, value)}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ExcuseLinkSettings;
