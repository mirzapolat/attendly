import EventCard from '@/components/EventCard';

interface EventSectionEvent {
  id: string;
  name: string;
  event_date: string;
  is_active: boolean;
  series_id: string | null;
  created_at: string;
}

interface EventSectionSeason {
  id: string;
  name: string;
}

interface EventSectionProps {
  id?: string;
  title?: string;
  className?: string;
  events: EventSectionEvent[];
  eventsGridClass: string;
  attendanceCounts: Record<string, number>;
  seasons: EventSectionSeason[];
  viewMode: 'list' | 'grid' | 'calendar';
  onRefresh: () => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
}

const EventSection = ({
  id,
  title,
  className,
  events,
  eventsGridClass,
  attendanceCounts,
  seasons,
  viewMode,
  onRefresh,
  onDragStart,
  onDragEnd,
}: EventSectionProps) => {
  if (events.length === 0) {
    return null;
  }

  const cardVariant = viewMode === 'list' ? 'list' : 'grid';

  return (
    <div id={id} className={className}>
      {title ? <h2 className="text-xl font-semibold mb-4">{title}</h2> : null}
      <div className={eventsGridClass}>
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            attendeesCount={attendanceCounts[event.id] ?? 0}
            seasons={seasons}
            onEventDeleted={onRefresh}
            onEventUpdated={onRefresh}
            variant={cardVariant}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
};

export default EventSection;
