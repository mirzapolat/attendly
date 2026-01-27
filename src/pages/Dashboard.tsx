import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Calendar, LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  created_at: string;
}

interface Season {
  id: string;
  name: string;
}

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
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [draggingOverSeasonId, setDraggingOverSeasonId] = useState<string | null>(null);
  const [seasonPickerPage, setSeasonPickerPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'attendance' | 'created' | 'season'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const seasonPickerPrevTimer = useRef<number | null>(null);
  const seasonPickerNextTimer = useRef<number | null>(null);
  const [seasonPagerHover, setSeasonPagerHover] = useState<'prev' | 'next' | null>(null);
  const draggingEventRef = useRef<string | null>(null);
  const dropHandledRef = useRef(false);

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

  const seasonNameMap = useMemo(() => {
    const map = new Map<string, string>();
    seasons.forEach((season) => map.set(season.id, season.name));
    return map;
  }, [seasons]);

  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];
    const direction = sortDirection === 'asc' ? 1 : -1;

    const compareNullableString = (a: string | null, b: string | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    };

    list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }

      if (sortBy === 'attendance') {
        const aCount = attendanceCounts[a.id] ?? 0;
        const bCount = attendanceCounts[b.id] ?? 0;
        if (aCount === bCount) {
          return a.name.localeCompare(b.name) * direction;
        }
        return (aCount < bCount ? -1 : 1) * direction;
      }

      if (sortBy === 'created') {
        const aDate = Date.parse(a.created_at);
        const bDate = Date.parse(b.created_at);
        if (aDate === bDate) {
          return a.name.localeCompare(b.name) * direction;
        }
        return (aDate < bDate ? -1 : 1) * direction;
      }

      if (sortBy === 'season') {
        const aSeason = a.season_id ? seasonNameMap.get(a.season_id) ?? null : null;
        const bSeason = b.season_id ? seasonNameMap.get(b.season_id) ?? null : null;
        const comparison = compareNullableString(aSeason, bSeason);
        if (comparison !== 0) return comparison * direction;
        return a.name.localeCompare(b.name) * direction;
      }

      const aDate = Date.parse(a.event_date);
      const bDate = Date.parse(b.event_date);
      if (aDate === bDate) {
        return a.name.localeCompare(b.name) * direction;
      }
      return (aDate < bDate ? -1 : 1) * direction;
    });

    return list;
  }, [filteredEvents, sortBy, sortDirection, attendanceCounts, seasonNameMap]);

  const paginatedEvents = sortedEvents;

  const { todayEvents, upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const today: Event[] = [];
    const upcoming: Event[] = [];
    const past: Event[] = [];

    paginatedEvents.forEach((event) => {
      const eventTime = Date.parse(event.event_date);
      if (!Number.isNaN(eventTime)) {
        if (eventTime >= startOfToday && eventTime < endOfToday) {
          today.push(event);
          return;
        }
        if (eventTime < startOfToday) {
          past.push(event);
          return;
        }
      }
      upcoming.push(event);
    });

    return { todayEvents: today, upcomingEvents: upcoming, pastEvents: past };
  }, [paginatedEvents]);

  const eventsGridClass = viewMode === 'grid'
    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 items-stretch'
    : 'grid gap-3';

  const handleAssignSeason = async (eventId: string, seasonId: string) => {
    dropHandledRef.current = true;
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
      draggingEventRef.current = null;
      clearSeasonHoverTimers();
      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
      dropHandledRef.current = false;
    }
  };

  const getDraggedEventId = (event?: DragEvent) => {
    if (draggingEventRef.current) return draggingEventRef.current;
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
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {events.length > 0 && (
            <>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={eventSearch}
                  onChange={(event) => setEventSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Event date</SelectItem>
                  <SelectItem value="name">Alphabetically</SelectItem>
                  <SelectItem value="attendance">Attendance amount</SelectItem>
                  <SelectItem value="created">Created date</SelectItem>
                  <SelectItem value="season">Season assigned</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-10 p-0"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
              >
                {sortDirection === 'asc' ? (
                  <>
                    <ArrowUp className="w-4 h-4" />
                    <span className="sr-only">Ascending</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-4 h-4" />
                    <span className="sr-only">Descending</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-10 p-0"
                onClick={() => setViewMode((prev) => (prev === 'list' ? 'grid' : 'list'))}
                title={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
              >
                {viewMode === 'list' ? (
                  <>
                    <LayoutGrid className="w-4 h-4" />
                    <span className="sr-only">Grid view</span>
                  </>
                ) : (
                  <>
                    <List className="w-4 h-4" />
                    <span className="sr-only">List view</span>
                  </>
                )}
              </Button>
            </>
          )}
          <Link to="/events/new">
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              New event
            </Button>
          </Link>
        </div>
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
          {todayEvents.length > 0 && (
            <div className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Events today</h2>
              <div className={eventsGridClass}>
                {todayEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    attendeesCount={attendanceCounts[event.id] ?? 0}
                    seasons={seasons}
                    onEventDeleted={fetchData}
                    onEventUpdated={fetchData}
                    variant={viewMode}
                    onDragStart={(eventId) => {
                      dropHandledRef.current = false;
                      draggingEventRef.current = eventId;
                      setDraggingEventId(eventId);
                    }}
                    onDragEnd={() => {
                      window.setTimeout(() => {
                        if (!dropHandledRef.current) {
                          setDraggingEventId(null);
                          setDraggingOverSeasonId(null);
                          draggingEventRef.current = null;
                          clearSeasonHoverTimers();
                        }
                      }, 60);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold">Upcoming events</h2>
              {pastEvents.length > 0 && (
                <Button asChild variant="glass" size="sm" className="rounded-full px-3">
                  <a href="#past-events">Skip to past events</a>
                </Button>
              )}
            </div>
            <div className={eventsGridClass}>
              {upcomingEvents.length === 0 ? (
                <Card className="bg-gradient-card">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No upcoming events</p>
                  </CardContent>
                </Card>
              ) : (
                upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    attendeesCount={attendanceCounts[event.id] ?? 0}
                    seasons={seasons}
                    onEventDeleted={fetchData}
                    onEventUpdated={fetchData}
                    variant={viewMode}
                    onDragStart={(eventId) => {
                      dropHandledRef.current = false;
                      draggingEventRef.current = eventId;
                      setDraggingEventId(eventId);
                    }}
                    onDragEnd={() => {
                      window.setTimeout(() => {
                        if (!dropHandledRef.current) {
                          setDraggingEventId(null);
                          setDraggingOverSeasonId(null);
                          draggingEventRef.current = null;
                          clearSeasonHoverTimers();
                        }
                      }, 60);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <div id="past-events" className="mt-10">
            <h2 className="text-xl font-semibold mb-4">Past events</h2>
            <div className={eventsGridClass}>
              {pastEvents.length === 0 ? (
                <Card className="bg-gradient-card">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No past events</p>
                  </CardContent>
                </Card>
              ) : (
                pastEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    attendeesCount={attendanceCounts[event.id] ?? 0}
                    seasons={seasons}
                    onEventDeleted={fetchData}
                    onEventUpdated={fetchData}
                    variant={viewMode}
                    onDragStart={(eventId) => {
                      dropHandledRef.current = false;
                      draggingEventRef.current = eventId;
                      setDraggingEventId(eventId);
                    }}
                    onDragEnd={() => {
                      window.setTimeout(() => {
                        if (!dropHandledRef.current) {
                          setDraggingEventId(null);
                          setDraggingOverSeasonId(null);
                          draggingEventRef.current = null;
                          clearSeasonHoverTimers();
                        }
                      }, 60);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </>
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
                  draggingEventRef.current = null;
                  dropHandledRef.current = false;
                  clearSeasonHoverTimers();
                }}
                title="Close"
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
                  title="Previous page"
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
                  title="Next page"
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
