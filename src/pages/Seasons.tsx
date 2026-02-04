import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, BarChart3, Check, FolderOpen, Search, Trash2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/hooks/useConfirm';

interface Season {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

interface EventSummary {
  id: string;
  series_id: string | null;
  event_date: string;
}

const clampEllipsisClass =
  "relative pr-3 after:content-['...'] after:absolute after:bottom-0 after:right-0 after:pl-1 after:bg-background after:text-muted-foreground";

const ClampedSeasonName = ({ name }: { name: string }) => {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const checkTruncation = () => {
      const heightOverflow = element.scrollHeight > element.clientHeight + 1;
      const widthOverflow = element.scrollWidth > element.clientWidth + 1;
      setIsTruncated(heightOverflow || widthOverflow);
    };

    checkTruncation();
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [name]);

  return (
    <p
      ref={textRef}
      className={`font-medium line-clamp-2 leading-snug ${isTruncated ? clampEllipsisClass : ''}`}
    >
      {name}
    </p>
  );
};

const Seasons = () => {
  usePageTitle('Series - Attendly');
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  const [seasonDescription, setSeasonDescription] = useState('');
  const [seasonCreating, setSeasonCreating] = useState(false);
  const [seasonSearch, setSeasonSearch] = useState('');
  const [selectedSeasonIds, setSelectedSeasonIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'events' | 'earliest' | 'latest'>('created');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
          .from('series')
          .select('id, name, description, created_at')
          .eq('workspace_id', currentWorkspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('id, series_id, event_date')
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
        description: 'Series name must be 40 characters or fewer.',
      });
      return;
    }

    setSeasonCreating(true);
    try {
      const { error } = await supabase.from('series').insert({
        workspace_id: currentWorkspace.id,
        name: trimmedName,
        description: seasonDescription.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Series created' });
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
    const confirmed = await confirm({
      title: 'Delete series?',
      description: 'Events assigned to it will remain, but become unassigned.',
      confirmText: 'Delete series',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('series').delete().eq('id', seasonId);
      if (error) throw error;

      toast({ title: 'Series deleted' });
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

  useEffect(() => {
    if (seasons.length === 0) {
      if (selectedSeasonIds.length > 0) setSelectedSeasonIds([]);
      return;
    }
    setSelectedSeasonIds((prev) => prev.filter((id) => seasons.some((season) => season.id === id)));
  }, [seasons, selectedSeasonIds.length]);

  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      if (!event.series_id) return;
      counts.set(event.series_id, (counts.get(event.series_id) ?? 0) + 1);
    });
    return counts;
  }, [events]);

  const seasonDateRanges = useMemo(() => {
    const ranges = new Map<string, { earliest: string | null; latest: string | null }>();
    events.forEach((event) => {
      if (!event.series_id) return;
      const existing = ranges.get(event.series_id) ?? { earliest: null, latest: null };
      const eventDate = event.event_date;
      if (!existing.earliest || eventDate < existing.earliest) {
        existing.earliest = eventDate;
      }
      if (!existing.latest || eventDate > existing.latest) {
        existing.latest = eventDate;
      }
      ranges.set(event.series_id, existing);
    });
    return ranges;
  }, [events]);

  const sortedSeasons = useMemo(() => {
    const list = [...filteredSeasons];
    const direction = sortDirection === 'asc' ? 1 : -1;

    const compareNullable = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    };

    list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }

      if (sortBy === 'events') {
        const aCount = eventCounts.get(a.id) ?? 0;
        const bCount = eventCounts.get(b.id) ?? 0;
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

      const aRange = seasonDateRanges.get(a.id);
      const bRange = seasonDateRanges.get(b.id);
      const aValue =
        sortBy === 'earliest'
          ? aRange?.earliest
          : aRange?.latest;
      const bValue =
        sortBy === 'earliest'
          ? bRange?.earliest
          : bRange?.latest;

      const aTime = aValue ? Date.parse(aValue) : null;
      const bTime = bValue ? Date.parse(bValue) : null;
      const comparison = compareNullable(aTime, bTime);
      if (comparison !== 0) return comparison * direction;
      return a.name.localeCompare(b.name) * direction;
    });

    return list;
  }, [filteredSeasons, sortBy, sortDirection, eventCounts, seasonDateRanges]);

  const toggleSelectSeason = (seasonId: string, checked: boolean) => {
    setSelectedSeasonIds((prev) => {
      if (checked) return prev.includes(seasonId) ? prev : [...prev, seasonId];
      return prev.filter((id) => id !== seasonId);
    });
  };

  const handleDeleteSelectedSeasons = async () => {
    if (selectedSeasonIds.length === 0) return;
    const count = selectedSeasonIds.length;
    const confirmed = await confirm({
      title: `Delete ${count} series?`,
      description: 'Events assigned to them will remain, but become unassigned.',
      confirmText: 'Delete series',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('series').delete().in('id', selectedSeasonIds);
      if (error) throw error;
      toast({ title: 'Series deleted' });
      setSelectedSeasonIds([]);
      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: sanitizeError(error),
      });
    }
  };

  return (
    <WorkspaceLayout title="Series overview">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Series</h1>
          <p className="text-muted-foreground">Organize events into series and track attendance.</p>
        </div>
        <Dialog open={seasonDialogOpen} onOpenChange={setSeasonDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <FolderOpen className="w-4 h-4" />
              Create series
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Series</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSeason} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seasonName">Series Name</Label>
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
                {seasonCreating ? 'Creating...' : 'Create Series'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-semibold">All series</h2>
        {seasons.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search series..."
                value={seasonSearch}
                onChange={(e) => setSeasonSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest event date</SelectItem>
                <SelectItem value="earliest">Earliest event date</SelectItem>
                <SelectItem value="name">Alphabetically</SelectItem>
                <SelectItem value="created">Created date</SelectItem>
                <SelectItem value="events">Event amount</SelectItem>
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
            {selectedSeasonIds.length > 0 && (
              <Button variant="destructive" onClick={handleDeleteSelectedSeasons}>
                Delete selected ({selectedSeasonIds.length})
              </Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Card className="bg-gradient-card">
          <CardContent className="py-8 text-center">Loading series...</CardContent>
        </Card>
      ) : sortedSeasons.length === 0 ? (
        <Card className="bg-gradient-card">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {seasonSearch ? 'No series match your search' : 'Create your first series to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[820px] rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="grid gap-3 grid-cols-[minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_48px] items-center">
                  <span className="pl-[56px]">Name</span>
                  <span>Events</span>
                  <span>Earliest</span>
                  <span>Latest</span>
                  <span>Created</span>
                  <span className="justify-self-end">Actions</span>
                </div>
              </div>
              <div className="divide-y divide-border">
            {sortedSeasons.map((season) => (
              <div
                key={season.id}
                className="px-4 py-3 transition-colors hover:bg-muted/30 cursor-pointer"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/series/${season.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/series/${season.id}`);
                  }
                }}
              >
                <div className="grid gap-3 grid-cols-[minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_48px] items-center">
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      type="button"
                      className={`relative w-10 h-10 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${
                        selectedSeasonIds.includes(season.id)
                          ? 'bg-primary/15 text-primary border-primary/60'
                          : 'bg-primary/5 text-primary/70 border-dashed border-primary/50 hover:bg-primary/10 hover:text-primary hover:border-primary/60'
                      }`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleSelectSeason(season.id, !selectedSeasonIds.includes(season.id));
                      }}
                      title={
                        selectedSeasonIds.includes(season.id)
                          ? 'Unselect series'
                          : 'Select series'
                      }
                      aria-pressed={selectedSeasonIds.includes(season.id)}
                      aria-label={
                        selectedSeasonIds.includes(season.id)
                          ? `Unselect series ${season.name}`
                          : `Select series ${season.name}`
                      }
                    >
                      <span
                        className={`absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-2 transition ${
                          selectedSeasonIds.includes(season.id)
                            ? 'bg-primary border-primary'
                            : 'bg-background border-primary/60'
                        }`}
                      />
                      {selectedSeasonIds.includes(season.id) ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <BarChart3 className="w-5 h-5" />
                      )}
                    </button>
                    <Link
                      to={`/series/${season.id}`}
                      className="min-w-0"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ClampedSeasonName name={season.name} />
                      {season.description && (
                        <p className="text-xs text-muted-foreground truncate">{season.description}</p>
                      )}
                    </Link>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {eventCounts.get(season.id) ?? 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {seasonDateRanges.get(season.id)?.earliest
                      ? format(new Date(seasonDateRanges.get(season.id)!.earliest as string), 'PPP')
                      : '—'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {seasonDateRanges.get(season.id)?.latest
                      ? format(new Date(seasonDateRanges.get(season.id)!.latest as string), 'PPP')
                      : '—'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {season.created_at ? format(new Date(season.created_at), 'PPP') : '—'}
                  </div>
                  <div className="justify-self-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleDeleteSeason(season.id);
                      }}
                      title="Delete series"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
              </div>
            </div>
          </div>

        </>
      )}
    </WorkspaceLayout>
  );
};

export default Seasons;
