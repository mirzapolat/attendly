import { useState, useRef, type DragEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreVertical, Trash2, FolderPlus, FolderMinus, Folder } from 'lucide-react';

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
  seasons: Season[];
  onEventDeleted: () => void;
  onEventUpdated: () => void;
  onDragStart?: (eventId: string) => void;
  onDragEnd?: () => void;
}

const EventCard = ({
  event,
  seasons,
  onEventDeleted,
  onEventUpdated,
  onDragStart,
  onDragEnd,
}: EventCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
  const quickSeasons = seasons.slice(0, 3);

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
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${event.is_active ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`}
            />
            <div>
              <p className="font-medium">{event.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {format(new Date(event.event_date), 'PPP')}
                </span>
                {currentSeason && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                    <Folder className="w-3 h-3" />
                    {currentSeason.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-2"
            onClick={(eventClick) => eventClick.stopPropagation()}
            onPointerDown={(eventClick) => eventClick.stopPropagation()}
          >
            {event.is_active && (
              <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                Active
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(eventClick) => eventClick.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {event.season_id ? (
                  <DropdownMenuItem
                    onClick={(eventClick) => {
                      eventClick.stopPropagation();
                      handleSeasonChange(null);
                    }}
                  >
                    <FolderMinus className="w-4 h-4 mr-2" />
                    Remove from season
                  </DropdownMenuItem>
                ) : (
                  quickSeasons.length > 0 && (
                    <>
                      {quickSeasons.map((season) => (
                        <DropdownMenuItem
                          key={season.id}
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            handleSeasonChange(season.id);
                          }}
                        >
                          <FolderPlus className="w-4 h-4 mr-2" />
                          Add to {season.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )
                )}
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Tip: Drag events onto a season to organize quickly.
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

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
