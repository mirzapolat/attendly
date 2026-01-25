import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, Layers, Lightbulb, Plus, RefreshCcw, Settings, Users, UserPlus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { sanitizeError } from '@/utils/errorHandler';
import { usePageTitle } from '@/hooks/usePageTitle';

type EventSummary = {
  id: string;
  name: string;
  event_date: string;
};

type SeasonSummary = {
  id: string;
  name: string;
  created_at: string;
};

const HOME_HINTS = [
  {
    id: 'seasons',
    title: 'Seasons',
    description: 'Group events into seasons to compare attendance over time.',
  },
  {
    id: 'accent',
    title: 'Workspace branding',
    description: 'Update the workspace color and logo in workspace settings.',
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

const Home = () => {
  usePageTitle('Home - Attendly');
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [seasonCount, setSeasonCount] = useState(0);
  const [dismissedHints, setDismissedHints] = useState<string[]>([]);
  const [hintSeed, setHintSeed] = useState(0);

  useEffect(() => {
    if (currentWorkspace) {
      fetchSnapshot();
    }
  }, [currentWorkspace?.id]);

  const fetchSnapshot = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const [eventsRes, seasonsRes, seasonsCountRes, membersRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, event_date')
          .eq('workspace_id', currentWorkspace.id)
          .order('event_date', { ascending: true }),
        supabase
          .from('seasons')
          .select('id, name, created_at')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('seasons')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('workspace_members')
          .select('profile_id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id),
      ]);

      const fetchError =
        eventsRes.error || seasonsRes.error || seasonsCountRes.error || membersRes.error;
      if (fetchError) {
        throw fetchError;
      }

      setEvents(eventsRes.data ?? []);
      setSeasons(seasonsRes.data ?? []);
      setSeasonCount(seasonsCountRes.count ?? 0);
      setMemberCount(membersRes.count ?? 0);
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

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => new Date(event.event_date).getTime() >= now)
      .slice(0, 4);
  }, [events]);

  const totalEvents = events.length;
  const upcomingCount = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => new Date(event.event_date).getTime() >= now).length;
  }, [events]);
  const totalSeasons = seasonCount;

  const stats = [
    { label: 'Events', value: totalEvents, icon: CalendarDays },
    { label: 'Upcoming', value: upcomingCount, icon: Clock },
    { label: 'Seasons', value: totalSeasons, icon: Layers },
    { label: 'Members', value: memberCount, icon: Users },
  ];

  const visibleHints = useMemo(() => {
    const pool = HOME_HINTS.filter((hint) => !dismissedHints.includes(hint.id));
    if (pool.length <= 3) {
      return pool;
    }
    const seeded = [...pool].sort(() => Math.random() - 0.5);
    return seeded.slice(0, 3);
  }, [dismissedHints, hintSeed]);

  const handleDismissHint = (hintId: string) => {
    setDismissedHints((prev) => [...prev, hintId]);
  };

  return (
    <WorkspaceLayout title="Home">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Home</h1>
            <p className="text-muted-foreground">
              Quick stats and shortcuts for {currentWorkspace?.name ?? 'your workspace'}.
            </p>
          </div>
          <Link to="/events/new">
            <Button variant="hero" className="gap-2">
              <Plus className="h-4 w-4" />
              New event
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-gradient-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-semibold">{stat.value}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="bg-gradient-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Upcoming events</h2>
                <Link to="/dashboard" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading events...</p>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 hover:border-primary/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.event_date), 'PPP • HH:mm')}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">Open</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Quick actions</h2>
              <div className="grid gap-3">
                <Link to="/events/new">
                  <Button variant="outline" className="w-full justify-between">
                    Create event
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/seasons">
                  <Button variant="outline" className="w-full justify-between">
                    View seasons
                    <Layers className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/members">
                  <Button variant="outline" className="w-full justify-between">
                    Invite members
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/workspace-settings">
                  <Button variant="outline" className="w-full justify-between">
                    Workspace settings
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent seasons</h2>
              <Link to="/seasons" className="text-sm text-primary hover:underline">
                Manage seasons
              </Link>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading seasons...</p>
            ) : seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No seasons yet. Create one to get started.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {seasons.map((season) => (
                  <Link
                    key={season.id}
                    to={`/seasons/${season.id}`}
                    className="rounded-xl border border-border bg-background/60 px-4 py-3 hover:border-primary/50 transition-colors"
                  >
                    <p className="font-medium">{season.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(season.created_at), 'PPP')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {visibleHints.length > 0 && (
          <section className="border-t border-border pt-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                Useful hints
              </h2>
              <button
                type="button"
                onClick={() => setHintSeed((seed) => seed + 1)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                More hints
              </button>
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
                    title={`Dismiss hint: ${hint.title}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <p className="font-medium mb-1">{hint.title}</p>
                  <p className="text-muted-foreground">{hint.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </WorkspaceLayout>
  );
};

export default Home;
