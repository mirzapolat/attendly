import { useState, useRef, type DragEvent, type KeyboardEvent } from 'react';
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
import { format } from 'date-fns';
import { Trash2, FolderPlus, FolderMinus, Folder, Calendar, Clock, X } from 'lucide-react';

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
}

const EventCard = ({
  event,
  attendeesCount,
  seasons,
  onEventDeleted,
  onEventUpdated,
  onDragStart,
  onDragEnd,
}: EventCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const draggingRef = useRef(false);

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
      const { error } = await supabase
        .from('events')
        .update({ season_id: seasonId })
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

  const handleDragStart = (dragEvent: DragEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    dragEvent.dataTransfer.setData('application/x-attendly-event', JSON.stringify({ id: event.id }));
    dragEvent.dataTransfer.setData('text/plain', event.id);
    dragEvent.dataTransfer.effectAllowed = 'move';
    onDragStart?.(event.id);
  };

  const handleDragEnd = () => {
    draggingRef.current = false;
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

  return (
    <>
      <Card
        className="bg-gradient-card hover:border-primary/50 transition-colors cursor-pointer active:cursor-grabbing select-none"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role="button"
        tabIndex={0}
      >
        <CardContent className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${event.is_active ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`}
            />
            <div className="grid w-full gap-x-4 gap-y-1 sm:grid-cols-[minmax(10rem,1.2fr)_auto_auto_auto] sm:items-center">
              <p className="font-medium truncate">{event.name}</p>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(event.event_date), 'PPP')}
              </span>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(event.event_date), 'HH:mm')}
              </span>
              {currentSeason && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium w-fit">
                  <Folder className="w-3 h-3" />
                  {currentSeason.name}
                </span>
              )}
            </div>
          </div>
          <div
            className="flex items-center gap-2"
            onClick={(eventClick) => eventClick.stopPropagation()}
            onPointerDown={(eventClick) => eventClick.stopPropagation()}
          >
            {typeof attendeesCount === 'number' && (
              <span className="text-xs rounded-full bg-muted/60 text-muted-foreground px-2 py-1">
                {attendeesCount} attended
              </span>
            )}
            {event.is_active && (
              <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                Active
              </span>
            )}
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
        </CardContent>
      </Card>

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
};

export default EventCard;
