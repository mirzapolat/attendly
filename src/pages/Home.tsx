import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  Layers,
  Plus,
  RefreshCcw,
  Settings,
  Sparkles,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import WorkspaceLayout from '@/components/WorkspaceLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/utils/errorHandler';
import { usePageTitle } from '@/hooks/usePageTitle';

type EventSummary = {
  id: string;
  name: string;
  event_date: string;
  season_id: string | null;
  is_active: boolean;
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
          .select('id, name, event_date, season_id, is_active')
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
    return [...events]
      .filter((event) => new Date(event.event_date).getTime() >= now)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [events]);

  const nextEvent = upcomingEvents[0] ?? null;
  const nextEventCountdown = nextEvent
    ? formatDistanceToNowStrict(new Date(nextEvent.event_date), { addSuffix: true })
    : null;

  const weekEvents = useMemo(() => {
    const now = Date.now();
    const weekCutoff = now + 7 * 24 * 60 * 60 * 1000;
    return upcomingEvents
      .filter((event) => new Date(event.event_date).getTime() <= weekCutoff)
      .slice(0, 5);
  }, [upcomingEvents]);

  const todayEvents = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    return events
      .filter((event) => {
        const eventTime = new Date(event.event_date).getTime();
        return eventTime >= startOfDay && eventTime < endOfDay;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }, [events]);

  const todayPreview = todayEvents.slice(0, 2);
  const extraTodayCount = Math.max(0, todayEvents.length - todayPreview.length);

  const totalEvents = events.length;
  const upcomingCount = upcomingEvents.length;
  const totalSeasons = seasonCount;
  const unassignedCount = useMemo(
    () => events.filter((event) => !event.season_id).length,
    [events],
  );
  const pastCount = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => new Date(event.event_date).getTime() < now).length;
  }, [events]);
  const liveCount = useMemo(() => events.filter((event) => event.is_active).length, [events]);

  const stats = [
    { label: 'Events', value: totalEvents, icon: CalendarDays },
    { label: 'Upcoming', value: upcomingCount, icon: Clock },
    { label: 'Seasons', value: totalSeasons, icon: Layers },
    { label: 'Members', value: memberCount, icon: Users },
  ];

  const attentionItems = [
    {
      id: 'unassigned',
      label: 'Unassigned events',
      value: unassignedCount,
      description: 'Pop them into a season to keep everything tidy.',
      to: '/seasons',
      action: 'Organize',
    },
    {
      id: 'past',
      label: 'Past events',
      value: pastCount,
      description: 'Take a quick look at attendance and notes.',
      to: '/dashboard#past-events',
      action: 'Review',
    },
    {
      id: 'live',
      label: 'Live check-ins',
      value: liveCount,
      description: 'Attendance sessions happening right now.',
      to: '/dashboard',
      action: 'Open',
    },
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
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-[hsl(var(--page-bg-start))] via-[hsl(var(--card))] to-[hsl(var(--page-bg-end))] p-6 lg:p-8">
          <div className="pointer-events-none absolute -right-28 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10 space-y-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                  Your workspace
                </p>
                <h1 className="text-3xl font-semibold sm:text-4xl">
                  Welcome to {currentWorkspace?.name ?? 'your workspace'}!
                </h1>
                <p className="text-muted-foreground">
                  Here’s a friendly snapshot of what’s happening and where to go next.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/events/new">
                  <Button variant="hero" className="gap-2">
                    <Plus className="h-4 w-4" />
                    New event
                  </Button>
                </Link>
                <Link to="/members">
                  <Button variant="glass" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Invite members
                  </Button>
                </Link>
                <Link to="/workspace-settings">
                  <Button variant="outline" className="gap-2 gear-trigger">
                    <Settings className="h-4 w-4 gear-icon" />
                    Workspace settings
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border/70 bg-background/80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                        Up next
                      </p>
                      <h2 className="text-base font-semibold">Your next event</h2>
                    </div>
                    <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
                      See all
                    </Link>
                  </div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading events...</p>
                  ) : nextEvent ? (
                    <div className="space-y-3">
                      <Link
                        to={`/events/${nextEvent.id}`}
                        className="group flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-3 transition-all hover:border-primary/40"
                      >
                        <div>
                          <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                            {nextEvent.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(nextEvent.event_date), 'PPP • HH:mm')}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </Link>
                      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-xs">
                        <span className="text-muted-foreground">Starts in</span>
                        <span className="font-semibold">{nextEventCountdown}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>No events are scheduled yet.</p>
                      <Link to="/events/new" className="text-primary hover:underline">
                        Create your first event
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-background/80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">To review</p>
                      <h3 className="text-base font-semibold">Things to check</h3>
                    </div>
                  </div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading your reminders...</p>
                  ) : attentionItems.every((item) => item.value === 0) ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                      You’re all caught up.
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {attentionItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2"
                        >
                          <div>
                            <p className="font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-background/80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                        Today
                      </p>
                      <h3 className="text-base font-semibold">Happening now</h3>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Checking today’s schedule...</p>
                  ) : todayEvents.length === 0 ? (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>No events planned for today.</p>
                      <Link to="/events/new" className="text-primary hover:underline">
                        Plan one
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {todayPreview.map((event) => (
                        <Link
                          key={event.id}
                          to={`/events/${event.id}`}
                          className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2 text-sm hover:border-primary/40 transition-colors"
                        >
                          <span className="font-medium">{event.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.event_date), 'HH:mm')}
                          </span>
                        </Link>
                      ))}
                      {extraTodayCount > 0 && (
                        <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
                          +{extraTodayCount} more today
                        </Link>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-gradient-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-semibold">{stat.value}</p>
                    </div>
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="bg-gradient-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Coming up</p>
                  <h2 className="text-lg font-semibold">This week</h2>
                </div>
                <Link to="/dashboard" className="text-sm text-primary hover:underline">
                  See all events
                </Link>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading events...</p>
              ) : weekEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                  No events in the next seven days. Want to plan one?
                </div>
              ) : (
                <div className="space-y-3">
                  {weekEvents.map((event) => (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/70 px-4 py-3 transition-all hover:border-primary/40"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-center">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                            {format(new Date(event.event_date), 'EEE')}
                          </p>
                          <p className="text-sm font-semibold">{format(new Date(event.event_date), 'MMM d')}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(event.event_date), 'HH:mm')}</p>
                        </div>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">
                            {event.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.event_date), 'PPP')}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Shortcuts</p>
                  <h2 className="text-lg font-semibold">Quick actions</h2>
                </div>
              </div>
              <div className="grid gap-3">
                <Link to="/events/new">
                  <Button variant="outline" className="w-full justify-between">
                    Create event
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/seasons">
                  <Button variant="outline" className="w-full justify-between">
                    Manage seasons
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
                  <Button variant="outline" className="w-full justify-between gear-trigger">
                    Workspace settings
                    <Settings className="h-4 w-4 gear-icon" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="bg-gradient-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Seasons</p>
                  <h2 className="text-lg font-semibold">Recent seasons</h2>
                </div>
                <Link to="/seasons" className="text-sm text-primary hover:underline">
                  See all
                </Link>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading seasons...</p>
              ) : seasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No seasons yet. Create one when you’re ready.</p>
              ) : (
                <div className="space-y-3">
                  {seasons.map((season) => (
                    <Link
                      key={season.id}
                      to={`/seasons/${season.id}`}
                      className="flex items-center justify-between rounded-2xl border border-border bg-background/70 px-4 py-3 hover:border-primary/40 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{season.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {format(new Date(season.created_at), 'PPP')}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {visibleHints.length > 0 && (
            <Card className="bg-gradient-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h2 className="text-lg font-semibold">Friendly tips</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHintSeed((seed) => seed + 1)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    More tips
                  </button>
                </div>
                <div className="grid gap-3">
                  {visibleHints.map((hint) => (
                    <div
                      key={hint.id}
                      className="relative rounded-2xl border border-border bg-background/70 p-4 text-sm"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-7 w-7"
                        onClick={() => handleDismissHint(hint.id)}
                        aria-label={`Dismiss hint: ${hint.title}`}
                        title={`Dismiss hint: ${hint.title}`}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Dismiss</span>
                      </Button>
                      <p className="font-medium mb-1">{hint.title}</p>
                      <p className="text-muted-foreground">{hint.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  );
};

export default Home;
