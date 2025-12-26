import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { MoreVertical, Trash2, FolderPlus, FolderMinus } from 'lucide-react';

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
}

const EventCard = ({ event, seasons, onEventDeleted, onEventUpdated }: EventCardProps) => {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <>
      <Card className="bg-gradient-card hover:border-primary/50 transition-colors">
        <CardContent className="py-4 flex items-center justify-between">
          <Link to={`/events/${event.id}`} className="flex items-center gap-4 flex-1">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${event.is_active ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`}
            />
            <div>
              <p className="font-medium">{event.name}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(event.event_date), 'PPP')}
              </p>
              {currentSeason && (
                <p className="text-xs text-primary">{currentSeason.name}</p>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {event.is_active && (
              <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">
                Active
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {event.season_id ? (
                  <DropdownMenuItem onClick={() => handleSeasonChange(null)}>
                    <FolderMinus className="w-4 h-4 mr-2" />
                    Remove from season
                  </DropdownMenuItem>
                ) : (
                  seasons.length > 0 && (
                    <>
                      {seasons.map((season) => (
                        <DropdownMenuItem
                          key={season.id}
                          onClick={() => handleSeasonChange(season.id)}
                        >
                          <FolderPlus className="w-4 h-4 mr-2" />
                          Add to {season.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
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
