import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar, BarChart3, Settings, LogOut, QrCode, FolderOpen, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import EventCard from '@/components/EventCard';

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
const SEASONS_PER_PAGE = 6;

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [showSignupWelcome, setShowSignupWelcome] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem('attendly:welcome') === 'signup';
  });

  // Search, filter, and pagination state
  const [eventSearch, setEventSearch] = useState('');
  const [seasonSearch, setSeasonSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [eventPage, setEventPage] = useState(1);
  const [seasonPage, setSeasonPage] = useState(1);

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
        supabase.from('events').select('*').order('event_date', { ascending: false }),
        supabase.from('seasons').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('full_name').eq('id', user!.id).maybeSingle(),
      ]);

      if (eventsRes.data) setEvents(eventsRes.data);
      if (seasonsRes.data) setSeasons(seasonsRes.data);
      setFullName(profileRes.data?.full_name ?? '');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and paginate events
  const filteredEvents = useMemo(() => {
    let result = events;
    
    // Filter by active status
    if (showActiveOnly) {
      result = result.filter((e) => e.is_active);
    }
    
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
  }, [events, eventSearch, showActiveOnly]);

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
  }, [eventSearch, showActiveOnly]);

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
          <div className="flex items-center gap-2">
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
          <Link to="/seasons">
            <Button variant="outline">
              <FolderOpen className="w-4 h-4" />
              Manage Seasons
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{events.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Seasons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{seasons.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Active Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{events.filter(e => e.is_active).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Events List */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-semibold">Recent Events</h2>
            {events.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    id="active-filter"
                    checked={showActiveOnly}
                    onCheckedChange={setShowActiveOnly}
                  />
                  <Label htmlFor="active-filter" className="text-sm text-muted-foreground cursor-pointer">
                    Active only
                  </Label>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
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
        {seasons.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-semibold">Seasons</h2>
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

            {filteredSeasons.length === 0 ? (
              <Card className="bg-gradient-card">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No seasons match your search</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedSeasons.map((season) => (
                    <Link key={season.id} to={`/seasons/${season.id}`}>
                      <Card className="bg-gradient-card hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="py-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{season.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {events.filter(e => e.season_id === season.id).length} events
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
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
      </main>
    </div>
  );
};

export default Dashboard;
