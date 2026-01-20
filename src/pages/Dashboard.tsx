import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, FolderOpen, Lightbulb, Plus, RefreshCcw, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import EventCard from '@/components/EventCard';
import { sanitizeError } from '@/utils/errorHandler';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useWorkspace } from '@/hooks/useWorkspace';
import WorkspaceLayout from '@/components/WorkspaceLayout';

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

const EVENTS_PER_PAGE = 10;
const DASHBOARD_HINTS = [
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

const SEASON_PICKER_PAGE_SIZE = 9;

const Dashboard = () => {
  usePageTitle('Events - Attendly');

  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState('');
  const [eventPage, setEventPage] = useState(1);
  const [dismissedHints, setDismissedHints] = useState<string[]>([]);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [draggingOverSeasonId, setDraggingOverSeasonId] = useState<string | null>(null);
  const [seasonPickerPage, setSeasonPickerPage] = useState(1);
  const seasonPickerPrevTimer = useRef<number | null>(null);
  const seasonPickerNextTimer = useRef<number | null>(null);
  const [seasonPagerHover, setSeasonPagerHover] = useState<'prev' | 'next' | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      fetchData();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (draggingEventId) {
      setSeasonPickerPage(1);
    }
  }, [draggingEventId, seasons.length]);

  useEffect(() => {
    localStorage.removeItem('attendly:welcome');
  }, []);

  const fetchData = async () => {
    if (!currentWorkspace) return;

    try {
      const [eventsRes, seasonsRes] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('event_date', { ascending: false }),
        supabase
          .from('seasons')
          .select('*')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: false }),
      ]);

      const fetchError = eventsRes.error || seasonsRes.error;
      if (fetchError) {
        throw fetchError;
      }

      if (eventsRes.data) {
        setEvents(eventsRes.data);
        const eventIds = eventsRes.data.map((event) => event.id);
        if (eventIds.length === 0) {
          setAttendanceCounts({});
        } else {
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance_records')
            .select('event_id, status')
            .in('event_id', eventIds);
          if (attendanceError) {
            throw attendanceError;
          }
          const counts: Record<string, number> = {};
          (attendanceData ?? []).forEach((record) => {
            if (record.status === 'excused') return;
            counts[record.event_id] = (counts[record.event_id] ?? 0) + 1;
          });
          setAttendanceCounts(counts);
        }
      }
      if (seasonsRes.data) setSeasons(seasonsRes.data);
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

  const filteredEvents = useMemo(() => {
    if (!eventSearch.trim()) return events;
    const search = eventSearch.toLowerCase();
    return events.filter((event) => event.name.toLowerCase().includes(search));
  }, [events, eventSearch]);

  const totalEventPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = useMemo(() => {
    const start = (eventPage - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, eventPage]);

  useEffect(() => {
    setEventPage(1);
  }, [eventSearch]);

  const [hintSeed, setHintSeed] = useState(0);

  const visibleHints = useMemo(() => {
    const pool = DASHBOARD_HINTS.filter((hint) => !dismissedHints.includes(hint.id));
    if (pool.length <= 3) {
      return pool;
    }
    const seeded = [...pool].sort(() => Math.random() - 0.5);
    return seeded.slice(0, 3);
  }, [dismissedHints, hintSeed]);

  const handleDismissHint = (hintId: string) => {
    setDismissedHints((prev) => [...prev, hintId]);
  };

  const handleAssignSeason = async (eventId: string, seasonId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ season_id: seasonId })
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: 'Event updated',
        description: `Event added to ${seasons.find((season) => season.id === seasonId)?.name ?? 'season'}.`,
      });
      setDraggingEventId(null);
      setDraggingOverSeasonId(null);
      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    }
  };

  const getDraggedEventId = (event?: DragEvent) => {
    if (draggingEventId) return draggingEventId;
    if (!event) return null;
    const payload = event.dataTransfer.getData('application/x-attendly-event');
    if (!payload) return event.dataTransfer.getData('text/plain') || null;
    try {
      const parsed = JSON.parse(payload) as { id?: string };
      return parsed.id ?? null;
    } catch {
      return event.dataTransfer.getData('text/plain') || null;
    }
  };

  const totalSeasonPickerPages = Math.max(1, Math.ceil(seasons.length / SEASON_PICKER_PAGE_SIZE));
  const paginatedSeasons = useMemo(() => {
    const start = (seasonPickerPage - 1) * SEASON_PICKER_PAGE_SIZE;
    return seasons.slice(start, start + SEASON_PICKER_PAGE_SIZE);
  }, [seasons, seasonPickerPage]);

  const clearSeasonHoverTimers = () => {
    if (seasonPickerPrevTimer.current) {
      window.clearTimeout(seasonPickerPrevTimer.current);
      seasonPickerPrevTimer.current = null;
    }
    if (seasonPickerNextTimer.current) {
      window.clearTimeout(seasonPickerNextTimer.current);
      seasonPickerNextTimer.current = null;
    }
    setSeasonPagerHover(null);
  };

  return (
    <WorkspaceLayout title="Events overview">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">Plan, launch, and manage attendance.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/events/new">
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              New event
            </Button>
          </Link>
          <Link to="/seasons">
            <Button variant="outline">
              <FolderOpen className="w-4 h-4" />
              View seasons
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-semibold">Recent events</h2>
        {events.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {loading ? (
        <Card className="bg-gradient-card">
          <CardContent className="py-10 text-center">Loading events...</CardContent>
        </Card>
      ) : events.length === 0 ? (
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
                attendeesCount={attendanceCounts[event.id] ?? 0}
                seasons={seasons}
                onEventDeleted={fetchData}
                onEventUpdated={fetchData}
                onDragStart={(eventId) => setDraggingEventId(eventId)}
                onDragEnd={() => {
                  setDraggingEventId(null);
                  setDraggingOverSeasonId(null);
                }}
              />
            ))}
          </div>

          {totalEventPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEventPage((page) => Math.max(1, page - 1))}
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
                onClick={() => setEventPage((page) => Math.min(totalEventPages, page + 1))}
                disabled={eventPage === totalEventPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {visibleHints.length > 0 && (
        <section className="mt-10 border-t border-border py-8">
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

      {draggingEventId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          onDragOver={(event) => event.preventDefault()}
        >
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-background shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
                  Drop to assign
                </p>
                <h3 className="text-lg font-semibold">Choose a season</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDraggingEventId(null);
                  setDraggingOverSeasonId(null);
                  clearSeasonHoverTimers();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {seasons.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No seasons available. Create one to organize events.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedSeasons.map((season) => (
                  <div
                    key={season.id}
                    className={`rounded-xl border px-4 py-3 transition-colors ${
                      draggingOverSeasonId === season.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/40'
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDraggingOverSeasonId(season.id);
                    }}
                    onDragLeave={() => {
                      setDraggingOverSeasonId((current) => (current === season.id ? null : current));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const eventId = getDraggedEventId(event);
                      if (eventId) {
                        handleAssignSeason(eventId, season.id);
                      }
                    }}
                  >
                    <p className="font-medium">{season.name}</p>
                    <p className="text-xs text-muted-foreground">Drop event here</p>
                  </div>
                ))}
              </div>
            )}
            {seasons.length > SEASON_PICKER_PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={seasonPickerPage === 1}
                  onClick={() => setSeasonPickerPage((page) => Math.max(1, page - 1))}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (seasonPickerPage === 1 || seasonPickerPrevTimer.current) return;
                    setSeasonPagerHover('prev');
                    seasonPickerPrevTimer.current = window.setTimeout(() => {
                      setSeasonPickerPage((page) => Math.max(1, page - 1));
                    }, 500);
                  }}
                  onDragLeave={clearSeasonHoverTimers}
                  onBlur={clearSeasonHoverTimers}
                  className={seasonPagerHover === 'prev' ? 'border-primary bg-primary/10' : undefined}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {seasonPickerPage} of {totalSeasonPickerPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={seasonPickerPage === totalSeasonPickerPages}
                  onClick={() => setSeasonPickerPage((page) => Math.min(totalSeasonPickerPages, page + 1))}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (seasonPickerPage === totalSeasonPickerPages || seasonPickerNextTimer.current) return;
                    setSeasonPagerHover('next');
                    seasonPickerNextTimer.current = window.setTimeout(() => {
                      setSeasonPickerPage((page) => Math.min(totalSeasonPickerPages, page + 1));
                    }, 500);
                  }}
                  onDragLeave={clearSeasonHoverTimers}
                  onBlur={clearSeasonHoverTimers}
                  className={seasonPagerHover === 'next' ? 'border-primary bg-primary/10' : undefined}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
};

export default Dashboard;
