import { useState, useRef, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { Trash2, FolderPlus, FolderMinus, Folder, Calendar, Clock, UserCheck, X } from 'lucide-react';

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

interface EventCardProps {
  event: Event;
  attendeesCount?: number;
  seasons: Season[];
  onEventDeleted: () => void;
  onEventUpdated: () => void;
  onDragStart?: (eventId: string) => void;
  onDragEnd?: () => void;
  variant?: 'list' | 'grid';
}

const EventCard = ({
  event,
  attendeesCount,
  seasons,
  onEventDeleted,
  onEventUpdated,
  onDragStart,
  onDragEnd,
  variant = 'list',
}: EventCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const draggingRef = useRef(false);
  const dragResetTimer = useRef<number | null>(null);
  const blockDragRef = useRef(false);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Delete attendance records first (cascade should handle this, but being explicit)
      await supabase
        .from('attendance_records')
        .delete()
        .eq('event_id', event.id);

      // Delete the event
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: 'Event deleted',
        description: 'Event and all related records have been removed',
      });
      onEventDeleted();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete event',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleSeasonChange = async (seasonId: string | null) => {
    try {
      if (seasonId === event.season_id) return;
      const { error } = await supabase
        .from('events')
        .update({ season_id: seasonId, attendance_weight: 1 })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: seasonId ? 'Added to season' : 'Removed from season',
        description: seasonId
          ? `Event added to ${seasons.find((s) => s.id === seasonId)?.name}`
          : 'Event removed from season',
      });
      onEventUpdated();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update event',
      });
    }
  };

  const currentSeason = seasons.find((s) => s.id === event.season_id);
  const eventDate = new Date(event.event_date);
  const isPastEvent = eventDate.getTime() < Date.now();
  const isToday = isSameDay(eventDate, new Date());
  const now = Date.now();

  const getScheduleLabel = () => {
    if (event.is_active) return 'Live';
    if (isPastEvent) {
      return isToday ? 'Scheduled today' : '';
    }
    const minutesDiff = differenceInMinutes(eventDate, now);
    if (minutesDiff <= 0) return 'Scheduled';
    if (minutesDiff < 60) {
      return `Scheduled in ${minutesDiff} minute${minutesDiff === 1 ? '' : 's'}`;
    }
    if (minutesDiff < 1440) {
      const hours = Math.ceil(minutesDiff / 60);
      return `Scheduled in ${hours} hour${hours === 1 ? '' : 's'}`;
    }
    const days = Math.ceil(minutesDiff / 1440);
    return `Scheduled in ${days} day${days === 1 ? '' : 's'}`;
  };

  const scheduleLabel = getScheduleLabel();

  const handleDragStart = (dragEvent: DragEvent<HTMLDivElement>) => {
    if (blockDragRef.current) {
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      return;
    }
    const dragTarget = dragEvent.currentTarget;
    const rect = dragTarget.getBoundingClientRect();
    const clone = dragTarget.cloneNode(true) as HTMLDivElement;
    clone.style.position = 'absolute';
    clone.style.top = '-1000px';
    clone.style.left = '-1000px';
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.transform = 'scale(0.9)';
    clone.style.transformOrigin = 'top left';
    clone.style.opacity = '0.85';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '9999';
    document.body.appendChild(clone);
    dragGhostRef.current = clone;
    dragEvent.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
    draggingRef.current = true;
    if (dragResetTimer.current) {
      window.clearTimeout(dragResetTimer.current);
      dragResetTimer.current = null;
    }
    dragEvent.dataTransfer.setData('application/x-attendly-event', JSON.stringify({ id: event.id }));
    dragEvent.dataTransfer.setData('text/plain', event.id);
    dragEvent.dataTransfer.effectAllowed = 'move';
    onDragStart?.(event.id);
  };

  const handleDragEnd = () => {
    if (dragResetTimer.current) {
      window.clearTimeout(dragResetTimer.current);
    }
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
    dragResetTimer.current = window.setTimeout(() => {
      draggingRef.current = false;
      dragResetTimer.current = null;
    }, 150);
    onDragEnd?.();
  };

  const handleCardClick = () => {
    if (draggingRef.current) {
      return;
    }
    navigate(`/events/${event.id}`);
  };

  const handleCardKeyDown = (eventKey: KeyboardEvent<HTMLDivElement>) => {
    if (eventKey.key === 'Enter' || eventKey.key === ' ') {
      eventKey.preventDefault();
      handleCardClick();
    }
  };

  const cardProps = {
    draggable: true,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onClick: handleCardClick,
    onKeyDown: handleCardKeyDown,
    onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      blockDragRef.current = Boolean(target?.closest('[data-no-drag="true"]'));
    },
    onPointerUpCapture: () => {
      blockDragRef.current = false;
    },
    onPointerCancelCapture: () => {
      blockDragRef.current = false;
    },
    role: 'button' as const,
    tabIndex: 0,
  };

  const actionButtons = (
    <div
      data-no-drag="true"
      className="flex items-center gap-2 shrink-0"
      onClick={(eventClick) => eventClick.stopPropagation()}
      onPointerDown={(eventClick) => eventClick.stopPropagation()}
      onMouseDown={(eventClick) => {
        eventClick.stopPropagation();
      }}
      onDragStart={(eventClick) => {
        eventClick.stopPropagation();
        eventClick.preventDefault();
      }}
      draggable={false}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowSeasonPicker(true)}
        title={event.season_id ? 'Change season' : 'Assign to season'}
      >
        {event.season_id ? (
          <FolderMinus className="w-4 h-4" />
        ) : (
          <FolderPlus className="w-4 h-4" />
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setShowDeleteDialog(true)}
        title="Delete event"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  const dialogs = (
    <>
      {showSeasonPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => setShowSeasonPicker(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-border bg-background shadow-lg p-6"
            onClick={(eventClick) => eventClick.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
                  Assign event
                </p>
                <h3 className="text-lg font-semibold">Choose a season</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowSeasonPicker(false)} title="Close">
                <X className="w-4 h-4" />
              </Button>
            </div>
            {seasons.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No seasons available. Create one to organize events.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {event.season_id && (
                  <button
                    type="button"
                    className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-3 text-left transition-colors hover:border-destructive/60"
                    onClick={() => {
                      handleSeasonChange(null);
                      setShowSeasonPicker(false);
                    }}
                  >
                    <p className="font-medium text-destructive">Remove from season</p>
                    <p className="text-xs text-muted-foreground">Set as unassigned</p>
                  </button>
                )}
                {seasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      season.id === event.season_id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/40 hover:border-primary/40'
                    }`}
                    onClick={() => {
                      handleSeasonChange(season.id);
                      setShowSeasonPicker(false);
                    }}
                  >
                    <p className="font-medium">{season.name}</p>
                    <p className="text-xs text-muted-foreground">Assign to this season</p>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground">
              Tip: Drag events onto a season to organize quickly.
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{event.name}" and all its attendance records. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (variant === 'grid') {
    return (
      <>
        <Card
          className="group relative h-full min-h-[230px] overflow-hidden bg-gradient-card border border-border/80 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_40px_-24px_hsl(var(--primary)/0.35)] cursor-pointer active:cursor-grabbing select-none"
          {...cardProps}
        >
          <div className="pointer-events-none absolute -top-16 -right-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
          <CardContent className="relative z-10 flex h-full flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              {scheduleLabel && (
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      event.is_active ? 'bg-success animate-pulse' : 'bg-muted-foreground/60'
                    }`}
                  />
                  <span className={`text-xs font-semibold ${event.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                    {scheduleLabel}
                  </span>
                </div>
              )}
              <div
                data-no-drag="true"
                className="flex items-center gap-2 opacity-70 transition-opacity group-hover:opacity-100"
                onClick={(eventClick) => eventClick.stopPropagation()}
                onPointerDown={(eventClick) => eventClick.stopPropagation()}
                onMouseDown={(eventClick) => {
                  eventClick.stopPropagation();
                }}
                onDragStart={(eventClick) => {
                  eventClick.stopPropagation();
                  eventClick.preventDefault();
                }}
                draggable={false}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowSeasonPicker(true)}
                  title={event.season_id ? 'Change season' : 'Assign to season'}
                >
                  {event.season_id ? (
                    <FolderMinus className="w-4 h-4" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  title="Delete event"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-lg font-semibold leading-snug line-clamp-2">{event.name}</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium text-foreground">{format(eventDate, 'EEE, MMM d')}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <Clock className="h-3.5 w-3.5" />
                <span>{format(eventDate, 'HH:mm')}</span>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {typeof attendeesCount === 'number' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span className="font-medium">{attendeesCount}</span>
                </span>
              ) : (
                <span className="rounded-full bg-muted/60 px-2 py-1">No attendance</span>
              )}
              {currentSeason && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-medium">
                  <Folder className="w-3 h-3" />
                  {currentSeason.name}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <Card
        className="group relative overflow-hidden bg-gradient-card border border-border/80 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_40px_-30px_hsl(var(--primary)/0.35)] cursor-pointer active:cursor-grabbing select-none"
        {...cardProps}
      >
        <div className="pointer-events-none absolute -left-16 -top-12 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-16 -bottom-14 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
        <CardContent className="relative z-10 flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            {scheduleLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${event.is_active ? 'bg-success' : 'bg-muted-foreground/70'}`}
                />
                {event.is_active ? 'Live now' : scheduleLabel}
              </span>
            ) : (
              <span aria-hidden="true" />
            )}
            {actionButtons}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-1.5 sm:w-24">
              <div className="rounded-xl border border-border/70 bg-background/70 px-2.5 py-1.5 text-center shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{format(eventDate, 'EEE')}</p>
                <p className="text-base font-semibold">{format(eventDate, 'MMM d')}</p>
                <p className="text-xs text-muted-foreground">{format(eventDate, 'HH:mm')}</p>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="space-y-1">
                <p className="text-base font-semibold leading-snug line-clamp-1">{event.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(eventDate, 'PPP')}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {currentSeason && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                    <Folder className="w-3 h-3" />
                    {currentSeason.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground">
                  {typeof attendeesCount === 'number' ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{attendeesCount}</span>
                    </>
                  ) : (
                    'No attendance'
                  )}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {dialogs}
    </>
  );
};

export default EventCard;
