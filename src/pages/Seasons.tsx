import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, FolderOpen, BarChart3, Calendar, Trash2 } from 'lucide-react';
import { sanitizeError } from '@/utils/errorHandler';

interface Season {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface EventCount {
  season_id: string;
  count: number;
}

const Seasons = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [seasonsRes, eventsRes] = await Promise.all([
        supabase.from('seasons').select('*').order('created_at', { ascending: false }),
        supabase.from('events').select('season_id'),
      ]);

      const fetchError = seasonsRes.error || eventsRes.error;
      if (fetchError) {
        throw fetchError;
      }

      if (seasonsRes.data) setSeasons(seasonsRes.data);

      if (eventsRes.data) {
        const counts: Record<string, number> = {};
        eventsRes.data.forEach((event) => {
          if (event.season_id) {
            counts[event.season_id] = (counts[event.season_id] || 0) + 1;
          }
        });
        setEventCounts(counts);
      }
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);

    try {
      const { error } = await supabase.from('seasons').insert({
        admin_id: user!.id,
        name: name.trim(),
        description: description.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Season created' });
      setName('');
      setDescription('');
      setDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteSeason = async (seasonId: string) => {
    if (!confirm('Are you sure? Events in this season will be unlinked (not deleted).')) return;

    const { error } = await supabase.from('seasons').delete().eq('id', seasonId);

    if (!error) {
      toast({ title: 'Season deleted' });
      fetchData();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-subtle">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4" />
                New Season
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Season</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Season Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Spring 2025"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Weekly team meetings..."
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating || !name.trim()}>
                  {creating ? 'Creating...' : 'Create Season'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <FolderOpen className="w-6 h-6" />
          Seasons
        </h1>

        {seasons.length === 0 ? (
          <Card className="bg-gradient-card">
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No seasons yet</p>
              <p className="text-sm text-muted-foreground">
                Create a season to group related events and view analytics.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seasons.map((season) => (
              <Card key={season.id} className="bg-gradient-card hover:border-primary/50 transition-colors group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{season.name}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {eventCounts[season.id] || 0} events
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteSeason(season.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {season.description && (
                    <p className="text-sm text-muted-foreground mb-3">{season.description}</p>
                  )}
                  <Link to={`/seasons/${season.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Analytics
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Seasons;
