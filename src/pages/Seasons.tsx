import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, FolderOpen, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/utils/errorHandler';
import { useWorkspace } from '@/hooks/useWorkspace';
import { usePageTitle } from '@/hooks/usePageTitle';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Season {
  id: string;
  name: string;
  description?: string | null;
}

interface EventSummary {
  id: string;
  season_id: string | null;
}

const Seasons = () => {
  usePageTitle('Seasons - Attendly');
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  const [seasonDescription, setSeasonDescription] = useState('');
  const [seasonCreating, setSeasonCreating] = useState(false);
  const [seasonSearch, setSeasonSearch] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      fetchData();
    }
  }, [currentWorkspace]);

  const fetchData = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      const [seasonsRes, eventsRes] = await Promise.all([
        supabase
          .from('seasons')
          .select('id, name, description')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('id, season_id')
          .eq('workspace_id', currentWorkspace.id),
      ]);

      const fetchError = seasonsRes.error || eventsRes.error;
      if (fetchError) {
        throw fetchError;
      }

      if (seasonsRes.data) setSeasons(seasonsRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeason = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentWorkspace) return;

    const trimmedName = seasonName.trim();
    if (!trimmedName) {
      return;
    }

    if (trimmedName.length > 40) {
      toast({
        variant: 'destructive',
        title: 'Name too long',
        description: 'Season name must be 40 characters or fewer.',
      });
      return;
    }

    setSeasonCreating(true);
    try {
      const { error } = await supabase.from('seasons').insert({
        workspace_id: currentWorkspace.id,
        name: trimmedName,
        description: seasonDescription.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Season created' });
      setSeasonName('');
      setSeasonDescription('');
      setSeasonDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    } finally {
      setSeasonCreating(false);
    }
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm('Delete this season? Events assigned to it will remain, but become unassigned.')) {
      return;
    }

    try {
      const { error } = await supabase.from('seasons').delete().eq('id', seasonId);
      if (error) throw error;

      toast({ title: 'Season deleted' });
      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    }
  };

  const filteredSeasons = useMemo(() => {
    if (!seasonSearch.trim()) return seasons;
    const search = seasonSearch.toLowerCase();
    return seasons.filter((season) => season.name.toLowerCase().includes(search));
  }, [seasons, seasonSearch]);


  return (
    <WorkspaceLayout title="Seasons overview">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Seasons</h1>
          <p className="text-muted-foreground">Organize events into seasons and track attendance.</p>
        </div>
        <Dialog open={seasonDialogOpen} onOpenChange={setSeasonDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <FolderOpen className="w-4 h-4" />
              Create season
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Season</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSeason} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seasonName">Season Name</Label>
                <Input
                  id="seasonName"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="Spring 2025"
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seasonDescription">Description (Optional)</Label>
                <Textarea
                  id="seasonDescription"
                  value={seasonDescription}
                  onChange={(e) => setSeasonDescription(e.target.value)}
                  placeholder="Weekly team meetings..."
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={seasonCreating || !seasonName.trim()}>
                {seasonCreating ? 'Creating...' : 'Create Season'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-semibold">All seasons</h2>
        {seasons.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search seasons..."
              value={seasonSearch}
              onChange={(e) => setSeasonSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {loading ? (
        <Card className="bg-gradient-card">
          <CardContent className="py-8 text-center">Loading seasons...</CardContent>
        </Card>
      ) : filteredSeasons.length === 0 ? (
        <Card className="bg-gradient-card">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {seasonSearch ? 'No seasons match your search' : 'Create your first season to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {filteredSeasons.map((season) => (
              <Card key={season.id} className="bg-gradient-card hover:border-primary/50 transition-colors">
                <CardContent className="py-4 flex items-center gap-3">
                  <Link to={`/seasons/${season.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{season.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {events.filter((event) => event.season_id === season.id).length} events
                      </p>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDeleteSeason(season.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

        </>
      )}
    </WorkspaceLayout>
  );
};

export default Seasons;
