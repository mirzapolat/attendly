import { useEffect, useState, useMemo, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, BarChart3, Settings, LogOut, QrCode, FolderOpen, Search, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import EventCard from '@/components/EventCard';
import { sanitizeError } from '@/utils/errorHandler';
import { usePageTitle } from '@/hooks/usePageTitle';

interface Event {
  id: string;
  name: string;
  event_date: string;
  is_active: boolean;
  season_id: string | null;
}

interface Season {
  id: string;
  name: string;
}

const EVENTS_PER_PAGE = 5;
const SEASONS_PER_PAGE = 5;
const DASHBOARD_HINTS = [
  {
    id: 'drag-drop',
    title: 'Drag and drop',
    description: 'Drag an event onto a season card to link it quickly.',
  },
  {
    id: 'seasons',
    title: 'Seasons',
    description: 'Group events into seasons to compare attendance over time.',
  },
  {
    id: 'accent',
    title: 'Accent color',
    description: 'Change the accent color in account settings to match your organization.',
  },
  {
    id: 'password',
    title: 'Password hygiene',
    description: 'Rotate your password regularly for better security.',
  },
  {
    id: 'moderation-links',
    title: 'Moderation links',
    description: 'Delegate attendance checks without sharing full admin access.',
  },
  {
    id: 'excuse-links',
    title: 'Excuse links',
    description: 'Let members mark themselves excused without manual entry.',
  },
  {
    id: 'rotating-qr',
    title: 'Rotating QR',
    description: 'Enable rotating QR codes to reduce forwarding.',
  },
  {
    id: 'fingerprinting',
    title: 'Device fingerprinting',
    description: 'Limit multiple submissions from the same device.',
  },
  {
    id: 'location-checks',
    title: 'Location checks',
    description: 'Add location checks to confirm on-site attendance.',
  },
  {
    id: 'exports',
    title: 'Exports',
    description: 'Export attendance lists and matrices for reports.',
  },
  {
    id: 'privacy',
    title: 'Privacy',
    description: 'Use attendee detail toggles when presenting on shared screens.',
  },
];

const Dashboard = () => {
  usePageTitle('Dashboard - Attendly');

  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  const [seasonDescription, setSeasonDescription] = useState('');
  const [seasonCreating, setSeasonCreating] = useState(false);
  const [showSignupWelcome, setShowSignupWelcome] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem('attendly:welcome') === 'signup';
  });

  // Search, filter, and pagination state
  const [eventSearch, setEventSearch] = useState('');
  const [seasonSearch, setSeasonSearch] = useState('');
  const [eventPage, setEventPage] = useState(1);
  const [seasonPage, setSeasonPage] = useState(1);
  const [dragOverSeasonId, setDragOverSeasonId] = useState<string | null>(null);
  const [dismissedHints, setDismissedHints] = useState<string[]>([]);

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

  useEffect(() => {
    if (!showSignupWelcome) {
      return;
    }
    localStorage.removeItem('attendly:welcome');
  }, [showSignupWelcome]);

  const fetchData = async () => {
    try {
      const [eventsRes, seasonsRes, profileRes] = await Promise.all([
        supabase.from('events').select('*').eq('admin_id', user!.id).order('event_date', { ascending: false }),
        supabase.from('seasons').select('*').eq('admin_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('full_name').eq('id', user!.id).maybeSingle(),
      ]);

      const fetchError = eventsRes.error || seasonsRes.error || profileRes.error;
      if (fetchError) {
        throw fetchError;
      }

      if (eventsRes.data) setEvents(eventsRes.data);
      if (seasonsRes.data) setSeasons(seasonsRes.data);
      setFullName(profileRes.data?.full_name ?? '');
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

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
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
        admin_id: user!.id,
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

  const shuffledHints = useMemo(() => {
    const copy = [...DASHBOARD_HINTS];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  const visibleHints = useMemo(
    () => shuffledHints.filter((hint) => !dismissedHints.includes(hint.id)).slice(0, 3),
    [dismissedHints, shuffledHints]
  );

  const handleDismissHint = (hintId: string) => {
    setDismissedHints((prev) => (prev.includes(hintId) ? prev : [...prev, hintId]));
  };

  const assignEventToSeason = async (eventId: string, seasonId: string) => {
    const targetEvent = events.find((item) => item.id === eventId);
    if (!targetEvent) {
      return;
    }
    if (targetEvent.season_id === seasonId) {
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .update({ season_id: seasonId })
        .eq('id', eventId);

      if (error) throw error;

      const seasonName = seasons.find((season) => season.id === seasonId)?.name;
      toast({
        title: 'Added to season',
        description: seasonName ? `Event added to ${seasonName}` : 'Event added to season',
      });
      await fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update event',
      });
    }
  };

  const getDraggedEventId = (dataTransfer: DataTransfer): string | null => {
    const payload = dataTransfer.getData('application/x-attendly-event');
    if (payload) {
      try {
        const parsed = JSON.parse(payload) as { id?: string };
        if (parsed?.id) {
          return parsed.id;
        }
      } catch {
        // Ignore parse errors and fall back to text/plain.
      }
    }
    const fallback = dataTransfer.getData('text/plain');
    return fallback || null;
  };

  const handleSeasonDragOver = (dragEvent: DragEvent<HTMLDivElement>, seasonId: string) => {
    dragEvent.preventDefault();
    dragEvent.dataTransfer.dropEffect = 'move';
    setDragOverSeasonId(seasonId);
  };

  const handleSeasonDrop = async (dragEvent: DragEvent<HTMLDivElement>, seasonId: string) => {
    dragEvent.preventDefault();
    setDragOverSeasonId(null);
    const eventId = getDraggedEventId(dragEvent.dataTransfer);
    if (!eventId) {
      return;
    }
    await assignEventToSeason(eventId, seasonId);
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm('Are you sure? Events in this season will be unlinked (not deleted).')) {
      return;
    }

    try {
      const { error } = await supabase.from('seasons').delete().eq('id', seasonId);
      if (error) throw error;
      toast({ title: 'Season deleted' });
      fetchData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    }
  };

  // Filter and paginate events
  const filteredEvents = useMemo(() => {
    let result = events;
    
    // Filter by search
    if (eventSearch.trim()) {
      const search = eventSearch.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(search) ||
          new Date(e.event_date).toLocaleDateString().includes(search)
      );
    }
    
    return result;
  }, [events, eventSearch]);

  const totalEventPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = useMemo(() => {
    const start = (eventPage - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, eventPage]);

  // Filter and paginate seasons
  const filteredSeasons = useMemo(() => {
    if (!seasonSearch.trim()) return seasons;
    const search = seasonSearch.toLowerCase();
    return seasons.filter((s) => s.name.toLowerCase().includes(search));
  }, [seasons, seasonSearch]);

  const totalSeasonPages = Math.ceil(filteredSeasons.length / SEASONS_PER_PAGE);
  const paginatedSeasons = useMemo(() => {
    const start = (seasonPage - 1) * SEASONS_PER_PAGE;
    return filteredSeasons.slice(start, start + SEASONS_PER_PAGE);
  }, [filteredSeasons, seasonPage]);

  // Reset page when search or filter changes
  useEffect(() => {
    setEventPage(1);
  }, [eventSearch]);

  useEffect(() => {
    setSeasonPage(1);
  }, [seasonSearch]);

  const firstName = useMemo(() => {
    const rawName = fullName || user?.user_metadata?.full_name || user?.email || '';
    const trimmed = rawName.trim();
    if (!trimmed) {
      return 'there';
    }
    const spaceIndex = trimmed.indexOf(' ');
    return spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
  }, [fullName, user?.email, user?.user_metadata?.full_name]);

  const greeting = showSignupWelcome
    ? `Let's get started, ${firstName}!`
    : `Welcome back, ${firstName}!`;
  const hasSeasons = seasons.length > 0;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <QrCode className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">{greeting}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link to="/events/new">
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              New Event
            </Button>
          </Link>
          <Dialog open={seasonDialogOpen} onOpenChange={setSeasonDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderOpen className="w-4 h-4" />
                Create Season
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

        <div className={hasSeasons ? 'grid gap-8 xl:grid-cols-2' : ''}>
          {/* Events List */}
          <div className={hasSeasons ? '' : 'mb-8'}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-semibold">Recent Events</h2>
              {events.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}
            </div>

            {events.length === 0 ? (
              <Card className="bg-gradient-card">
                <CardContent className="py-12 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No events yet</p>
                  <Link to="/events/new">
                    <Button>Create your first event</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : filteredEvents.length === 0 ? (
              <Card className="bg-gradient-card">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No events match your search</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-3">
                  {paginatedEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      seasons={seasons}
                      onEventDeleted={fetchData}
                      onEventUpdated={fetchData}
                    />
                  ))}
                </div>

                {/* Event Pagination */}
                {totalEventPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                      disabled={eventPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {eventPage} of {totalEventPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEventPage((p) => Math.min(totalEventPages, p + 1))}
                      disabled={eventPage === totalEventPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Seasons */}
          {hasSeasons && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-xl font-semibold">Seasons</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search seasons..."
                    value={seasonSearch}
                    onChange={(e) => setSeasonSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {filteredSeasons.length === 0 ? (
                <Card className="bg-gradient-card">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No seasons match your search</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-3">
                    {paginatedSeasons.map((season) => (
                      <Card
                        key={season.id}
                        className={`bg-gradient-card hover:border-primary/50 transition-colors ${
                          dragOverSeasonId === season.id ? 'ring-2 ring-primary/60 bg-primary/5' : ''
                        }`}
                        onDragOver={(event) => handleSeasonDragOver(event, season.id)}
                        onDragLeave={() =>
                          setDragOverSeasonId((current) => (current === season.id ? null : current))
                        }
                        onDrop={(event) => handleSeasonDrop(event, season.id)}
                      >
                        <CardContent className="py-4 flex items-center gap-3">
                          <Link to={`/seasons/${season.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <BarChart3 className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{season.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {events.filter(e => e.season_id === season.id).length} events
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

                  {/* Season Pagination */}
                  {totalSeasonPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeasonPage((p) => Math.max(1, p - 1))}
                        disabled={seasonPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {seasonPage} of {totalSeasonPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeasonPage((p) => Math.min(totalSeasonPages, p + 1))}
                        disabled={seasonPage === totalSeasonPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {visibleHints.length > 0 && (
        <section className="mt-8 border-t border-border bg-muted/20 py-8">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold">Helpful hints</h2>
              <span className="text-xs text-muted-foreground">
                Dismiss tips you already know.
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleHints.map((hint) => (
                <div
                  key={hint.id}
                  className="relative rounded-lg border border-border bg-muted/60 p-4 text-sm text-foreground"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-7 w-7"
                    onClick={() => handleDismissHint(hint.id)}
                    aria-label={`Dismiss hint: ${hint.title}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <p className="font-medium mb-1">{hint.title}</p>
                  <p className="text-muted-foreground">{hint.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;
